"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Collapse, Empty, Steps } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import AppModal from "@/app/components/modals/AppModal";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FileUploadField from "@/app/components/forms/FileUploadField";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { EMPLOYEE_IMPORT_SHEET_GUIDANCE } from "@/lib/employees/importDefinition";

const ENTITY_LABELS = {
  employee: "profil",
  contact: "kontak",
  identifier: "identitas",
  bank_account: "rekening",
  dependent: "keluarga",
  emergency_contact: "kontak darurat",
  social_account: "akun sosial",
  education: "pendidikan",
  skill: "keahlian",
  certification: "sertifikasi",
  contract: "kontrak",
  assignment: "penempatan",
};

const REQUIREMENT_TONES = {
  required: "danger",
  conditional: "warning",
  optional: "info",
};

/** Modal import memandu validasi dan commit Excel tanpa menulis data saat preview. */
export default function EmployeeImportModal({
  open,
  organizationId,
  onClose,
  onCommitted,
  onError,
}) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [batch, setBatch] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const query = organizationId ? `?organizationId=${organizationId}` : "";
  const invalidGroups = useMemo(
    () =>
      batch?.groups?.filter((group) => group.status !== "valid" && group.status !== "committed") ||
      [],
    [batch],
  );

  /** Menutup modal sekaligus menghapus file dan preview lama dari state browser. */
  const close = () => {
    setStep(0);
    setFile(null);
    setBatch(null);
    setConfirmOpen(false);
    onClose();
  };

  /** Mengunggah workbook untuk validasi server tanpa melakukan commit data final. */
  const validate = async () => {
    if (!file) return onError("Pilih file Excel terlebih dahulu.");
    setStep(1);
    try {
      await runWithLoadingBackdrop(
        async () => {
          const form = new FormData();
          form.append("file", file);
          if (organizationId) form.append("organizationId", organizationId);
          const response = await fetch("/api/employees/imports", { method: "POST", body: form });
          const body = await response.json();
          if (!response.ok) throw new Error(body.message);
          setBatch(body.data);
          setStep(2);
        },
        { message: "Memeriksa workbook dan seluruh referensi data..." },
      );
    } catch (error) {
      setStep(0);
      onError(error.message);
    }
  };

  /** Commit hanya dijalankan setelah pengguna memahami pegawai invalid akan dilewati. */
  const commit = async () => {
    setConfirmOpen(false);
    setStep(3);
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(`/api/employees/imports/${batch.id}/commit${query}`, {
            method: "POST",
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.message);
          setBatch(body.data);
          await onCommitted(
            `${body.data.committed_employees} pegawai berhasil diimpor. Foto dan dokumen dapat dilengkapi melalui detail pegawai.`,
          );
        },
        { message: "Menyimpan data lengkap setiap pegawai..." },
      );
    } catch (error) {
      setStep(2);
      onError(error.message);
    }
  };

  /** Footer menjaga satu tindakan utama sesuai tahap import aktif. */
  const footer = (
    <>
      <Button onClick={close}>Tutup</Button>
      {step === 0 ? (
        <Button type="primary" disabled={!file} onClick={validate}>
          Validasi file
        </Button>
      ) : null}
      {step === 2 ? (
        <Button
          type="primary"
          disabled={!Number(batch?.valid_employees)}
          onClick={() => setConfirmOpen(true)}
        >
          Impor {batch?.valid_employees || 0} pegawai valid
        </Button>
      ) : null}
    </>
  );

  return (
    <>
      <AppModal
        open={open}
        title="Import data pegawai"
        description="Unggah Excel, periksa hasil validasi, lalu impor pegawai yang siap disimpan."
        icon="solar:document-add-bold-duotone"
        size="xl"
        onClose={close}
        disableClose={step === 1 || step === 3}
        footer={footer}
      >
        <Steps
          current={step}
          responsive
          size="small"
          items={[
            { title: "Pilih Excel" },
            { title: "Validasi" },
            { title: "Periksa hasil" },
            { title: "Impor" },
          ]}
        />

        {step === 0 ? (
          <Box sx={{ mt: 3 }}>
            <Alert
              type="info"
              showIcon
              title="Import hanya membuat pegawai baru"
              description="Data pegawai yang memiliki NIP atau NIK sama akan ditolak. NIK wajib berisi 16 digit."
            />
            <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
              <Button icon={<DownloadOutlined />} href={`/api/employees/imports/template${query}`}>
                Unduh template Excel
              </Button>
            </Box>
            <Box sx={{ mt: 2 }}>
              <FileUploadField
                value={file}
                accept=".xlsx"
                maxSizeBytes={10 * 1024 * 1024}
                emptyTitle="Pilih atau tarik file Excel ke area ini"
                helpText="Maksimal 10 MB. Nama sheet dan judul kolom tidak boleh diubah."
                selectedText="File terpilih dan siap divalidasi"
                onSelect={(next) => {
                  setFile(next);
                  setBatch(null);
                }}
                onRemove={() => {
                  setFile(null);
                  setBatch(null);
                }}
                onError={onError}
              />
            </Box>
            <Collapse
              style={{ marginTop: 16 }}
              items={[
                {
                  key: "sheet-guide",
                  label: "Sheet wajib dan opsional",
                  children: (
                    <Box>
                      <FontStyle fontSize={12.5} sx={{ lineHeight: 1.7, mb: 1.5 }}>
                        Sheet yang tidak dibutuhkan boleh dibiarkan kosong. Perhatikan status dan
                        syarat pengisian berikut sebelum mengunggah file.
                      </FontStyle>
                      {EMPLOYEE_IMPORT_SHEET_GUIDANCE.map((guidance) => (
                        <Box
                          key={guidance.name}
                          sx={{
                            py: 1.5,
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", sm: "150px minmax(0, 1fr)" },
                            gap: { xs: 1, sm: 2 },
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            "&:last-child": { borderBottom: 0, pb: 0 },
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 1,
                              flexWrap: "wrap",
                            }}
                          >
                            <FontStyle fontSize={12.5} fontWeight={700}>
                              {guidance.name}
                            </FontStyle>
                            <CompactInfoChip
                              label={guidance.requirementLabel}
                              tone={REQUIREMENT_TONES[guidance.requirement]}
                            />
                          </Box>
                          <Box>
                            <FontStyle fontSize={12.5} sx={{ lineHeight: 1.65 }}>
                              {guidance.purpose} {guidance.whenToFill}
                            </FontStyle>
                            <FontStyle
                              fontSize={12}
                              sx={{ mt: 0.5, lineHeight: 1.6, color: theme.ui.mutedText }}
                            >
                              {guidance.importantRule}
                            </FontStyle>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  ),
                },
                {
                  key: "sheets",
                  label: "Cara mengisi template dengan benar",
                  children: (
                    <Box component="ol" sx={{ m: 0, pl: 2.5, display: "grid", gap: 1 }}>
                      {[
                        "Isi sheet Pegawai terlebih dahulu. Satu baris hanya untuk satu pegawai baru.",
                        "Gunakan NIP yang sama pada seluruh sheet yang berkaitan dengan pegawai tersebut.",
                        "Untuk pegawai berstatus aktif, masa percobaan, atau cuti (active, probation, atau leave), isi minimal satu kontrak yang berlaku dan satu penempatan utama yang berlaku.",
                        "Ambil kode lokasi, Divisi & Unit, jabatan, dan jenis kepegawaian dari sheet Referensi. Jangan mengetik nama sebagai pengganti kode.",
                        "Gunakan format tanggal YYYY-MM-DD dan gunakan YA atau TIDAK pada kolom pilihan.",
                        "Hapus semua baris CONTOH-001 dari setiap sheet sebelum file diunggah.",
                        "Jangan mengubah nama sheet, judul kolom, atau menambahkan formula pada cell.",
                      ].map((instruction) => (
                        <Box component="li" key={instruction} sx={{ pl: 0.5 }}>
                          <FontStyle fontSize={12.5} sx={{ lineHeight: 1.65 }}>
                            {instruction}
                          </FontStyle>
                        </Box>
                      ))}
                    </Box>
                  ),
                },
                {
                  key: "after-import",
                  label: "Yang dilakukan setelah import berhasil",
                  children: (
                    <Box sx={{ display: "grid", gap: 1 }}>
                      <FontStyle fontSize={12.5} sx={{ lineHeight: 1.7 }}>
                        Periksa kembali profil, kontrak, dan penempatan pegawai melalui detail
                        pegawai. Import Excel tidak membuat akun login dan tidak mengunggah file.
                      </FontStyle>
                      <FontStyle fontSize={12.5} sx={{ lineHeight: 1.7 }}>
                        Pas foto, scan identitas, sertifikat, kontrak bertanda tangan, dan dokumen
                        lain dilengkapi manual pada detail pegawai agar file tetap tersimpan secara
                        privat dan terhubung ke data yang benar.
                      </FontStyle>
                    </Box>
                  ),
                },
              ]}
            />
          </Box>
        ) : null}

        {step === 1 || step === 3 ? (
          <Box sx={{ mt: 4, minHeight: 220, display: "grid", placeItems: "center" }}>
            <FontStyle sx={{ color: theme.ui.mutedText }}>
              {step === 1 ? "Memvalidasi seluruh data..." : "Mengimpor pegawai valid..."}
            </FontStyle>
          </Box>
        ) : null}

        {step === 2 && batch ? (
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              <CompactInfoChip label={`${batch.total_employees} pegawai`} tone="info" />
              <CompactInfoChip label={`${batch.valid_employees} siap diimpor`} tone="success" />
              <CompactInfoChip
                label={`${batch.invalid_employees} perlu diperbaiki`}
                tone={Number(batch.invalid_employees) ? "danger" : "neutral"}
              />
            </Box>
            {invalidGroups.length ? (
              <Alert
                style={{ marginTop: 16 }}
                type="warning"
                showIcon
                title="Sebagian pegawai belum dapat diimpor"
                description="Pegawai tersebut akan dilewati. Perbaiki file berdasarkan pesan di bawah, lalu import kembali sebagai batch baru."
                action={
                  <Button size="small" href={`/api/employees/imports/${batch.id}/errors${query}`}>
                    Unduh laporan kesalahan
                  </Button>
                }
              />
            ) : (
              <Alert
                style={{ marginTop: 16 }}
                type="success"
                showIcon
                title="Seluruh pegawai siap diimpor"
              />
            )}
            <Box
              sx={{
                mt: 2,
                display: "grid",
                gap: 1.5,
                maxHeight: mobile ? 360 : 440,
                overflowY: "auto",
              }}
            >
              {(batch.groups || []).map((group) => (
                <Box
                  key={group.employeeNo}
                  sx={{
                    p: 2,
                    border: `1px solid ${group.status === "valid" ? theme.status.success.border : theme.status.danger.border}`,
                    borderRadius: 2,
                    bgcolor:
                      group.status === "valid"
                        ? theme.status.success.background
                        : theme.status.danger.background,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 1,
                      flexWrap: "wrap",
                    }}
                  >
                    <FontStyle fontWeight={700}>{group.employeeNo}</FontStyle>
                    <CompactInfoChip
                      label={group.status === "valid" ? "Siap diimpor" : "Perlu diperbaiki"}
                      tone={group.status === "valid" ? "success" : "danger"}
                    />
                  </Box>
                  <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                    {Object.entries(group.counts || {}).map(([entity, count]) => (
                      <CompactInfoChip
                        key={entity}
                        label={`${count} ${ENTITY_LABELS[entity] || entity}`}
                        tone="neutral"
                      />
                    ))}
                  </Box>
                  {group.errors.map((error, index) => (
                    <FontStyle
                      key={`${error.sheetName}-${error.rowNumber}-${index}`}
                      fontSize={12}
                      sx={{ mt: 1, color: theme.status.danger.text, lineHeight: 1.6 }}
                    >
                      {group.employeeNo} &gt; {error.sheetName} &gt; Baris {error.rowNumber}:{" "}
                      {error.message}
                    </FontStyle>
                  ))}
                </Box>
              ))}
              {!batch.groups?.length ? (
                <Empty description="Tidak ada data yang dapat ditampilkan." />
              ) : null}
            </Box>
          </Box>
        ) : null}
      </AppModal>
      <ConfirmDialog
        open={confirmOpen}
        title="Impor pegawai valid?"
        message={
          Number(batch?.invalid_employees)
            ? `${batch.valid_employees} pegawai akan diimpor. ${batch.invalid_employees} pegawai bermasalah akan dilewati dan dapat diimpor kembali setelah diperbaiki.`
            : `${batch?.valid_employees || 0} pegawai akan disimpan beserta seluruh data terkait yang sudah lolos validasi.`
        }
        confirmText="Impor pegawai valid"
        onConfirm={commit}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
