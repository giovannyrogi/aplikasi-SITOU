"use client";
import { useEffect } from "react";
import { Button, Col, Form, Input, InputNumber, Row, Select } from "antd";
import AppModal from "@/app/components/modals/AppModal";
import OrganizationScopeField from "@/app/components/forms/OrganizationScopeField";
import FormSettingSwitch, { FormSettingsGroup } from "@/app/components/forms/FormSettingSwitch";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import useFormModalClose from "@/app/hooks/useFormModalClose";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { readApiResponse } from "@/lib/api/clientError";
import FileUploadListField from "@/app/components/forms/FileUploadListField";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import { DownloadOutlined } from "@ant-design/icons";
import { Box } from "@mui/material";

export default function LeaveTypeForm({
  open,
  item,
  presetOrganizationId,
  onClose,
  onSaved,
  onError,
}) {
  const [form] = Form.useForm();
  const closeGuard = useFormModalClose(form, onClose);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const editing = Boolean(item);
  const category = Form.useWatch("category", form);
  const unit = Form.useWatch("unit", form);
  const documentKind = Form.useWatch("requiredAttachmentCategory", form);
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(
      item
        ? {
            organizationId: item.organization_id,
            name: item.name,
            category: item.category,
            unit: item.unit,
            eligibleGender: item.eligible_gender,
            requiresAttachment: item.requires_attachment,
            requiredAttachmentCategory: item.required_attachment_category,
            templateFileId: item.template_file_id,
            attachmentLabel:
              item.attachment_label ||
              (item.required_attachment_category === "leave_attachment"
                ? "Dokumen pendukung"
                : null),
            documentInstructions: item.document_instructions,
            templateFiles: [],
            usesBalance: item.uses_balance,
            annualAllowance: item.annual_allowance,
            isActive: item.is_active,
          }
        : {
            organizationId: presetOrganizationId,
            category: "leave",
            unit: "day",
            eligibleGender: "all",
            requiresAttachment: false,
            usesBalance: true,
            isActive: true,
          },
    );
  }, [form, item, open, presetOrganizationId]);
  const submit = async (values) => {
    try {
      const { templateFiles = [], ...settings } = values;
      if (
        settings.requiresAttachment &&
        settings.requiredAttachmentCategory === "organization_form" &&
        !settings.templateFileId &&
        !templateFiles.length
      ) {
        form.setFields([
          { name: "templateFiles", errors: ["Unggah template PDF formulir organisasi."] },
        ]);
        return;
      }
      const data = new FormData();
      data.append(
        "payload",
        JSON.stringify({
          ...settings,
          ...(editing ? { version: new Date(item.updated_at).toISOString() } : {}),
        }),
      );
      if (
        settings.requiresAttachment &&
        settings.requiredAttachmentCategory === "organization_form" &&
        templateFiles[0]?.localFile
      )
        data.append("file", templateFiles[0].localFile);
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(
            editing ? `/api/leave-types/${item.id}` : "/api/leave-types",
            {
              method: editing ? "PATCH" : "POST",
              body: data,
            },
          );
          const body = await readApiResponse(response);
          await onSaved(body.message);
        },
        { message: "Menyimpan aturan cuti dan izin..." },
      );
    } catch (error) {
      if (error.fieldErrors)
        form.setFields(
          Object.entries(error.fieldErrors).map(([name, message]) => ({ name, errors: [message] })),
        );
      onError(error.message);
    }
  };
  return (
    <>
      <AppModal
        open={open}
        onClose={closeGuard.requestClose}
        title={editing ? "Ubah aturan cuti & izin" : "Tambah aturan cuti & izin"}
        description="Atur kelompok, pegawai yang dapat menggunakan, jatah, dan dokumen."
        icon="solar:calendar-add-bold-duotone"
        size="lg"
        footer={
          <>
            <Button onClick={closeGuard.requestClose}>Batal</Button>
            <Button type="primary" onClick={() => form.submit()}>
              Simpan aturan
            </Button>
          </>
        }
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Row gutter={[16, 4]}>
            <OrganizationScopeField hideLocked colProps={{ xs: 24 }} disabled={editing} />
            <Col xs={24}>
              <Form.Item
                name="name"
                label="Nama cuti atau izin"
                rules={[
                  { required: true, message: "Isi nama cuti atau izin." },
                  { min: 3, message: "Nama cuti atau izin minimal 3 karakter." },
                ]}
              >
                <Input maxLength={100} placeholder="Contoh: Cuti tahunan atau Izin kedukaan" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="category"
                label="Kategori cuti atau izin"
                rules={[{ required: true, message: "Pilih kategori cuti atau izin." }]}
                extra={
                  {
                    leave: "Untuk cuti tahunan atau cuti khusus, seperti cuti melahirkan.",
                    permission: "Izin selain sakit, misalnya kedukaan atau keperluan keluarga.",
                    sick: "Untuk ketidakhadiran karena sakit. Kewajiban surat dokter diatur pada Wajib unggah dokumen.",
                    official_duty: "Penugasan resmi di luar lokasi kerja biasa.",
                    other: "Pilih jika cuti atau izin ini tidak termasuk dalam kategori lainnya.",
                  }[category]
                }
              >
                <Select
                  options={[
                    { value: "leave", label: "Cuti" },
                    { value: "permission", label: "Izin" },
                    { value: "sick", label: "Sakit" },
                    { value: "official_duty", label: "Dinas luar" },
                    { value: "other", label: "Lainnya" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="unit"
                label="Satuan durasi"
                extra="Pilih apakah lama cuti atau izin dihitung dalam hari atau jam."
                rules={[{ required: true, message: "Pilih satuan durasi." }]}
              >
                <Select
                  options={[
                    { value: "day", label: "Hari" },
                    { value: "hour", label: "Jam" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                name="eligibleGender"
                label="Pegawai yang dapat menggunakan"
                extra="Batasi berdasarkan jenis kelamin, atau pilih Semua pegawai. Pilihan cuti atau izin hanya tersedia bagi pegawai yang sesuai."
                rules={[
                  {
                    required: true,
                    message: "Pilih kelompok pegawai yang dapat menggunakan cuti atau izin ini.",
                  },
                ]}
              >
                <Select
                  options={[
                    { value: "all", label: "Semua pegawai" },
                    { value: "male", label: "Pegawai laki-laki" },
                    { value: "female", label: "Pegawai perempuan" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <FormSettingsGroup sx={{ mt: 1 }}>
                <FormSettingSwitch
                  name="usesBalance"
                  title="Kurangi jatah pegawai"
                  description="Jika aktif, cuti atau izin yang disetujui mengurangi saldo jatah pegawai. Nonaktifkan jika cuti atau izin ini tidak menggunakan jatah."
                  fullWidthChildren
                >
                  <Row gutter={[16, 0]}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        name="annualAllowance"
                        label={`Jatah tahunan (${unit === "hour" ? "jam" : "hari"})`}
                        extra="Jumlah jatah awal untuk satu tahun kalender. Nilai ini menjadi acuan saat saldo tahunan pegawai dibuat."
                        rules={[{ required: true, message: "Isi jumlah jatah tahunan." }]}
                      >
                        <InputNumber
                          min={1}
                          step={1}
                          precision={0}
                          placeholder="Contoh: 12"
                          style={{ width: "100%" }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </FormSettingSwitch>
                <FormSettingSwitch
                  name="requiresAttachment"
                  title="Wajib unggah dokumen"
                  description="Jika aktif, dokumen pendukung wajib diunggah sebelum cuti atau izin dapat disetujui."
                  fullWidthChildren
                >
                  <Row gutter={[16, 0]}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        name="requiredAttachmentCategory"
                        label="Jenis dokumen wajib"
                        extra="Pilih dokumen yang harus dilampirkan pada cuti atau izin ini."
                        rules={[{ required: true, message: "Pilih jenis dokumen wajib." }]}
                      >
                        <AsyncSelect
                          options={[
                            { value: "medical_letter", label: "Surat dokter" },
                            { value: "organization_form", label: "Formulir organisasi" },
                            { value: "leave_attachment", label: "Dokumen pendukung lainnya" },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  {documentKind === "organization_form" && (
                    <>
                      <Form.Item name="templateFileId" hidden>
                        <Input />
                      </Form.Item>
                      {item?.template_file_id && (
                        <Box sx={{ mb: 2, "& .ant-btn": { width: { xs: "100%", sm: "auto" } } }}>
                          <Button
                            icon={<DownloadOutlined />}
                            data-action-tone="download"
                            href={`/api/leave-types/files/${item.template_file_id}?organizationId=${item.organization_id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Unduh template tersimpan
                          </Button>
                        </Box>
                      )}
                      <Form.Item
                        name="templateFiles"
                        label="Template formulir PDF"
                        style={{ marginTop: 16 }}
                      >
                        <FileUploadListField
                          fullWidth
                          maxCount={1}
                          accept="application/pdf,.pdf"
                          maxSizeBytes={10 * 1024 * 1024}
                          onError={onError}
                          helpText="Satu PDF maksimal 10 MB. Template disimpan bersama aturan."
                        />
                      </Form.Item>
                    </>
                  )}
                  {documentKind === "leave_attachment" && (
                    <Form.Item
                      name="attachmentLabel"
                      label="Nama dokumen"
                      rules={[{ required: true, message: "Isi nama dokumen." }]}
                    >
                      <Input maxLength={100} />
                    </Form.Item>
                  )}
                  <Form.Item
                    name="documentInstructions"
                    label="Petunjuk dokumen"
                    rules={[
                      {
                        required: documentKind === "organization_form",
                        message: "Isi petunjuk pengisian formulir.",
                      },
                    ]}
                  >
                    <Input.TextArea
                      rows={3}
                      maxLength={2000}
                      placeholder="Jelaskan dokumen dan tanda tangan yang harus dilengkapi."
                    />
                  </Form.Item>
                </FormSettingSwitch>
              </FormSettingsGroup>
              <FormSettingSwitch
                name="isActive"
                notice={{
                  on: {
                    title: "Tersedia untuk digunakan",
                    description: "Cuti atau izin ini dapat dipilih saat HRD menambahkan data baru.",
                  },
                  off: {
                    title: "Tidak tersedia untuk digunakan",
                    description:
                      "Cuti atau izin ini tidak dapat dipilih untuk data baru. Riwayat yang sudah tersimpan tetap tersedia.",
                  },
                }}
              />
            </Col>
          </Row>
        </Form>
      </AppModal>
      <ConfirmDialog
        open={closeGuard.confirmCloseOpen}
        title="Buang perubahan?"
        message="Perubahan aturan cuti atau izin belum disimpan."
        confirmText="Buang perubahan"
        danger
        onClose={closeGuard.keepEditing}
        onConfirm={closeGuard.discardChanges}
      />
    </>
  );
}
