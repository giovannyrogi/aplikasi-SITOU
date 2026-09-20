"use client";

import { useEffect } from "react";
import { Button, Col, Form, Input, InputNumber, Row, Select } from "antd";
import AppModal from "@/app/components/modals/AppModal";
import OrganizationScopeField from "@/app/components/forms/OrganizationScopeField";
import FormSettingSwitch, { FormSettingsGroup } from "@/app/components/forms/FormSettingSwitch";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import useFormModalClose from "@/app/hooks/useFormModalClose";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { readApiResponse } from "@/lib/api/clientError";

const presetOf = (item) => {
  if (!item || item.duration_mode === "indefinite") return "indefinite";
  if (item.duration_unit === "month" && [1, 3, 6, 12].includes(item.duration_value))
    return `${item.duration_value}-month`;
  return "custom";
};

export default function DisciplinaryActionTypeForm({
  open,
  item,
  presetOrganizationId,
  onClose,
  onSaved,
  onError,
}) {
  const [form] = Form.useForm();
  const user = useAuthenticatedUser();
  const closeGuard = useFormModalClose(form, onClose);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const editing = Boolean(item);
  const preset = Form.useWatch("durationPreset", form);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(
      item
        ? {
            organizationId: item.organization_id,
            name: item.name,
            durationPreset: presetOf(item),
            customDurationValue: item.duration_value,
            customDurationUnit: item.duration_unit || "month",
            requiresDocument: item.requires_document,
            isActive: item.is_active,
          }
        : {
            organizationId: presetOrganizationId,
            durationPreset: "3-month",
            customDurationUnit: "month",
            requiresDocument: true,
            isActive: true,
          },
    );
  }, [form, item, open, presetOrganizationId]);

  const submit = async (values) => {
    const indefinite = values.durationPreset === "indefinite";
    const custom = values.durationPreset === "custom";
    const presetMonths = indefinite || custom ? null : Number(values.durationPreset.split("-")[0]);
    const payload = {
      organizationId: values.organizationId,
      name: values.name,
      durationMode: indefinite ? "indefinite" : "fixed",
      durationValue: indefinite ? null : custom ? values.customDurationValue : presetMonths,
      durationUnit: indefinite ? null : custom ? values.customDurationUnit : "month",
      requiresDocument: values.requiresDocument,
      isActive: values.isActive,
      ...(editing ? { version: new Date(item.updated_at).toISOString() } : {}),
    };
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(
            editing ? `/api/discipline/action-types/${item.id}` : "/api/discipline/action-types",
            {
              method: editing ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          );
          const body = await readApiResponse(response);
          await onSaved(body.message);
        },
        { message: "Menyimpan pengaturan sanksi..." },
      );
    } catch (error) {
      if (error.fieldErrors)
        form.setFields(
          Object.entries(error.fieldErrors).map(([name, message]) => ({
            name: name === "durationValue" ? "customDurationValue" : name,
            errors: [message],
          })),
        );
      onError(error.message);
    }
  };

  return (
    <>
      <AppModal
        open={open}
        onClose={closeGuard.requestClose}
        title={editing ? "Ubah pengaturan sanksi" : "Tambah jenis sanksi"}
        description="Atur ketersediaan, masa berlaku, dan kebutuhan surat resmi."
        icon="solar:shield-warning-bold-duotone"
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
                label="Nama sanksi"
                rules={[{ required: true, message: "Nama sanksi wajib diisi." }]}
                extra={
                  user.role_code === "superadmin"
                    ? "Nama hanya dapat dibuat atau diubah oleh Superadmin."
                    : "Nama jenis sanksi dikelola oleh Superadmin."
                }
              >
                <Input disabled={editing && user.role_code !== "superadmin"} maxLength={100} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                name="durationPreset"
                label="Masa berlaku"
                rules={[{ required: true, message: "Pilih masa berlaku." }]}
                extra="Tanggal berakhir dihitung otomatis dari tanggal mulai berlaku saat tindakan diterbitkan."
              >
                <Select
                  options={[
                    { value: "indefinite", label: "Tanpa batas waktu" },
                    { value: "1-month", label: "1 bulan" },
                    { value: "3-month", label: "3 bulan" },
                    { value: "6-month", label: "6 bulan" },
                    { value: "12-month", label: "12 bulan" },
                    { value: "custom", label: "Periode kustom" },
                  ]}
                />
              </Form.Item>
            </Col>
            {preset === "custom" ? (
              <>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="customDurationValue"
                    label="Lama berlaku"
                    rules={[{ required: true, message: "Lama berlaku wajib diisi." }]}
                  >
                    <InputNumber min={1} max={36500} precision={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="customDurationUnit"
                    label="Satuan"
                    rules={[{ required: true, message: "Satuan wajib dipilih." }]}
                  >
                    <Select
                      options={[
                        { value: "day", label: "Hari" },
                        { value: "month", label: "Bulan" },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </>
            ) : null}
            <Col xs={24}>
              <FormSettingsGroup sx={{ mt: 1 }}>
                <FormSettingSwitch
                  name="requiresDocument"
                  title="Wajib surat resmi"
                  description="Saat tindakan diterbitkan, nomor surat dan satu PDF resmi wajib dilengkapi."
                />
                <FormSettingSwitch
                  name="isActive"
                  title="Tersedia untuk digunakan"
                  description="Jenis nonaktif tetap muncul pada histori, tetapi tidak dapat dipilih untuk tindakan baru."
                />
              </FormSettingsGroup>
            </Col>
          </Row>
        </Form>
      </AppModal>
      <ConfirmDialog
        open={closeGuard.confirmCloseOpen}
        title="Buang perubahan?"
        message="Perubahan pengaturan sanksi belum disimpan."
        confirmText="Buang perubahan"
        danger
        onClose={closeGuard.keepEditing}
        onConfirm={closeGuard.discardChanges}
      />
    </>
  );
}
