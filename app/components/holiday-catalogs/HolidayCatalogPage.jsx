"use client";
import { useState } from "react";
import { Button, Checkbox, Form, Input, InputNumber } from "antd";
import { Box } from "@mui/material";
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CloudDownloadOutlined,
} from "@ant-design/icons";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import OperationalFilterSection from "@/app/components/filters/OperationalFilterSection";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import AppNotice from "@/app/components/data-display/AppNotice";
import FontStyle from "@/app/components/font-style/FontStyle";
import AppModal from "@/app/components/modals/AppModal";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import RowActionMenu from "@/app/components/actions/RowActionMenu";
import HolidayDayFields from "./HolidayDayFields";
import FormSection from "@/app/components/forms/FormSection";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import AppYearPicker from "@/app/components/forms/AppYearPicker";
import CatalogEntryMethod from "./CatalogEntryMethod";
import HolidayPdfSource from "./HolidayPdfSource";
import useHolidayPdfImport from "./useHolidayPdfImport";
import useHolidayDeletion from "./useHolidayDeletion";
import HolidayPdfStage from "./HolidayPdfStage";
import CatalogDocument from "./CatalogDocument";
import Notification from "@/app/components/Notifications/Notification";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import useAppNotification from "@/app/hooks/useAppNotification";
import useDataList from "@/app/hooks/useDataList";
import {
  scheduleRequest,
  requestKey,
  applyFieldErrors,
} from "@/app/components/work-schedules/ScheduleFields";
import HolidayDateList from "./HolidayDateList";
import HolidaySourcePreview from "./HolidaySourcePreview";
import { catalogMutation } from "@/lib/holiday-catalogs/schemas.mjs";
import { scheduleValidationMessage } from "@/lib/work-schedules/schemas.mjs";

export default function HolidayCatalogPage() {
  const list = useDataList("/api/system/holiday-catalogs");
  const [form] = Form.useForm();
  const [entryMethod, setEntryMethod] = useState("automatic");
  const [yearConflict, setYearConflict] = useState(null);
  const [validationFailure, setValidationFailure] = useState(null);
  const selectedYear = Form.useWatch("year", form);
  const [pdfStage, setPdfStage] = useState(false),
    [pdfReady, setPdfReady] = useState(false),
    [pdfReference, setPdfReference] = useState(null);
  const [editor, setEditor] = useState(null),
    [review, setReview] = useState(null),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [sourcePreview, setSourcePreview] = useState(null),
    [error, setError] = useState("");
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const pdf = useHolidayPdfImport({
    year: selectedYear,
    onPrepared: (job) => {
      if (!job.result?.yearMismatch) setPdfReference({ id: job.id, reviewed: false });
    },
  });
  const pdfUnready = Boolean(pdf.file && (!pdf.resolved || pdf.job?.result?.yearMismatch));
  const closeEditor = () => {
    pdf.reset();
    setEditor(null);
  };
  const deletion = useHolidayDeletion({
    kind: "catalog",
    onDeleted: list.refresh,
    onMessage: showNotification,
  });
  const open = (item, editPublished = false) => {
    setYearConflict(null);
    pdf.reset();
    setEntryMethod(item && (!editPublished || item.pdf_import_id) ? "manual" : "automatic");
    form.resetFields();
    setPdfStage(false);
    setPdfReady(false);
    setPdfReference(item?.pdf_import_id ? { id: item.pdf_import_id, reviewed: true } : null);
    setReview(null);
    setSourcePreview(null);
    setError("");
    setValidationFailure(null);
    form.setFieldsValue(
      item
        ? {
            year: item.year,
            decisionNumber: item.decision_number,
            sourceUrl: item.source_url,
            days: item.days.map(({ date, name, category }) => ({ date, name, category })),
          }
        : { year: new Date().getFullYear(), decisionNumber: "", sourceUrl: "", days: [] },
    );
    setEditor({
      item,
      editPublished,
      readOnly: Boolean(item?.status === "published" && !editPublished),
      key: requestKey(),
    });
  };
  const input = () => ({
    ...form.getFieldsValue(true),
    ...(pdfReference ? { pdfImportId: pdfReference.id, pdfReviewed: pdfReference.reviewed } : {}),
    operation: editor.editPublished ? "edit_published" : "save",
    ...(editor.item ? { id: editor.item.id, version: editor.item.version } : {}),
    requestKey: editor.key,
  });
  const reportConflict = (failure, year) => {
    setYearConflict(
      ["DRAFT_EXISTS", "CATALOG_YEAR_PUBLISHED", "CATALOG_REVISION_STALE"].includes(failure.code)
        ? { year, status: failure.code === "DRAFT_EXISTS" ? "draft" : "published" }
        : null,
    );
    setError(failure.message);
  };
  const openExisting = async () => {
    if (!yearConflict || busy) return;
    setBusy(true);
    try {
      const response = await scheduleRequest(
        `/api/system/holiday-catalogs?year=${yearConflict.year}&pageSize=2&view=history`,
      );
      const existing = response.data.find((row) => row.status === yearConflict.status);
      if (existing) open(existing);
      else {
        setYearConflict(null);
        setError("Katalog sudah berubah. Coba lagi.");
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const validate = async () => {
    try {
      await form.validateFields();
    } catch (failure) {
      setValidationFailure({ fields: failure.errorFields || [] });
      throw failure;
    }
    const parsed = catalogMutation.safeParse(input(), { error: scheduleValidationMessage });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(" "));
      return null;
    }
    setError("");
    return parsed.data;
  };
  const persistDraft = async (value, reviewAfterSave = false) => {
    if (busy) return;
    setError("");
    setYearConflict(null);
    setBusy(true);
    try {
      const r = await runWithLoadingBackdrop(
        () => scheduleRequest("/api/system/holiday-catalogs", value),
        { message: "Menyimpan draft..." },
      );
      const saved = {
        year: r.data.year,
        decisionNumber: r.data.decision_number,
        sourceUrl: r.data.source_url,
        days: r.data.days.map(({ date, name, category }) => ({ date, name, category })),
      };
      form.setFieldsValue(saved);
      // Continue with the exact server version. Unsaved form edits never get published.
      setEditor({ item: r.data, readOnly: false, key: requestKey() });
      setPdfStage(false);
      pdf.reset();
      setPdfReference(r.data.pdf_import_id ? { id: r.data.pdf_import_id, reviewed: true } : null);
      setReview(
        reviewAfterSave
          ? {
              ...saved,
              id: r.data.id,
              version: r.data.version,
              ...(r.data.pdf_import_id
                ? { pdfImportId: r.data.pdf_import_id, pdfReviewed: true }
                : {}),
            }
          : null,
      );
      setSourcePreview(null);
      showNotification("Draft tersimpan. Tinjau sebelum diterbitkan.");
      await list.refresh();
    } catch (e) {
      reportConflict(e, value.year);
      applyFieldErrors(form, e);
      setValidationFailure({
        fields: form.getFieldsError().filter((field) => field.errors.length),
      });
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    let value;
    try {
      value = await validate();
    } catch {
      return;
    }
    if (value) await persistDraft(value);
  };
  const fetchSource = async () => {
    if (busy) return;
    try {
      await form.validateFields(["year"]);
    } catch {
      return;
    }
    const year = Number(form.getFieldValue("year"));
    if (!Number.isInteger(year) || year < 2000 || year > 2200) {
      setError("Isi tahun antara 2000 dan 2200.");
      return;
    }
    const previous = (form.getFieldValue("days") || []).filter((d) => d?.date);
    setBusy(true);
    setError("");
    setYearConflict(null);
    try {
      const response = await runWithLoadingBackdrop(
        () =>
          scheduleRequest("/api/system/holiday-catalogs/source", {
            year,
            ...(editor.editPublished
              ? { revisionOf: editor.item.id }
              : editor.item
                ? { id: editor.item.id }
                : {}),
          }),
        { message: "Mengambil data hari libur..." },
      );
      if (editor.item) {
        const { decisionNumber, sourceUrl, days } = response.data;
        form.setFieldsValue({ decisionNumber, sourceUrl, days });
        setValidationFailure(null);
      } else {
        setSourcePreview({ candidate: response.data, previous, saveKey: requestKey() });
      }
      if (pdfReference) setPdfReference((r) => ({ ...r, reviewed: false }));
    } catch (e) {
      reportConflict(e, year);
    } finally {
      setBusy(false);
    }
  };
  const saveSource = async () => {
    if (!sourcePreview || busy) return;
    const { year, decisionNumber, sourceUrl, days } = sourcePreview.candidate;
    const parsed = catalogMutation.safeParse(
      {
        operation: "save",
        ...(pdfReference
          ? { pdfImportId: pdfReference.id, pdfReviewed: pdfReference.reviewed }
          : {}),
        year,
        decisionNumber,
        sourceUrl,
        days,
        requestKey: sourcePreview.saveKey,
      },
      { error: scheduleValidationMessage },
    );
    if (!parsed.success) {
      setError("Hasil sumber tidak dapat disimpan. Ambil ulang data.");
      return;
    }
    await persistDraft(parsed.data, true);
  };
  const preview = async () => {
    try {
      const value = await validate();
      if (value) setReview(value);
    } catch {
      return;
    }
  };
  const publish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await runWithLoadingBackdrop(
        () =>
          scheduleRequest("/api/system/holiday-catalogs", {
            ...review,
            operation: editor.editPublished ? "edit_published" : "publish",
            requestKey: editor.key,
          }),
        { message: editor.editPublished ? "Menyimpan perubahan..." : "Menerbitkan katalog..." },
      );
      setConfirm(false);
      setEditor(null);
      setReview(null);
      showNotification(
        editor.editPublished
          ? "Perubahan katalog tersimpan."
          : "Katalog diterbitkan. Kalender organisasi tetap mengikuti pilihan HRD.",
      );
      await list.refresh();
    } catch (e) {
      setConfirm(false);
      reportConflict(e, review.year);
    } finally {
      setBusy(false);
    }
  };
  const actions = (x) => [
    {
      key: "view",
      label: x.status === "published" ? "Lihat katalog" : "Edit draft",
      icon: x.status === "published" ? <EyeOutlined /> : <EditOutlined />,
      onClick: () => open(x),
    },
    ...(x.is_current
      ? [
          {
            key: "revise",
            label: "Edit katalog",
            icon: <EditOutlined />,
            onClick: () => open(x, true),
          },
        ]
      : []),
    {
      key: "delete",
      label: "Hapus permanen",
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => deletion.show(x),
    },
  ];
  const status = (x) => (
    <CompactInfoChip
      label={x.status === "draft" ? "Draft" : x.is_current ? "Terbit" : "Riwayat revisi"}
      tone={x.status === "draft" ? "warning" : x.is_current ? "success" : "neutral"}
    />
  );
  const columns = [
    { title: "Tahun", dataIndex: "year", width: 110 },
    { title: "Revisi", dataIndex: "revision", width: 100 },
    { title: "Status", render: (_, x) => status(x), width: 130 },
    { title: "Jumlah tanggal", dataIndex: "day_count", width: 150 },
    { title: "Nomor keputusan", dataIndex: "decision_number" },
    {
      title: "Penerbit",
      render: (_, x) =>
        x.status !== "published"
          ? "Belum diterbitkan"
          : x.system_seed
            ? "Data bawaan SITOU"
            : x.publisher_name || "Admin SITOU",
    },
    { title: "Aksi", width: 90, render: (_, x) => <RowActionMenu items={actions(x)} /> },
  ];
  const reviewedSaved =
    review &&
    editor?.item &&
    review.year === editor.item.year &&
    review.decisionNumber === editor.item.decision_number &&
    review.sourceUrl === editor.item.source_url &&
    (review.pdfImportId || null) === (editor.item.pdf_import_id || null) &&
    JSON.stringify(review.days) ===
      JSON.stringify(
        editor.item.days.map(({ date, name, category }) => ({ date, name, category })),
      );
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="Katalog Hari Libur"
        description="Kelola referensi resmi libur nasional dan cuti bersama."
        action={
          <Button type="primary" onClick={() => open(null)}>
            Buat katalog
          </Button>
        }
      />
      <OperationalFilterSection
        onRefresh={list.refresh}
        onReset={() => list.updateFilters({})}
        items={[
          {
            key: "view",
            label: "Tampilan",
            control: (
              <AsyncSelect
                aria-label="Tampilan katalog"
                value={list.filters.view || "current"}
                options={[
                  { value: "current", label: "Katalog terbaru" },
                  { value: "history", label: "Semua revisi dan draft" },
                ]}
                onChange={(view) =>
                  list.updateFilters({
                    ...list.filters,
                    view: view === "history" ? view : undefined,
                  })
                }
                style={{ width: "100%" }}
              />
            ),
          },
          {
            key: "year",
            label: "Tahun",
            control: (
              <InputNumber
                aria-label="Filter tahun"
                min={2000}
                max={2200}
                precision={0}
                value={list.filters.year || null}
                placeholder="Semua tahun"
                onChange={(year) =>
                  list.updateFilters({ ...list.filters, year: year || undefined })
                }
                style={{ width: "100%" }}
              />
            ),
          },
        ]}
      />
      <DataPanel
        title="Daftar katalog"
        description="Daftar utama menampilkan satu katalog per tahun."
      >
        <ResponsiveDataView
          data={list.data}
          columns={columns}
          loading={list.loading}
          error={list.error}
          onRetry={list.refresh}
          pagination={list.pagination}
          onPageChange={list.setPage}
          renderCard={(x) => (
            <Box sx={{ display: "grid", gap: 1.5 }}>
              <FontStyle fontWeight={600}>
                Katalog {x.year} · Revisi {x.revision}
              </FontStyle>
              {status(x)}
              <FontStyle>{x.day_count} tanggal</FontStyle>
              <FontStyle>SKB {x.decision_number}</FontStyle>
              <FontStyle>
                Penerbit:{" "}
                {x.system_seed ? "Data bawaan SITOU" : x.publisher_name || "Belum diterbitkan"}
              </FontStyle>
              <RowActionMenu items={actions(x)} buttonLabel="Aksi katalog" fullWidth />
            </Box>
          )}
          emptyDescription="Katalog belum tersedia untuk tahun ini."
        />
      </DataPanel>
      <AppModal
        open={Boolean(editor) && !confirm}
        keepMounted
        onClose={closeEditor}
        disableClose={busy || pdf.busy}
        title={
          editor?.readOnly
            ? "Katalog hari libur"
            : pdfStage
              ? "Tinjau hasil PDF"
              : sourcePreview
                ? "Tinjau data dari sumber"
                : review
                  ? "Tinjau katalog"
                  : editor?.editPublished
                    ? "Edit katalog hari libur"
                    : "Draft katalog hari libur"
        }
        description={
          pdfStage ? "Cocokkan tanggal dengan PDF sumber." : "Siapkan referensi hari libur."
        }
        icon="navigation:work-calendars"
        size="lg"
        contentResetKey={pdfStage ? "pdf" : sourcePreview ? "source" : review ? "review" : "form"}
        footer={
          editor?.readOnly ? (
            <>
              <Button onClick={closeEditor}>Tutup</Button>
              {editor.item.is_current && (
                <Button type="primary" onClick={() => open(editor.item, true)}>
                  Edit katalog
                </Button>
              )}
            </>
          ) : pdfStage ? (
            <>
              <Button onClick={() => setPdfStage(false)} disabled={busy}>
                Kembali ke form
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                form="holiday-pdf-review"
                disabled={!pdfReady || busy}
                loading={busy}
              >
                Gunakan hasil pembacaan
              </Button>
            </>
          ) : sourcePreview ? (
            <>
              <Button
                disabled={busy}
                onClick={() => {
                  setSourcePreview(null);
                  setError("");
                }}
              >
                Kembali ke form
              </Button>
              <Button
                type="primary"
                loading={busy}
                disabled={pdfUnready || pdf.busy}
                onClick={saveSource}
              >
                Gunakan dan simpan draft
              </Button>
            </>
          ) : review ? (
            <>
              <Button disabled={busy} onClick={() => setReview(null)}>
                Kembali ke form
              </Button>
              <Button
                type="primary"
                disabled={busy || (!editor.editPublished && !reviewedSaved)}
                loading={busy}
                onClick={() => (editor.editPublished ? void publish() : setConfirm(true))}
              >
                {editor.editPublished ? "Simpan perubahan" : "Terbitkan katalog"}
              </Button>
            </>
          ) : entryMethod === "automatic" ? (
            <>
              <Box sx={{ mr: { sm: "auto" } }}>
                <Button disabled={busy || pdf.busy} onClick={closeEditor}>
                  Batal
                </Button>
              </Box>
              <Button
                type="primary"
                icon={<CloudDownloadOutlined />}
                loading={busy}
                disabled={pdf.busy}
                onClick={fetchSource}
              >
                Ambil data terbaru
              </Button>
              {editor?.item && !editor.editPublished && (
                <Button disabled={busy || pdfUnready || pdf.busy} onClick={save}>
                  Simpan perubahan
                </Button>
              )}
              {editor?.item && (
                <Button disabled={busy || pdfUnready || pdf.busy} onClick={preview}>
                  {editor.editPublished ? "Tinjau perubahan" : "Tinjau katalog"}
                </Button>
              )}
            </>
          ) : (
            <>
              <Box sx={{ mr: { sm: "auto" } }}>
                <Button disabled={busy || pdf.busy} onClick={closeEditor}>
                  Batal
                </Button>
              </Box>
              {!editor?.editPublished && (
                <Button
                  type={editor?.item ? "default" : "primary"}
                  disabled={pdfUnready || pdf.busy}
                  loading={busy}
                  onClick={save}
                >
                  {editor?.item ? "Simpan perubahan" : "Simpan draft"}
                </Button>
              )}
              {editor?.item && (
                <Button disabled={busy || pdfUnready || pdf.busy} type="primary" onClick={preview}>
                  {editor.editPublished ? "Tinjau perubahan" : "Tinjau katalog"}
                </Button>
              )}
            </>
          )
        }
      >
        {error && (
          <AppNotice
            tone="danger"
            title="Perubahan belum diproses"
            description={error}
            action={
              yearConflict && (
                <Button disabled={busy} onClick={openExisting}>
                  {yearConflict.status === "draft" ? "Buka draft" : "Lihat katalog terbit"}
                </Button>
              )
            }
            sx={{ mb: 3 }}
          />
        )}
        {editor && !editor.readOnly && (
          <Box sx={{ display: pdfStage ? "block" : "none" }}>
            <HolidayPdfStage
              key={editor.key}
              active={pdfStage}
              importer={pdf}
              year={form.getFieldValue("year")}
              previous={form.getFieldValue("days") || []}
              onReady={setPdfReady}
              onUse={async (candidate) => {
                const parsed = catalogMutation.safeParse(
                  {
                    ...candidate,
                    operation: editor.editPublished ? "edit_published" : "save",
                    requestKey: editor.key,
                    ...(editor.item ? { id: editor.item.id, version: editor.item.version } : {}),
                  },
                  { error: scheduleValidationMessage },
                );
                if (!parsed.success) {
                  setError(parsed.error.issues.map((i) => i.message).join(" "));
                  return;
                }
                form.setFieldsValue({
                  year: parsed.data.year,
                  decisionNumber: parsed.data.decisionNumber,
                  sourceUrl: parsed.data.sourceUrl,
                  days: parsed.data.days,
                });
                setPdfReference({ id: parsed.data.pdfImportId, reviewed: true });
                setPdfStage(false);
                setError("");
              }}
            />
          </Box>
        )}
        {!pdfStage && sourcePreview && (
          <HolidaySourcePreview
            candidate={sourcePreview.candidate}
            previous={sourcePreview.previous}
          />
        )}
        {!pdfStage && sourcePreview && pdfReference && (
          <AppNotice tone="warning" title="Referensi PDF tetap disertakan">
            <Button
              icon={<EyeOutlined />}
              href={`/api/system/holiday-catalogs/pdf-imports/${pdfReference.id}/document`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginBottom: 12 }}
            >
              Lihat PDF sumber
            </Button>
            <Checkbox
              checked={pdfReference.reviewed}
              onChange={(e) => setPdfReference((r) => ({ ...r, reviewed: e.target.checked }))}
            >
              Saya sudah mencocokkan hasil sumber API dengan PDF SKB referensi yang tersimpan.
            </Checkbox>
          </AppNotice>
        )}
        {!pdfStage && !sourcePreview && (review || editor?.readOnly) ? (
          <Box sx={{ display: "grid", gap: 3 }}>
            <Box sx={{ display: "grid", gap: 0.5, minWidth: 0 }}>
              <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 2 }}>
                <FontStyle fontWeight={600}>Katalog {review?.year || editor.item.year}</FontStyle>
                {(review ? review.sourceUrl : editor.item.source_url) && (
                  <FontStyle component="span">
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href={review ? review.sourceUrl : editor.item.source_url}
                    >
                      Lihat SKB resmi
                    </a>
                  </FontStyle>
                )}
              </Box>
              <FontStyle color="text.secondary">
                Nomor SKB {review?.decisionNumber || editor.item.decision_number}
              </FontStyle>
            </Box>
            <CatalogDocument catalog={editor?.item} />
            {review && !editor?.editPublished && !reviewedSaved && (
              <AppNotice
                tone="warning"
                title="Ada perubahan yang belum disimpan"
                description="Kembali ke draft dan simpan sebelum menerbitkan."
              />
            )}
            <HolidayDateList
              days={(review?.days || editor.item.days).map((d, i) => ({
                ...d,
                id: d.id || String(i),
              }))}
            />
          </Box>
        ) : null}
        <Box
          sx={{
            display: pdfStage || review || editor?.readOnly || sourcePreview ? "none" : "block",
          }}
        >
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onValuesChange={() => {
              if (pdfReference) setPdfReference((r) => ({ ...r, reviewed: false }));
            }}
          >
            <FormSection first title="Cara pengisian">
              <CatalogEntryMethod
                value={entryMethod}
                onChange={setEntryMethod}
                disabled={busy || pdf.busy}
              />
            </FormSection>
            <FormSection
              title="Tahun katalog"
              description="Menentukan tahun data otomatis dan tanggal pada katalog."
            >
              <Form.Item
                name="year"
                style={{ marginBottom: 0 }}
                rules={[{ required: true, message: "Isi tahun katalog." }]}
              >
                <AppYearPicker
                  aria-label="Tahun katalog"
                  disabled={Boolean(editor?.item) || Boolean(pdf.file) || Boolean(pdfReference)}
                  minYear={new Date().getFullYear()}
                />
              </Form.Item>
              {pdf.file && !editor?.item && (
                <FontStyle color="text.secondary" sx={{ mt: 1 }}>
                  Hapus pilihan PDF terlebih dahulu untuk mengganti tahun.
                </FontStyle>
              )}
            </FormSection>
            {entryMethod === "automatic" && (
              <FormSection title="Data otomatis" divider={false}>
                <AppNotice
                  title="Ambil data setahun"
                  description={
                    editor?.item
                      ? "Ambil data terbaru untuk mengganti isian tanggal di form ini. Periksa dan koreksi sebelum menyimpan."
                      : "Pilih Ambil data terbaru, lalu periksa tanggal dan kategori terhadap SKB sebelum menyimpan draft."
                  }
                />
              </FormSection>
            )}
            <Box sx={{ display: entryMethod === "manual" ? "block" : "none" }}>
              <FormSection
                title="Dokumen SKB"
                description="Unggah PDF referensi. Isian tanggal tetap dapat diisi sendiri."
              >
                <HolidayPdfSource
                  importer={pdf}
                  savedCatalog={editor?.item}
                  disabled={busy}
                  onSelect={async (file) => {
                    try {
                      await form.validateFields(["year"]);
                      setError("");
                      if (pdfReference) setPdfReference((r) => ({ ...r, reviewed: false }));
                      await pdf.upload(file);
                    } catch {
                      setError("Isi tahun katalog sebelum mengunggah PDF.");
                    }
                  }}
                  onRemove={() => {
                    pdf.reset();
                    const prior = editor?.item;
                    setPdfReference(
                      prior?.pdf_import_id ? { id: prior.pdf_import_id, reviewed: false } : null,
                    );
                  }}
                  onReview={() => {
                    setError("");
                    setPdfStage(true);
                  }}
                />
              </FormSection>
              <FormSection
                title="Identitas keputusan"
                description="Salin nomor keputusan dari SKB yang menjadi acuan."
              >
                <Box sx={{ display: "grid", gap: 2, "& .ant-form-item": { mb: 0 } }}>
                  <Form.Item
                    name="decisionNumber"
                    label="Nomor keputusan"
                    rules={[{ required: true, message: "Isi nomor keputusan." }]}
                  >
                    <Input maxLength={200} placeholder="Nomor SKB tiga menteri" />
                  </Form.Item>
                  <Form.Item
                    name="sourceUrl"
                    label={pdfReference ? "Tautan sumber resmi (opsional)" : "Tautan sumber resmi"}
                    rules={[
                      {
                        required: !pdfReference,
                        message: "Isi tautan sumber resmi atau unggah PDF SKB.",
                      },
                    ]}
                  >
                    <Input maxLength={1000} placeholder="https://…go.id/…" />
                  </Form.Item>
                </Box>
              </FormSection>
            </Box>
            <Box sx={{ display: entryMethod === "manual" || editor?.item ? "block" : "none" }}>
              <FormSection
                title="Tanggal hari libur"
                description="Isi tanggal, nama dan kategori sesuai keputusan resmi."
                divider={false}
              >
                <HolidayDayFields year={selectedYear} validationFailure={validationFailure} />
              </FormSection>
              {pdfReference && (
                <FormSection title="Pemeriksaan dokumen" divider={false}>
                  <Checkbox
                    checked={pdfReference.reviewed}
                    disabled={pdfUnready || busy}
                    onChange={(e) => setPdfReference((r) => ({ ...r, reviewed: e.target.checked }))}
                  >
                    Saya sudah mengisi seluruh tanggal dengan lengkap dan mencocokkan nama serta
                    kategorinya dengan PDF SKB.
                  </Checkbox>
                </FormSection>
              )}
            </Box>
          </Form>
        </Box>
      </AppModal>
      <ConfirmDialog
        open={confirm}
        title="Terbitkan katalog?"
        description="Katalog terbit tidak dapat ditimpa."
        message="HRD dapat memilih tanggal dari katalog ini. Kalender organisasi yang sudah ada tidak berubah otomatis."
        confirmText="Terbitkan katalog"
        loading={busy}
        onClose={() => setConfirm(false)}
        onConfirm={publish}
      />
      <Notification {...notification} onClose={closeNotification} />
      {deletion.dialog}
    </Box>
  );
}
