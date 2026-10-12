"use client";

import { useEffect } from "react";
import { Button, Col, Form, Input, Row } from "antd";
import AppModal from "@/app/components/modals/AppModal";
import OrganizationScopeField from "@/app/components/forms/OrganizationScopeField";
import FormSettingSwitch, { FormSettingsGroup } from "@/app/components/forms/FormSettingSwitch";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import useFormModalClose from "@/app/hooks/useFormModalClose";
import { notifyPermissionDenied } from "@/lib/api/clientError";

/** Form domain untuk jenis hubungan kerja yang dapat berbeda pada setiap organisasi. */
export default function EmploymentTypeForm({
  open,
  item,
  presetOrganizationId,
  onClose,
  onSaved,
  onError,
}) {
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const closeGuard = useFormModalClose(form, onClose);
  const editing = Boolean(item);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(
      item
        ? {
            organizationId: item.organization_id,
            code: item.code,
            name: item.name,
            requiresEndDate: item.requires_end_date,
            isActive: item.is_active,
          }
        : {
            organizationId: presetOrganizationId,
            requiresEndDate: false,
            isActive: true,
          },
    );
  }, [form, item, open, presetOrganizationId]);

  /** Menyimpan jenis kepegawaian dengan validasi backend dan optimistic concurrency. */
  const submit = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const payload = {
            ...values,
            ...(editing ? { version: new Date(item.updated_at).toISOString() } : {}),
          };
          const response = await fetch(
            editing ? `/api/employment-types/${item.id}` : "/api/employment-types",
            {
              method: editing ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          );
          const body = await response.json();
          if (!response.ok) {
            notifyPermissionDenied(response);
            if (body.fieldErrors)
              form.setFields(
                Object.entries(body.fieldErrors).map(([name, error]) => ({
                  name,
                  errors: [error],
                })),
              );
            throw new Error(body.message);
          }
          await onSaved(body.message);
        },
        {
          message: editing ? "Menyimpan jenis kepegawaian..." : "Membuat jenis kepegawaian...",
        },
      );
    } catch (error) {
      onError(error.message || "Jenis kepegawaian gagal disimpan.");
    }
  };

  return (
    <>
      <AppModal
        open={open}
        onClose={closeGuard.requestClose}
        title={editing ? "Edit jenis kepegawaian" : "Tambah jenis kepegawaian"}
        description="Atur istilah hubungan kerja dan kebutuhan tanggal akhir kontrak."
        icon="solar:document-add-bold-duotone"
        size="md"
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
          <Row gutter={[16, 0]}>
            <Col xs={24}>
              <OrganizationScopeField disabled={editing} />
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="code" label="Kode" rules={[{ required: true }]}>
                <Input placeholder="Contoh: PKWT" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={16}>
              <Form.Item name="name" label="Nama jenis kepegawaian" rules={[{ required: true }]}>
                <Input placeholder="Contoh: Perjanjian Kerja Waktu Tertentu" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <FormSettingsGroup sx={{ mt: 1 }}>
                <FormSettingSwitch
                  name="requiresEndDate"
                  title="Menggunakan tanggal akhir kontrak"
                  description="Aktifkan jika kontrak memiliki tanggal berakhir."
                />
              </FormSettingsGroup>
              <FormSettingSwitch
                name="isActive"
                notice={{
                  on: {
                    title: "Jenis kepegawaian aktif",
                    description: "Jenis ini dapat dipilih saat membuat kontrak baru.",
                  },
                  off: {
                    title: "Jenis kepegawaian tidak aktif",
                    description:
                      "Jika dinonaktifkan, jenis ini tidak dapat dipilih untuk kontrak baru. Kontrak dan riwayat yang sudah ada tetap tersimpan.",
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
        message="Perubahan pada formulir jenis kepegawaian belum disimpan."
        confirmText="Buang perubahan"
        danger
        onClose={closeGuard.keepEditing}
        onConfirm={closeGuard.discardChanges}
      />
    </>
  );
}
