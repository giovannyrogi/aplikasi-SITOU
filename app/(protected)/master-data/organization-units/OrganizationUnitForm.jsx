"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Col, DatePicker, Form, Input, Row, theme } from "antd";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import dayjs from "dayjs";
import AppModal from "@/app/components/modals/AppModal";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import OrganizationScopeField from "@/app/components/forms/OrganizationScopeField";
import FormSettingSwitch, { FormSettingsGroup } from "@/app/components/forms/FormSettingSwitch";
import OrganizationUnitTypeSelect from "@/app/components/selects/OrganizationUnitTypeSelect";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import useFormModalClose from "@/app/hooks/useFormModalClose";

const EMPTY_LOCATIONS = [];

const toDateValue = (value) => (value ? dayjs(value).startOf("day") : dayjs().startOf("day"));
const toIsoDate = (value) => (dayjs.isDayjs(value) ? value : dayjs(value)).format("YYYY-MM-DD");

/** Form domain untuk membuat atau mengubah Divisi & Unit beserta periode lokasi operasionalnya. */
export default function OrganizationUnitForm({
  open,
  item,
  presetOrganizationId,
  onClose,
  onSaved,
  onError,
}) {
  const [form] = Form.useForm();
  const { token } = theme.useToken();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const closeGuard = useFormModalClose(form, onClose);
  const [options, setOptions] = useState({ loading: false, parents: [], locations: [] });
  const [pendingPayload, setPendingPayload] = useState(null);
  const organizationId = Form.useWatch("organizationId", form);
  const selectedLocations = Form.useWatch("locations", form) || EMPTY_LOCATIONS;
  const previousOrganizationId = useRef(null);
  const editing = Boolean(item);

  const originalLocations = useMemo(
    () =>
      new Map(
        (item?.locations || []).map((location) => [
          String(location.id),
          String(location.active_from),
        ]),
      ),
    [item?.locations],
  );
  const hasHistoricalLocationChanges = useMemo(() => {
    if (!editing) return false;
    const current = new Map(
      selectedLocations.map((location) => [
        String(location?.locationId),
        location?.activeFrom ? toIsoDate(location.activeFrom) : "",
      ]),
    );
    return [...originalLocations].some(
      ([locationId, activeFrom]) => current.get(locationId) !== activeFrom,
    );
  }, [editing, originalLocations, selectedLocations]);
  const selectedLocationIds = selectedLocations
    .map((location) => location?.locationId)
    .filter(Boolean);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(
      item
        ? {
            organizationId: item.organization_id,
            parentUnitId: item.parent_unit_id || undefined,
            code: item.code,
            name: item.name,
            unitTypeId: item.unit_type_id,
            defaultLocationActiveFrom: dayjs().startOf("day"),
            locations: (item.locations || []).map((location) => ({
              locationId: location.id,
              activeFrom: toDateValue(location.active_from),
            })),
            locationChangeReason: null,
            isActive: item.is_active,
          }
        : {
            organizationId: presetOrganizationId,
            defaultLocationActiveFrom: dayjs().startOf("day"),
            locations: [],
            locationChangeReason: null,
            isActive: true,
          },
    );
  }, [form, item, open, presetOrganizationId]);

  useEffect(() => {
    if (!open) {
      previousOrganizationId.current = null;
      return;
    }
    if (
      previousOrganizationId.current &&
      String(previousOrganizationId.current) !== String(organizationId || "")
    )
      form.setFieldsValue({
        unitTypeId: undefined,
        parentUnitId: undefined,
        locations: [],
        locationChangeReason: null,
      });
    previousOrganizationId.current = organizationId || null;
  }, [form, open, organizationId]);

  useEffect(() => {
    if (!open || !organizationId) return undefined;
    let active = true;

    Promise.resolve()
      .then(() => active && setOptions((current) => ({ ...current, loading: true })))
      .then(() =>
        Promise.all([
          fetch(`/api/organization-units/options?organizationId=${organizationId}`).then((r) =>
            r.json(),
          ),
          fetch(`/api/locations/options?organizationId=${organizationId}`).then((r) => r.json()),
        ]),
      )
      .then(([parentBody, locationBody]) => {
        if (!active) return;
        const locationMap = new Map(
          (locationBody.data || []).map((option) => [
            String(option.id),
            {
              value: option.id,
              label: `${option.code} - ${option.name}`,
              operationalFrom: option.operational_from,
              operationalUntil: option.operational_until,
            },
          ]),
        );
        for (const location of item?.locations || []) {
          if (!locationMap.has(String(location.id)))
            locationMap.set(String(location.id), {
              value: location.id,
              label: `${location.code} - ${location.name}`,
              operationalFrom: null,
              operationalUntil: null,
            });
        }
        setOptions({
          loading: false,
          parents: (parentBody.data || [])
            .filter((option) => String(option.id) !== String(item?.id || ""))
            .map((option) => ({ value: option.id, label: `${option.code} - ${option.name}` })),
          locations: [...locationMap.values()],
        });
      })
      .catch(() => active && setOptions({ loading: false, parents: [], locations: [] }));
    return () => {
      active = false;
    };
  }, [item?.id, item?.locations, open, organizationId]);

  /** Lokasi baru menerima tanggal bersama, sedangkan tanggal relasi lama tidak ditimpa. */
  const handleLocationSelection = (locationIds = []) => {
    const current = new Map(
      (form.getFieldValue("locations") || []).map((location) => [
        String(location.locationId),
        location,
      ]),
    );
    const defaultActiveFrom =
      form.getFieldValue("defaultLocationActiveFrom") || dayjs().startOf("day");
    form.setFieldValue(
      "locations",
      locationIds.map(
        (locationId) =>
          current.get(String(locationId)) || {
            locationId,
            activeFrom: defaultActiveFrom,
          },
      ),
    );
  };

  /** Menentukan batas tanggal berdasarkan masa operasional lokasi dan hari ini. */
  const isLocationDateDisabled = (locationId, current) => {
    const option = options.locations.find(
      (location) => String(location.value) === String(locationId),
    );
    if (current.isAfter(dayjs(), "day")) return true;
    if (option?.operationalFrom && current.isBefore(dayjs(option.operationalFrom), "day"))
      return true;
    return Boolean(
      option?.operationalUntil && current.isAfter(dayjs(option.operationalUntil), "day"),
    );
  };

  /** Mengirim payload periode eksplisit dan memetakan error backend ke field terkait. */
  const persist = async (payload) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(
            editing ? `/api/organization-units/${item.id}` : "/api/organization-units",
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
                  name: name.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part)),
                  errors: [error],
                })),
              );
            throw new Error(body.message);
          }
          await onSaved(body.message);
        },
        { message: editing ? "Menyimpan divisi atau unit..." : "Membuat divisi atau unit..." },
      );
    } catch (error) {
      onError(error.message || "Divisi atau unit gagal disimpan.");
    }
  };

  const submit = async (values) => {
    const payload = {
      organizationId: values.organizationId,
      parentUnitId: values.parentUnitId || null,
      code: values.code,
      name: values.name,
      unitTypeId: values.unitTypeId,
      locations: (values.locations || []).map((location) => ({
        locationId: location.locationId,
        activeFrom: toIsoDate(location.activeFrom),
      })),
      locationChangeReason: values.locationChangeReason?.trim() || null,
      isActive: values.isActive,
      ...(editing ? { version: new Date(item.updated_at).toISOString() } : {}),
    };
    if (hasHistoricalLocationChanges) {
      setPendingPayload(payload);
      return;
    }
    await persist(payload);
  };

  return (
    <>
      <AppModal
        open={open}
        onClose={() => {
          setPendingPayload(null);
          closeGuard.requestClose();
        }}
        title={editing ? "Edit divisi atau unit" : "Tambah divisi atau unit"}
        description="Susun hierarki unit dan tentukan sejak kapan unit beroperasi pada setiap lokasi."
        icon={<AccountTreeRoundedIcon sx={{ fontSize: 22 }} />}
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
              <Form.Item
                name="parentUnitId"
                label="Unit induk"
                extra="Pilih unit satu tingkat di atasnya. Kosongkan bila berada di tingkat paling atas."
              >
                <AsyncSelect
                  allowClear
                  disabled={!organizationId}
                  loading={options.loading}
                  options={options.parents}
                  placeholder="Tanpa unit induk"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="code" label="Kode" rules={[{ required: true }]}>
                <Input placeholder="Contoh: DIV-SDM" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={16}>
              <Form.Item name="name" label="Nama divisi atau unit" rules={[{ required: true }]}>
                <Input placeholder="Contoh: Divisi Sumber Daya Manusia" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="unitTypeId"
                label="Jenis unit"
                rules={[{ required: true, message: "Jenis unit wajib dipilih." }]}
                extra="Jenis unit dikelola melalui menu Data Master > Jenis Unit Organisasi."
              >
                <OrganizationUnitTypeSelect
                  organizationId={organizationId}
                  includeId={item?.unit_type_id}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="defaultLocationActiveFrom"
                label="Mulai berlaku untuk lokasi baru"
                extra="Tanggal ini otomatis dipakai saat memilih lokasi baru."
              >
                <DatePicker
                  style={{ width: "100%" }}
                  disabledDate={(current) => current.isAfter(dayjs(), "day")}
                />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                label="Lokasi operasional"
                extra="Pilih lokasi, lalu periksa tanggal mulai masing-masing di bawah ini."
              >
                <AsyncSelect
                  mode="multiple"
                  allowClear
                  value={selectedLocationIds}
                  onChange={handleLocationSelection}
                  disabled={!organizationId}
                  loading={options.loading}
                  options={options.locations}
                  placeholder="Pilih satu atau beberapa lokasi"
                />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.List name="locations">
                {(fields) =>
                  fields.map((field) => {
                    const mapping = selectedLocations[field.name] || {};
                    const option = options.locations.find(
                      (location) => String(location.value) === String(mapping.locationId || ""),
                    );
                    return (
                      <Row
                        key={field.key}
                        gutter={[16, 0]}
                        align="middle"
                        style={{
                          marginBottom: 12,
                          padding: "12px 12px 0",
                          border: `1px solid ${token.colorBorderSecondary}`,
                          borderRadius: 8,
                        }}
                      >
                        <Col xs={24} sm={15}>
                          <Form.Item label="Lokasi" style={{ marginBottom: 12 }}>
                            <Input value={option?.label || "Lokasi"} disabled />
                          </Form.Item>
                          <Form.Item name={[field.name, "locationId"]} hidden>
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={9}>
                          <Form.Item
                            name={[field.name, "activeFrom"]}
                            label="Mulai berlaku"
                            rules={[{ required: true, message: "Tanggal mulai wajib dipilih." }]}
                            style={{ marginBottom: 12 }}
                          >
                            <DatePicker
                              style={{ width: "100%" }}
                              disabledDate={(current) =>
                                isLocationDateDisabled(mapping.locationId, current)
                              }
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    );
                  })
                }
              </Form.List>
            </Col>
            {hasHistoricalLocationChanges ? (
              <Col xs={24}>
                <Form.Item
                  name="locationChangeReason"
                  label="Alasan koreksi atau pelepasan lokasi"
                  rules={[
                    { required: true, message: "Alasan perubahan histori wajib diisi." },
                    { min: 5, message: "Alasan minimal 5 karakter." },
                  ]}
                  extra="Perubahan tanggal atau pelepasan lokasi dicatat dalam audit."
                >
                  <Input.TextArea rows={3} maxLength={2000} showCount />
                </Form.Item>
              </Col>
            ) : null}
            <Col xs={24}>
              <FormSettingsGroup sx={{ mt: 1 }}>
                <FormSettingSwitch
                  name="isActive"
                  title="Tersedia untuk digunakan pada penempatan"
                  description="Aktifkan agar Divisi & Unit ini dapat dipilih saat membuat penempatan baru."
                />
              </FormSettingsGroup>
            </Col>
          </Row>
        </Form>
      </AppModal>
      <ConfirmDialog
        open={Boolean(pendingPayload)}
        title="Simpan perubahan histori lokasi?"
        message="Tanggal mulai atau cakupan lokasi berubah. Sistem akan memeriksa agar histori penempatan pegawai tetap valid."
        confirmText="Simpan perubahan"
        onClose={() => setPendingPayload(null)}
        onConfirm={async () => {
          const payload = pendingPayload;
          setPendingPayload(null);
          await persist(payload);
        }}
      />
      <ConfirmDialog
        open={closeGuard.confirmCloseOpen}
        title="Buang perubahan?"
        message="Perubahan pada formulir divisi atau unit belum disimpan."
        confirmText="Buang perubahan"
        danger
        onClose={closeGuard.keepEditing}
        onConfirm={closeGuard.discardChanges}
      />
    </>
  );
}
