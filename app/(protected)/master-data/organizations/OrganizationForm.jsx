"use client";

import { useEffect } from "react";
import { Button, Col, DatePicker, Form, Input, Row, Select, Switch } from "antd";
import dayjs from "dayjs";
import AppModal from "@/app/components/modals/AppModal";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import useFormModalClose from "@/app/hooks/useFormModalClose";

const TYPES = [
  { value: "company", label: "Perusahaan" },
  { value: "holding", label: "Holding" },
  { value: "agency", label: "Agency" },
];
export default function OrganizationForm({ open, item, onClose, onSaved, onError }) {
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const editing = Boolean(item);
  const closeGuard = useFormModalClose(form, onClose);
  useEffect(() => {
    if (open) {
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
              activeFrom: dayjs(item.active_from),
              activeUntil: dayjs(item.active_until),
              isActive: item.is_active,
            }
          : {
              organizationType: "company",
              timezone: "Asia/Makassar",
              activeFrom: dayjs(),
              activeUntil: dayjs().add(1, "year"),
              isActive: true,
            },
      );
    }
  }, [form, item, open]);
  const submit = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const payload = {
            ...values,
            parentId: values.parentId || null,
            legalName: values.legalName || null,
            activeFrom: values.activeFrom.format("YYYY-MM-DD"),
            activeUntil: values.activeUntil.format("YYYY-MM-DD"),
            ...(editing ? { version: new Date(item.updated_at).toISOString() } : {}),
          };
          const response = await fetch(
            editing ? `/api/organizations/${item.id}` : "/api/organizations",
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
                Object.entries(body.fieldErrors).map(([name, errors]) => ({
                  name,
                  errors: [errors],
                })),
              );
            throw new Error(body.message);
          }
          onSaved(body.message);
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
        description="Tentukan identitas dan masa akses organisasi pada SITOU."
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
                <Input placeholder="Nama perusahaan atau organisasi" />
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
                <OrganizationSelect allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="activeFrom" label="Mulai berlaku" rules={[{ required: true }]}>
                <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="activeUntil" label="Berakhir pada" rules={[{ required: true }]}>
                <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={16}>
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
            <Col xs={24} sm={8}>
              <Form.Item name="isActive" label="Status" valuePropName="checked">
                <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
              </Form.Item>
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
