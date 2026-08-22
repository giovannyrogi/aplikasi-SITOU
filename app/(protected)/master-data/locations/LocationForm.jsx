"use client";

import { useEffect, useState } from "react";
import { Button, Col, DatePicker, Form, Input, InputNumber, Row, Select, Switch } from "antd";
import dayjs from "dayjs";
import AppModal from "@/app/components/modals/AppModal";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import useFormModalClose from "@/app/hooks/useFormModalClose";
import OrganizationScopeField from "@/app/components/forms/OrganizationScopeField";

const TYPES = [
  { value: "head_office", label: "Kantor pusat" },
  { value: "branch", label: "Cabang" },
  { value: "market", label: "Pasar" },
  { value: "site", label: "Site" },
  { value: "warehouse", label: "Gudang" },
  { value: "other", label: "Lainnya" },
];
export default function LocationForm({
  open,
  item,
  presetOrganizationId,
  onClose,
  onSaved,
  onError,
}) {
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const [parents, setParents] = useState([]);
  const [loadingParents, setLoadingParents] = useState(false);
  const organizationId = Form.useWatch("organizationId", form);
  const editing = Boolean(item);
  const closeGuard = useFormModalClose(form, onClose);
  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue(
        item
          ? {
              organizationId: item.organization_id,
              parentLocationId: item.parent_location_id || undefined,
              code: item.code,
              name: item.name,
              locationType: item.location_type,
              address: item.address,
              latitude: item.latitude ? Number(item.latitude) : null,
              longitude: item.longitude ? Number(item.longitude) : null,
              operationalFrom: dayjs(item.operational_from),
              operationalUntil: item.operational_until ? dayjs(item.operational_until) : null,
              isActive: item.is_active,
            }
          : {
              organizationId: presetOrganizationId,
              locationType: "branch",
              operationalFrom: dayjs(),
              operationalUntil: null,
              isActive: true,
            },
      );
    }
  }, [form, item, open, presetOrganizationId]);
  useEffect(() => {
    if (!organizationId) return undefined;
    let active = true;
    Promise.resolve()
      .then(() => active && setLoadingParents(true))
      .then(() => fetch(`/api/locations/options?organizationId=${organizationId}`))
      .then((r) => r.json())
      .then((b) => {
        if (active)
          setParents(
            (b.data || [])
              .filter((x) => x.id !== item?.id)
              .map((x) => ({ value: x.id, label: `${x.code} - ${x.name}` })),
          );
      })
      .finally(() => active && setLoadingParents(false));
    return () => {
      active = false;
    };
  }, [organizationId, item?.id]);
  const submit = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const payload = {
            ...values,
            parentLocationId: values.parentLocationId || null,
            address: values.address || null,
            latitude: values.latitude ?? null,
            longitude: values.longitude ?? null,
            operationalFrom: values.operationalFrom.format("YYYY-MM-DD"),
            operationalUntil: values.operationalUntil
              ? values.operationalUntil.format("YYYY-MM-DD")
              : null,
            ...(editing ? { version: new Date(item.updated_at).toISOString() } : {}),
          };
          const r = await fetch(editing ? `/api/locations/${item.id}` : "/api/locations", {
            method: editing ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const b = await r.json();
          if (!r.ok) {
            if (b.fieldErrors)
              form.setFields(
                Object.entries(b.fieldErrors).map(([name, error]) => ({ name, errors: [error] })),
              );
            throw new Error(b.message);
          }
          await onSaved(b.message);
        },
        { message: editing ? "Menyimpan lokasi..." : "Membuat lokasi..." },
      );
    } catch (e) {
      onError(e.message || "Lokasi gagal disimpan.");
    }
  };
  return (
    <>
      <AppModal
        open={open}
        onClose={closeGuard.requestClose}
        title={editing ? "Edit lokasi" : "Tambah lokasi"}
        description="Lokasi selalu berada dalam satu organisasi dan dapat memiliki lokasi induk."
        icon="solar:map-point-wave-bold-duotone"
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
          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <OrganizationScopeField disabled={editing} />
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="parentLocationId" label="Lokasi induk">
                <AsyncSelect
                  allowClear
                  loading={loadingParents}
                  options={organizationId ? parents : []}
                  disabled={!organizationId}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="code" label="Kode" rules={[{ required: true }]}>
                <Input placeholder="Contoh: PUSAT" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={16}>
              <Form.Item name="name" label="Nama lokasi" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="locationType" label="Jenis lokasi" rules={[{ required: true }]}>
                <Select options={TYPES} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="address" label="Alamat">
                <Input.TextArea rows={3} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="latitude" label="Latitude">
                <InputNumber style={{ width: "100%" }} min={-90} max={90} precision={7} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="longitude" label="Longitude">
                <InputNumber style={{ width: "100%" }} min={-180} max={180} precision={7} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item
                name="operationalFrom"
                label="Mulai beroperasi"
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item name="operationalUntil" label="Akhir operasional (opsional)">
                <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={4}>
              <Form.Item name="isActive" label="Status" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </AppModal>
      <ConfirmDialog
        open={closeGuard.confirmCloseOpen}
        title="Buang perubahan?"
        message="Perubahan pada formulir lokasi belum disimpan."
        confirmText="Buang perubahan"
        danger
        onClose={closeGuard.keepEditing}
        onConfirm={closeGuard.discardChanges}
      />
    </>
  );
}
