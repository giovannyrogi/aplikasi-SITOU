"use client";
import { useEffect, useState } from "react";
import { Button, Checkbox, Form, Input } from "antd";
import { Box } from "@mui/material";
import AppNotice from "@/app/components/data-display/AppNotice";
import FontStyle from "@/app/components/font-style/FontStyle";
import { holidayDifferences } from "@/lib/holiday-catalogs/differences.mjs";
import HolidayDayFields from "./HolidayDayFields";
import HolidayDateList from "./HolidayDateList";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";

export default function HolidayPdfStage({ year, previous, onUse, onReady, active, importer }) {
  const [form] = Form.useForm();
  const { job, busy, error } = importer;
  const [reviewed, setReviewed] = useState(false),
    [manual, setManual] = useState(false),
    [days, setDays] = useState([]);
  const [correcting, setCorrecting] = useState(false);
  const [validationFailure, setValidationFailure] = useState(null);
  const resolved = job && ["ready", "incomplete"].includes(job.status);
  useEffect(() => {
    if (!resolved) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      const values = {
        decisionNumber: job.result.decisionNumber || "",
        days: job.result.days.map(({ date, name, category }) => ({ date, name, category })),
      };
      form.setFieldsValue(values);
      setDays(values.days);
      setReviewed(false);
      setManual(false);
      setCorrecting(false);
    });
    return () => {
      cancelled = true;
    };
  }, [job?.id, resolved, job?.result, form]);
  useEffect(() => {
    onReady(
      Boolean(
        resolved &&
        !job.result?.yearMismatch &&
        reviewed &&
        (job.status === "ready" || manual) &&
        !busy,
      ),
    );
  }, [resolved, reviewed, manual, busy, job, onReady]);
  const diff = holidayDifferences(previous, days);
  return (
    <Form
      id="holiday-pdf-review"
      name="holiday-pdf-review"
      requiredMark={false}
      form={form}
      layout="vertical"
      onFinishFailed={({ errorFields }) => {
        setCorrecting(true);
        setValidationFailure({ fields: errorFields });
      }}
      onValuesChange={(_, v) => {
        setReviewed(false);
        setManual(false);
        setDays(v.days || []);
      }}
      onFinish={(v) => {
        if (job && !job.result?.yearMismatch && reviewed && (job.status === "ready" || manual))
          onUse({ ...v, year, pdfImportId: job.id, pdfReviewed: true, sourceUrl: "" });
      }}
    >
      <Box sx={{ display: "grid", gap: 3 }}>
        <AppNotice
          title={`Periksa SKB tahun ${year}`}
          description="Pembacaan dilakukan di server SITOU. Cocokkan hasil dengan lampiran PDF sebelum menyimpan draft."
        />
        {error && (
          <AppNotice
            tone="danger"
            title="Proses belum selesai"
            description={error}
            action={<Button onClick={importer.retry}>Coba lagi</Button>}
          />
        )}
        {job?.status === "expired" && (
          <AppNotice
            tone="warning"
            title="Unggahan kedaluwarsa"
            description="Unggah kembali PDF untuk melanjutkan. Isian katalog sebelumnya tetap tersedia."
          />
        )}
        {job?.status === "failed" && (
          <AppNotice
            tone="danger"
            title="PDF belum dapat dibaca"
            description={`Periksa dokumen dan layanan OCR, lalu unggah kembali. Kode: ${job.error_code || "PDF_PROCESS_FAILED"}. Isian katalog sebelumnya tetap tersedia.`}
          />
        )}
        {resolved && (
          <>
            <Button
              href={`/api/system/holiday-catalogs/pdf-imports/${job.id}/document`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Lihat PDF sumber
            </Button>
            <FontStyle>
              {job.original_name} · {(Number(job.size_bytes) / 1024 / 1024).toFixed(1)} MB
            </FontStyle>
            <AppNotice
              tone={job.status === "ready" ? "info" : "warning"}
              title={job.status === "ready" ? "Hasil siap diperiksa" : "Hasil belum lengkap"}
              description={
                job.status === "ready"
                  ? "Periksa semua tanggal, kategori, dan nama terhadap PDF."
                  : "Lengkapi atau koreksi seluruh tabel berdasarkan PDF sumber. Sistem tidak menebak bagian yang belum terbaca."
              }
            />
            {(job.result.metadataIssues || []).map((message, i) => (
              <AppNotice
                key={`meta-${i}`}
                tone="warning"
                title="Metadata perlu diperiksa"
                description={message}
              />
            ))}
            {job.result.issues.map((issue, i) => (
              <AppNotice
                key={i}
                tone="warning"
                title={issue.page ? `Halaman ${issue.page}` : "Perlu diperiksa"}
                description={issue.message}
              />
            ))}
            <AppNotice
              title={`${days.length} tanggal dalam pratinjau`}
              description={`${diff.added.length} tambahan, ${diff.changed.length} perubahan, ${diff.removed.length} dihapus dari isian sebelumnya jika hasil digunakan. Draft belum disimpan.`}
            />
            <Form.Item
              name="decisionNumber"
              label="Nomor keputusan"
              rules={[{ required: true, message: "Isi nomor keputusan dari dokumen." }]}
            >
              <Input maxLength={200} />
            </Form.Item>
            <Button
              aria-expanded={correcting}
              onClick={() => setCorrecting((v) => !v)}
              style={{ marginBottom: 24 }}
            >
              {correcting ? "Selesai mengoreksi" : "Koreksi hasil pembacaan"}
            </Button>
            <Box sx={{ display: correcting ? "block" : "none" }}>
              <HolidayDayFields
                year={year}
                evidence={job.result.days}
                validationFailure={validationFailure}
              />
            </Box>
            {!correcting && (
              <HolidayDateList
                days={days.map((d, i) => ({ ...d, id: String(i) }))}
                previous={(d) => {
                  const old = previous.find((p) => p.date === d.date);
                  return old && (old.name !== d.name || old.category !== d.category)
                    ? old.name
                    : null;
                }}
                sourceInfo={(d) => {
                  const source = job.result.days.find((s) => s.date === d.date);
                  return source ? (
                    <>
                      <FontStyle color="text.secondary">Halaman sumber: {source.page}</FontStyle>
                      {source.needsReview && (
                        <CompactInfoChip tone="warning" label="Perlu diperiksa" />
                      )}
                    </>
                  ) : (
                    <CompactInfoChip tone="warning" label="Ditambahkan manual" />
                  );
                }}
              />
            )}
            {job.status === "incomplete" && (
              <Checkbox
                checked={manual}
                onChange={(e) => {
                  setManual(e.target.checked);
                  setReviewed(false);
                }}
              >
                Saya sudah melengkapi seluruh tabel berdasarkan PDF sumber.
              </Checkbox>
            )}
            <Box sx={{ mt: 3 }}>
              <Checkbox checked={reviewed} onChange={(e) => setReviewed(e.target.checked)}>
                Saya sudah mencocokkan seluruh tanggal, nama, dan kategori dengan lampiran SKB.
              </Checkbox>
            </Box>
          </>
        )}
        {!active && null}
      </Box>
    </Form>
  );
}
