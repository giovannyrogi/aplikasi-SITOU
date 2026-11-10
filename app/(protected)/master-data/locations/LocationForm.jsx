"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Col, DatePicker, Form, Input, Row, Select } from "antd";
import dayjs from "dayjs";
import AppModal from "@/app/components/modals/AppModal";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import useFormModalClose from "@/app/hooks/useFormModalClose";
import OrganizationScopeField from "@/app/components/forms/OrganizationScopeField";
import LocationMapPicker from "@/app/components/attendance-points/LocationMapPicker";
import LocationPointFields from "@/app/components/attendance-points/LocationPointFields";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { hrisLevel } from "@/lib/access/hrisPolicy.mjs";
import AppNotice from "@/app/components/data-display/AppNotice";
import FormSettingSwitch, { FormSettingsGroup } from "@/app/components/forms/FormSettingSwitch";

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
  const pointLevel = hrisLevel(useAuthenticatedUser(), "attendance-point-access");
  const longitude = Form.useWatch("longitude", form);
  const radius = Form.useWatch("radiusMeters", form);
  const [pointReady, setPointReady] = useState(false);
  const pointEnabled = Form.useWatch("attendanceEnabled", form);
  const coordinatesRequired = pointReady && pointLevel === "manage" && pointEnabled;
  const closeGuard = useFormModalClose(form, onClose);
  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue(
        item
          ? {
              organizationId: item.organization_id,
              parentLocationId: item.parent_location_id || undefined,
              name: item.name,
              locationType: item.location_type,
              address: item.address,
              latitude: item.latitude != null ? Number(item.latitude) : null,
              longitude: item.longitude != null ? Number(item.longitude) : null,
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
              .map((x) => ({ value: x.id, label: x.name })),
          );
      })
      .finally(() => active && setLoadingParents(false));
    return () => {
      active = false;
    };
  }, [organizationId, item?.id]);
  const pickPoint = useCallback(
    (latitude, longitude, address) => {
      const previousAddress = form.getFieldValue("address");
      form.setFields([
        { name: "latitude", value: latitude, touched: true, errors: [] },
        { name: "longitude", value: longitude, touched: true, errors: [] },
        ...(address ? [{ name: "address", value: address, touched: true, errors: [] }] : []),
      ]);
      return (resolved) => {
        if (
          form.getFieldValue("latitude") === latitude &&
          form.getFieldValue("longitude") === longitude &&
          form.getFieldValue("address") === previousAddress
        ) {
          form.setFields([{ name: "address", value: resolved, touched: true, errors: [] }]);
        }
      };
    },
    [form],
  );
  const submit = async ({ attendanceEnabled, radiusMeters, maxAccuracyMeters, ...values }) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const payload = {
            ...values,
            ...(pointReady &&
            pointLevel === "manage" &&
            (attendanceEnabled || (editing && form.isFieldTouched("attendanceEnabled")))
              ? {
                  attendancePoint: {
                    enabled: Boolean(attendanceEnabled),
                    radiusMeters: radiusMeters ?? null,
                    maxAccuracyMeters: maxAccuracyMeters ?? null,
                  },
                }
              : {}),
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
            signal: AbortSignal.timeout(25000),
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
      onError(
        e.name === "TimeoutError"
          ? "Hasil penyimpanan belum diketahui. Muat ulang daftar lokasi."
          : e.message || "Lokasi gagal disimpan.",
      );
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
            <Col xs={24} sm={12}>
              <Form.Item name="name" label="Nama lokasi" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="locationType" label="Jenis lokasi" rules={[{ required: true }]}>
                <Select options={TYPES} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="operationalFrom"
                label="Mulai beroperasi"
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="operationalUntil" label="Akhir operasional (opsional)">
                <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="longitude" hidden>
                <Input type="hidden" />
              </Form.Item>
              <Form.Item
                name="latitude"
                valuePropName="latitude"
                trigger="onLatitudeChange"
                rules={
                  coordinatesRequired
                    ? [
                        {
                          required: true,
                          message: "Pilih titik di peta atau dari hasil pencarian.",
                        },
                      ]
                    : []
                }
              >
                {open && (
                  <LocationMapPicker
                    key={`${item?.id || "new"}-${organizationId || ""}`}
                    onError={onError}
                    longitude={longitude}
                    radius={pointEnabled ? radius : null}
                    onPick={pickPoint}
                  />
                )}
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="address" label="Alamat">
                <Input.TextArea rows={2} maxLength={1000} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <FormSettingsGroup>
                {open &&
                  pointLevel &&
                  (organizationId ? (
                    <LocationPointFields
                      key={String(organizationId) + ":" + (item?.id ?? "")}
                      organizationId={organizationId}
                      locationId={item?.id}
                      manage={pointLevel === "manage"}
                      onReady={setPointReady}
                    />
                  ) : (
                    <AppNotice
                      tone="info"
                      title="Pengaturan titik absen"
                      description="Pilih organisasi untuk memuat pengaturan titik absen."
                    />
                  ))}
                <FormSettingSwitch
                  name="isActive"
                  notice={{
                    on: {
                      title: "Lokasi aktif",
                      description:
                        "Lokasi ini dapat dipilih untuk penempatan pegawai dan kegiatan operasional baru.",
                    },
                    off: {
                      title: "Lokasi tidak aktif",
                      description:
                        "Jika dinonaktifkan, lokasi ini tidak dapat dipilih untuk penempatan atau kegiatan operasional baru. Riwayatnya tetap tersimpan.",
                    },
                  }}
                />
              </FormSettingsGroup>
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
