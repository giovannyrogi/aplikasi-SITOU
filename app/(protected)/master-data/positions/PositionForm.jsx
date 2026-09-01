"use client";

import { useEffect } from "react";
import { Button, Col, Form, Input, InputNumber, Row } from "antd";
import AppModal from "@/app/components/modals/AppModal";
import OrganizationScopeField from "@/app/components/forms/OrganizationScopeField";
import FormSettingSwitch, { FormSettingsGroup } from "@/app/components/forms/FormSettingSwitch";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import useFormModalClose from "@/app/hooks/useFormModalClose";

/** Form domain untuk master jabatan organisasi. */
export default function PositionForm({
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
            grade: item.grade,
            levelNo: item.level_no,
            isManagerial: item.is_managerial,
            isActive: item.is_active,
          }
        : {
            organizationId: presetOrganizationId,
            grade: null,
            levelNo: null,
            isManagerial: false,
            isActive: true,
          },
    );
  }, [form, item, open, presetOrganizationId]);

  /** Menyimpan jabatan dan menyertakan versi updated_at ketika mengedit. */
  const submit = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const payload = {
            ...values,
            grade: values.grade || null,
            levelNo: values.levelNo ?? null,
            ...(editing ? { version: new Date(item.updated_at).toISOString() } : {}),
          };
          const response = await fetch(editing ? `/api/positions/${item.id}` : "/api/positions", {
            method: editing ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
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
        { message: editing ? "Menyimpan jabatan..." : "Membuat jabatan..." },
      );
    } catch (error) {
      onError(error.message || "Jabatan gagal disimpan.");
    }
  };

  return (
    <>
      <AppModal
        open={open}
        onClose={closeGuard.requestClose}
        title={editing ? "Edit jabatan" : "Tambah jabatan"}
        description="Jabatan digunakan pada histori penempatan, promosi, mutasi, dan struktur pelaporan."
        icon="solar:case-round-bold-duotone"
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
                <Input placeholder="Contoh: MGR-SDM" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={16}>
              <Form.Item name="name" label="Nama jabatan" rules={[{ required: true }]}>
                <Input placeholder="Contoh: Manajer SDM" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="grade" label="Golongan atau grade">
                <Input placeholder="Opsional" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="levelNo"
                label="Urutan level"
                extra="Angka lebih kecil dapat digunakan untuk level yang lebih tinggi."
              >
                <InputNumber min={1} max={32767} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <FormSettingsGroup sx={{ mt: 1 }}>
                <FormSettingSwitch
                  name="isManagerial"
                  title="Termasuk jabatan manajerial"
                  description="Aktifkan untuk jabatan yang memiliki tanggung jawab memimpin tim atau unit kerja."
                />
                <FormSettingSwitch
                  name="isActive"
                  title="Tersedia untuk penempatan pegawai"
                  description="Aktifkan agar jabatan ini dapat dipilih pada penempatan baru."
                />
              </FormSettingsGroup>
            </Col>
          </Row>
        </Form>
      </AppModal>
      <ConfirmDialog
        open={closeGuard.confirmCloseOpen}
        title="Buang perubahan?"
        message="Perubahan pada formulir jabatan belum disimpan."
        confirmText="Buang perubahan"
        danger
        onClose={closeGuard.keepEditing}
        onConfirm={closeGuard.discardChanges}
      />
    </>
  );
}
