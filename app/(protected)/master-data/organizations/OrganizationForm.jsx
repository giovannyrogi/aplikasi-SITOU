"use client";

import { useEffect } from "react";
import { Button, Col, DatePicker, Form, Input, Row } from "antd";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import ResponsiveRangePicker from "@/app/components/forms/ResponsiveRangePicker";
import FormSection from "@/app/components/forms/FormSection";
dayjs.extend(utc);
dayjs.extend(timezone);
import AppModal from "@/app/components/modals/AppModal";
import FormSettingSwitch from "@/app/components/forms/FormSettingSwitch";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import useFormModalClose from "@/app/hooks/useFormModalClose";

const TYPES = [
  { value: "company", label: "Organisasi" },
  { value: "holding", label: "Grup organisasi" },
  { value: "agency", label: "Instansi" },
];
export default function OrganizationForm({ open, item, onClose, onSaved, onError }) {
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const editing = Boolean(item);
  const selectedTimezone = Form.useWatch("timezone", form) || "Asia/Makassar";
  const accessRange = Form.useWatch(["initialSubscription", "accessRange"], form);
  const today = dayjs(dayjs().tz(selectedTimezone).format("YYYY-MM-DD"));
  const closeGuard = useFormModalClose(form, onClose);
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(
      item
        ? {
            name: item.name,
            legalName: item.legal_name,
            organizationType: item.organization_type,
            parentId: item.parent_id || undefined,
            timezone: item.timezone,
            attendanceMapProvider: item.attendance_map_provider ?? "openstreetmap",
            isActive: item.is_active,
          }
        : {
            organizationType: "company",
            timezone: "Asia/Makassar",
            attendanceMapProvider: "openstreetmap",
            isActive: true,
            initialSubscription: {
              accessRange: [
                dayjs().tz("Asia/Makassar"),
                dayjs().tz("Asia/Makassar").add(1, "year"),
              ],
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
          const { initialSubscription, ...identity } = values;
          const payload = {
            ...identity,
            parentId: values.parentId || null,
            legalName: values.legalName || null,
            ...(editing
              ? { version: new Date(item.updated_at).toISOString() }
              : {
                  initialSubscription: {
                    startsOn: initialSubscription.accessRange[0].format("YYYY-MM-DD"),
                    endsOn: initialSubscription.accessRange[1].format("YYYY-MM-DD"),
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
                  name: [
                    "initialSubscription.startsOn",
                    "initialSubscription.endsOn",
                    "startsOn",
                  ].includes(name)
                    ? ["initialSubscription", "accessRange"]
                    : name.split("."),
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
            ? "Perbarui identitas dan pengaturan organisasi."
            : "Isi identitas organisasi dan tentukan masa akses pertamanya."
        }
        icon="solar:buildings-3-bold-duotone"
        size="lg"
        footer={
          <>
            <Button onClick={closeGuard.requestClose}>Batal</Button>
            <Button type="primary" onClick={() => form.submit()}>
              Simpan organisasi
            </Button>
          </>
        }
      >
        <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
          <Row gutter={[16, 0]}>
            <Col xs={24}>
              <Form.Item name="name" label="Nama organisasi" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="legalName" label="Nama badan hukum (opsional)">
                <Input placeholder="Opsional" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="organizationType"
                label="Jenis organisasi"
                rules={[{ required: true }]}
              >
                <AsyncSelect options={TYPES} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="parentId" label="Organisasi induk (opsional)">
                <OrganizationSelect allowClear excludeIds={item ? [item.id] : []} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="timezone" label="Zona waktu" rules={[{ required: true }]}>
                <AsyncSelect
                  options={[
                    { value: "Asia/Makassar", label: "WITA - Asia/Makassar" },
                    { value: "Asia/Jakarta", label: "WIB - Asia/Jakarta" },
                    { value: "Asia/Jayapura", label: "WIT - Asia/Jayapura" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                name="attendanceMapProvider"
                label="Peta absensi"
                extra="Pilih layanan peta untuk menampilkan lokasi absensi."
              >
                <AsyncSelect
                  options={[
                    { value: "openstreetmap", label: "OpenStreetMap" },
                    { value: "google", label: "Google Maps" },
                  ]}
                />
              </Form.Item>
            </Col>
            {!editing && (
              <>
                <Col xs={24}>
                  <FormSection
                    first
                    title="Masa akses awal"
                    description="Tentukan periode akses SITOU. Masa tenggang memberi tambahan waktu setelah periode tersebut berakhir."
                    divider={false}
                  >
                    <Row gutter={[16, 0]}>
                      <Col xs={24} lg={14}>
                        <Form.Item
                          name={["initialSubscription", "accessRange"]}
                          label="Rentang tanggal akses"
                          rules={[
                            { required: true, message: "Pilih tanggal mulai dan akhir akses." },
                            {
                              validator: (_, value) =>
                                value?.[0] &&
                                value?.[1] &&
                                !value[0].isBefore(today, "day") &&
                                !value[1].isBefore(value[0], "day")
                                  ? Promise.resolve()
                                  : Promise.reject(
                                      new Error("Pilih rentang mulai hari ini atau setelahnya."),
                                    ),
                            },
                          ]}
                        >
                          <ResponsiveRangePicker
                            formField
                            format="DD MMM YYYY"
                            minDate={today}
                            allowClear={false}
                            style={{ width: "100%" }}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} lg={10}>
                        <Form.Item
                          name={["initialSubscription", "graceEndsOn"]}
                          label="Akhir masa tenggang (opsional)"
                          dependencies={[["initialSubscription", "accessRange"]]}
                          rules={[
                            {
                              validator: (_, value) =>
                                !value || (accessRange?.[1] && value.isAfter(accessRange[1], "day"))
                                  ? Promise.resolve()
                                  : Promise.reject(new Error("Pilih tanggal setelah akhir akses.")),
                            },
                          ]}
                        >
                          <DatePicker
                            defaultPickerValue={accessRange?.[1]?.add(1, "day")}
                            disabled={!accessRange?.[1]}
                            disabledDate={(date) =>
                              !accessRange?.[1] || !date.isAfter(accessRange[1], "day")
                            }
                            format="DD MMM YYYY"
                            style={{ width: "100%" }}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </FormSection>
                </Col>
                <Col xs={24}>
                  <Form.Item name={["initialSubscription", "notes"]} label="Catatan (opsional)">
                    <Input.TextArea rows={2} maxLength={2000} />
                  </Form.Item>
                </Col>
              </>
            )}
            <Col xs={24}>
              <FormSettingSwitch
                name="isActive"
                notice={{
                  on: {
                    title: "Akses organisasi aktif",
                    description:
                      "Akun organisasi dapat digunakan selama masa aksesnya berlaku dan sesuai hak masing-masing.",
                  },
                  off: {
                    title: "Akses organisasi tidak aktif",
                    description:
                      "Jika dinonaktifkan, seluruh akun organisasi tidak dapat masuk meskipun masa aksesnya masih berlaku. Data dan riwayat tetap tersimpan.",
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
        message="Perubahan pada formulir organisasi belum disimpan."
        confirmText="Buang perubahan"
        danger
        onClose={closeGuard.keepEditing}
        onConfirm={closeGuard.discardChanges}
      />
    </>
  );
}
