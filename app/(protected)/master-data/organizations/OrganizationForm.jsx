"use client";

import { useEffect } from "react";
import { Button, Col, DatePicker, Divider, Form, Input, Row, Select } from "antd";
import dayjs from "dayjs";
import AppModal from "@/app/components/modals/AppModal";
import FormSettingSwitch, { FormSettingsGroup } from "@/app/components/forms/FormSettingSwitch";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import useFormModalClose from "@/app/hooks/useFormModalClose";

const TYPES = [
  { value: "company", label: "Organisasi" },
  { value: "holding", label: "Holding" },
  { value: "agency", label: "Agency" },
];
export default function OrganizationForm({ open, item, onClose, onSaved, onError }) {
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const editing = Boolean(item);
  const closeGuard = useFormModalClose(form, onClose);
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(
      item
        ? {
            code: item.code,
            name: item.name,
            legalName: item.legal_name,
            organizationType: item.organization_type,
            parentId: item.parent_id || undefined,
            timezone: item.timezone,
            isActive: item.is_active,
          }
        : {
            organizationType: "company",
            timezone: "Asia/Makassar",
            isActive: true,
            initialSubscription: {
              startsOn: dayjs(),
              endsOn: dayjs().add(1, "year"),
              graceEndsOn: null,
              notes: null,
            },
          },
    );
  }, [form, item, open]);
  const submit = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const payload = {
            ...values,
            parentId: values.parentId || null,
            legalName: values.legalName || null,
            ...(editing
              ? { version: new Date(item.updated_at).toISOString() }
              : {
                  initialSubscription: {
                    ...values.initialSubscription,
                    startsOn: values.initialSubscription.startsOn.format("YYYY-MM-DD"),
                    endsOn: values.initialSubscription.endsOn.format("YYYY-MM-DD"),
                    graceEndsOn:
                      values.initialSubscription.graceEndsOn?.format("YYYY-MM-DD") || null,
                    notes: values.initialSubscription.notes || null,
                  },
                }),
          };
          const requestId = crypto.randomUUID();
          const response = await fetch(
            editing ? `/api/organizations/${item.id}` : "/api/organizations",
            {
              method: editing ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json", "X-Request-ID": requestId },
              body: JSON.stringify(payload),
            },
          );
          const body = await response.json();
          if (!response.ok) {
            if (body.fieldErrors)
              form.setFields(
                Object.entries(body.fieldErrors).map(([name, errors]) => ({
                  name: name.split("."),
                  errors: [errors],
                })),
              );
            throw new Error(body.message);
          }
          await onSaved(body.message);
        },
        { message: editing ? "Menyimpan organisasi..." : "Membuat organisasi..." },
      );
    } catch (error) {
      onError(error.message || "Organisasi gagal disimpan.");
    }
  };
  return (
    <>
      <AppModal
        open={open}
        onClose={closeGuard.requestClose}
        title={editing ? "Edit organisasi" : "Tambah organisasi"}
        description={
          editing
            ? "Ubah identitas organisasi tanpa menimpa histori langganan."
            : "Buat identitas organisasi dan periode langganan pertamanya."
        }
        icon="solar:buildings-3-bold-duotone"
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
        <Form form={form} layout="vertical" onFinish={submit} requiredMark="optional">
          <Row gutter={[16, 0]}>
            <Col xs={24} sm={8}>
              <Form.Item name="code" label="Kode" rules={[{ required: true }]}>
                <Input placeholder="Contoh: PSM" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={16}>
              <Form.Item name="name" label="Nama organisasi" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="legalName" label="Nama badan hukum">
                <Input placeholder="Opsional" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="organizationType"
                label="Jenis organisasi"
                rules={[{ required: true }]}
              >
                <Select options={TYPES} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="parentId" label="Organisasi induk">
                <OrganizationSelect allowClear excludeIds={item ? [item.id] : []} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="timezone" label="Zona waktu" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: "Asia/Makassar", label: "WITA - Asia/Makassar" },
                    { value: "Asia/Jakarta", label: "WIB - Asia/Jakarta" },
                    { value: "Asia/Jayapura", label: "WIT - Asia/Jayapura" },
                  ]}
                />
              </Form.Item>
            </Col>
            {!editing && (
              <>
                <Col xs={24}>
                  <Divider titlePlacement="start">Langganan awal</Divider>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item
                    name={["initialSubscription", "startsOn"]}
                    label="Mulai akses"
                    rules={[{ required: true }]}
                  >
                    <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item
                    name={["initialSubscription", "endsOn"]}
                    label="Akhir akses"
                    rules={[{ required: true }]}
                  >
                    <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name={["initialSubscription", "graceEndsOn"]} label="Akhir tenggang">
                    <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item name={["initialSubscription", "notes"]} label="Catatan">
                    <Input.TextArea rows={2} maxLength={2000} />
                  </Form.Item>
                </Col>
              </>
            )}
            <Col xs={24}>
              <FormSettingsGroup sx={{ mt: 1 }}>
                <FormSettingSwitch
                  name="isActive"
                  title="Akses organisasi diaktifkan"
                  description={
                    editing
                      ? "Nonaktifkan untuk memblokir seluruh akun organisasi meskipun masa aksesnya masih berlaku."
                      : "Aktifkan agar organisasi dan akun di dalamnya dapat digunakan setelah dibuat."
                  }
                />
              </FormSettingsGroup>
            </Col>
          </Row>
        </Form>
      </AppModal>
      <ConfirmDialog
        open={closeGuard.confirmCloseOpen}
        title="Buang perubahan?"
        message="Perubahan pada formulir organisasi belum disimpan."
        confirmText="Buang perubahan"
        danger
        onClose={closeGuard.keepEditing}
        onConfirm={closeGuard.discardChanges}
      />
    </>
  );
}
