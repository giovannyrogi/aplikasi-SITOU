"use client";

import { useEffect } from "react";
import { Button, Col, Form, Input, InputNumber, Row, Switch } from "antd";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import AppModal from "@/app/components/modals/AppModal";
import OrganizationScopeField from "@/app/components/forms/OrganizationScopeField";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import useFormModalClose from "@/app/hooks/useFormModalClose";

/** Form domain untuk membuat dan memperbarui klasifikasi struktur organisasi. */
export default function OrganizationUnitTypeForm({
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
  const codeLocked = editing && Number(item.usage_count) > 0;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(
      item
        ? {
            organizationId: item.organization_id,
            code: item.code,
            name: item.name,
            description: item.description,
            sortOrder: item.sort_order,
            isActive: item.is_active,
          }
        : {
            organizationId: presetOrganizationId,
            sortOrder: 100,
            isActive: true,
          },
    );
  }, [form, item, open, presetOrganizationId]);

  /** Mengirim payload bersih beserta versi record ketika melakukan edit. */
  const submit = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const payload = {
            ...values,
            description: values.description || null,
            ...(editing ? { version: new Date(item.updated_at).toISOString() } : {}),
          };
          const response = await fetch(
            editing ? `/api/organization-unit-types/${item.id}` : "/api/organization-unit-types",
            {
              method: editing ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          );
          const body = await response.json();
          if (!response.ok) {
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
        { message: editing ? "Menyimpan jenis unit..." : "Membuat jenis unit..." },
      );
    } catch (error) {
      onError(error.message || "Jenis unit organisasi gagal disimpan.");
    }
  };

  return (
    <>
      <AppModal
        open={open}
        onClose={closeGuard.requestClose}
        title={editing ? "Edit jenis unit organisasi" : "Tambah jenis unit organisasi"}
        description="Atur istilah struktur yang dapat dipakai Divisi & Unit pada organisasi."
        icon={<CategoryRoundedIcon sx={{ fontSize: 22 }} />}
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
            <Col xs={24} sm={10}>
              <Form.Item
                name="code"
                label="Kode"
                rules={[{ required: true }]}
                extra={codeLocked ? "Kode dikunci karena jenis ini sudah digunakan." : null}
              >
                <Input disabled={codeLocked} placeholder="Contoh: DIREKSI" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={14}>
              <Form.Item name="name" label="Nama jenis unit" rules={[{ required: true }]}>
                <Input placeholder="Contoh: Direksi" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="description" label="Deskripsi">
                <Input.TextArea
                  autoSize={{ minRows: 3, maxRows: 5 }}
                  maxLength={1000}
                  showCount
                  placeholder="Jelaskan penggunaan jenis unit ini."
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="sortOrder"
                label="Urutan tampil"
                rules={[{ required: true }]}
                extra="Angka lebih kecil tampil lebih dahulu pada pilihan jenis unit."
              >
                <InputNumber min={0} max={32767} precision={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="isActive"
                label="Status aktif"
                valuePropName="checked"
                extra={
                  editing && item.is_active
                    ? "Gunakan aksi Nonaktifkan pada daftar agar dampaknya dikonfirmasi."
                    : null
                }
              >
                <Switch disabled={editing && item.is_active} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </AppModal>
      <ConfirmDialog
        open={closeGuard.confirmCloseOpen}
        title="Buang perubahan?"
        message="Perubahan pada formulir jenis unit organisasi belum disimpan."
        confirmText="Buang perubahan"
        danger
        onClose={closeGuard.keepEditing}
        onConfirm={closeGuard.discardChanges}
      />
    </>
  );
}
