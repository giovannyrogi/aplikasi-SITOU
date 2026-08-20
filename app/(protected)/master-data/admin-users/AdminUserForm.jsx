"use client";

import { useEffect } from "react";
import { Button, Col, Form, Input, Row, Switch } from "antd";
import AppModal from "@/app/components/modals/AppModal";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import LocationSelect from "@/app/components/selects/LocationSelect";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import useFormModalClose from "@/app/hooks/useFormModalClose";
import { PASSWORD_FORM_RULES, PASSWORD_HELP_TEXT } from "@/app/utils/passwordRules";

export default function AdminUserForm({
  open,
  item,
  presetOrganizationId,
  onClose,
  onSaved,
  onError,
}) {
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const editing = Boolean(item);
  const organizationId = Form.useWatch("organizationId", form);
  const closeGuard = useFormModalClose(form, onClose);

  useEffect(() => {
    if (!open) return;

    form.resetFields();
    form.setFieldsValue(
      item
        ? {
            username: item.username,
            email: item.email,
            fullName: item.full_name,
            phone: item.phone,
            organizationId: item.organization_id,
            locationIds: item.location_ids || [],
            isActive: item.is_active,
          }
        : {
            organizationId: presetOrganizationId,
            locationIds: [],
            isActive: true,
          },
    );
  }, [form, item, open, presetOrganizationId]);

  const submit = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const payload = {
            ...values,
            phone: values.phone || null,
            ...(editing ? { version: new Date(item.updated_at).toISOString() } : {}),
          };
          const response = await fetch(
            editing ? `/api/admin-users/${item.id}` : "/api/admin-users",
            {
              method: editing ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          );
          const body = await response.json();

          if (!response.ok) {
            if (body.fieldErrors) {
              form.setFields(
                Object.entries(body.fieldErrors).map(([name, errors]) => ({
                  name,
                  errors: Array.isArray(errors) ? errors : [errors],
                })),
              );
            }
            throw new Error(body.message);
          }

          onSaved(body.message);
        },
        { message: editing ? "Menyimpan Admin/HRD..." : "Membuat Admin/HRD..." },
      );
    } catch (error) {
      onError(error.message || "Admin/HRD gagal disimpan.");
    }
  };

  return (
    <>
      <AppModal
        open={open}
        onClose={closeGuard.requestClose}
        title={editing ? "Edit Admin/HRD" : "Tambah Admin/HRD"}
        description="Akun Admin/HRD hanya dapat mengakses organisasi dan lokasi yang ditetapkan."
        icon="solar:user-plus-rounded-bold-duotone"
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
            <Col xs={24} sm={12}>
              <Form.Item name="fullName" label="Nama lengkap" rules={[{ required: true }]}>
                <Input autoComplete="name" placeholder="Nama Admin/HRD" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="username" label="Username" rules={[{ required: true }]}>
                <Input autoComplete="username" placeholder="Contoh: admin.manado" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true },
                  { type: "email", message: "Format email tidak valid." },
                ]}
              >
                <Input autoComplete="email" placeholder="nama@perusahaan.co.id" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="phone" label="Nomor telepon">
                <Input autoComplete="tel" placeholder="Opsional" />
              </Form.Item>
            </Col>
            {!editing && (
              <Col xs={24}>
                <Form.Item
                  name="password"
                  label="Password awal"
                  extra={PASSWORD_HELP_TEXT}
                  rules={PASSWORD_FORM_RULES}
                >
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
              </Col>
            )}
            <Col xs={24} sm={12}>
              <Form.Item name="organizationId" label="Organisasi" rules={[{ required: true }]}>
                <OrganizationSelect disabled={editing} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="locationIds"
                label="Cakupan lokasi"
                extra="Pilih satu atau beberapa lokasi yang boleh dikelola."
                rules={[
                  { required: true, type: "array", min: 1, message: "Pilih minimal satu lokasi." },
                ]}
              >
                <LocationSelect
                  organizationId={organizationId}
                  mode="multiple"
                  maxTagCount="responsive"
                />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="isActive" label="Status akun" valuePropName="checked">
                <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </AppModal>
      <ConfirmDialog
        open={closeGuard.confirmCloseOpen}
        title="Buang perubahan?"
        message="Perubahan pada akun Admin/HRD belum disimpan."
        confirmText="Buang perubahan"
        danger
        onClose={closeGuard.keepEditing}
        onConfirm={closeGuard.discardChanges}
      />
    </>
  );
}
