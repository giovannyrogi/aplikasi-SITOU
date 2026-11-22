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
            eligibleGender: item.eligible_gender,
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
            eligibleGender: "all",
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
            <Col xs={24}>
              <OrganizationScopeField disabled={editing} />
            </Col>
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
                    leave:
                      "Untuk cuti tahunan atau cuti khusus, seperti cuti melahirkan.",
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
                  { required: true, message: "Pilih kelompok pegawai yang dapat menggunakan cuti atau izin ini." },
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
                >
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
                </FormSettingSwitch>
                <FormSettingSwitch
                  name="requiresAttachment"
                  title="Wajib unggah dokumen"
                  description="Jika aktif, dokumen pendukung wajib diunggah sebelum cuti atau izin dapat disetujui."
                >
                  <Form.Item
                    name="requiredAttachmentCategory"
                    label="Jenis dokumen wajib"
                    extra="Pilih dokumen yang harus dilampirkan pada cuti atau izin ini."
                    rules={[{ required: true, message: "Pilih jenis dokumen wajib." }]}
                  >
                    <Select
                      options={[
                        { value: "medical_letter", label: "Surat dokter" },
                        { value: "leave_attachment", label: "Dokumen pendukung lainnya" },
                      ]}
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
