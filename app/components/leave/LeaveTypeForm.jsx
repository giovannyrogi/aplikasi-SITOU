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
            requiresAttachment: item.requires_attachment,
            requiredAttachmentCategory: item.required_attachment_category,
            usesBalance: item.uses_balance,
            annualAllowance: item.annual_allowance,
            isActive: item.is_active,
          }
        : {
            organizationId: presetOrganizationId,
            category: "leave",
            unit: "day",
            requiresAttachment: false,
            usesBalance: true,
            isActive: true,
          },
    );
  }, [form, item, open, presetOrganizationId]);
  const submit = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(
            editing ? `/api/leave-types/${item.id}` : "/api/leave-types",
            {
              method: editing ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...values,
                ...(editing ? { version: new Date(item.updated_at).toISOString() } : {}),
              }),
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
        description="Atur kelompok, satuan, saldo, dan kebutuhan dokumen."
        icon="solar:calendar-add-bold-duotone"
        size="lg"
        footer={
          <>
            <Button onClick={closeGuard.requestClose}>Batal</Button>
            <Button type="primary" onClick={() => form.submit()}>
              Simpan
            </Button>
          </>
        }
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Row gutter={[16, 4]}>
            <Col xs={24}>
              <OrganizationScopeField disabled={editing} />
            </Col>
            <Col xs={24}>
              <Form.Item
                name="name"
                label="Nama cuti atau izin"
                rules={[{ required: true, message: "Nama cuti atau izin wajib diisi." }]}
              >
                <Input placeholder="Contoh: Cuti tahunan atau Izin kedukaan" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="category"
                label="Kelompok"
                rules={[{ required: true, message: "Kelompok wajib dipilih." }]}
                extra={
                  {
                    leave:
                      "Cuti untuk hak tidak masuk kerja, misalnya cuti tahunan atau cuti khusus.",
                    permission: "Izin selain sakit, misalnya kedukaan atau keperluan keluarga.",
                    sick: "Ketidakhadiran karena kondisi kesehatan; dapat mewajibkan surat dokter.",
                    official_duty: "Penugasan resmi di luar lokasi kerja biasa.",
                    other: "Gunakan hanya bila jenis tidak cocok dengan kelompok lainnya.",
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
                label="Dihitung dalam"
                rules={[{ required: true, message: "Pilih satuan perhitungan." }]}
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
              <FormSettingsGroup sx={{ mt: 1 }}>
                <FormSettingSwitch
                  name="usesBalance"
                  title="Kurangi jatah pegawai"
                  description="Aktifkan untuk cuti atau izin yang memakai jatah tahunan pegawai, seperti cuti tahunan."
                >
                  <Form.Item
                    name="annualAllowance"
                    label={`Jatah yang diberikan setiap tahun (${unit === "hour" ? "jam" : "hari"})`}
                    extra="Jatah awal yang otomatis diberikan kepada setiap pegawai untuk satu tahun kalender."
                    rules={[{ required: true, message: "Jatah tahunan wajib diisi." }]}
                  >
                    <InputNumber
                      min={1}
                      step={1}
                      precision={0}
                      placeholder="Contoh: 12"
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </FormSettingSwitch>
                <FormSettingSwitch
                  name="requiresAttachment"
                  title="Dokumen harus diunggah"
                  description="Aktifkan jika pencatatan baru hanya boleh disetujui setelah dokumen pendukung dilengkapi."
                >
                  <Form.Item
                    name="requiredAttachmentCategory"
                    label="Dokumen yang harus dilengkapi"
                    rules={[{ required: true, message: "Pilih dokumen yang diwajibkan." }]}
                  >
                    <Select
                      options={[
                        { value: "medical_letter", label: "Surat dokter" },
                        { value: "leave_attachment", label: "Dokumen pendukung lainnya" },
                      ]}
                    />
                  </Form.Item>
                </FormSettingSwitch>
                <FormSettingSwitch
                  name="isActive"
                  title="Tersedia untuk digunakan"
                  description="Aktifkan agar pilihan ini muncul saat HRD mencatat cuti atau izin baru."
                />
              </FormSettingsGroup>
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
