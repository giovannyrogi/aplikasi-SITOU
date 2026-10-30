"use client";
import { useEffect, useState } from "react";
import { Button, Form, Input, InputNumber, Space, Tooltip } from "antd";
import AppIcon from "@/app/components/icons/AppIcon";
import Select from "@/app/components/forms/AsyncSelect";
import FormSettingSwitch from "@/app/components/forms/FormSettingSwitch";
import { Box, Divider } from "@mui/material";
import AppModal from "@/app/components/modals/AppModal";
import FontStyle from "@/app/components/font-style/FontStyle";
import { DateField, TimeField, MinutesField, useScheduleOptions } from "./ScheduleFields";
const weekdays = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
export const defaultRules = {
  type: "fixed",
  startTime: "09:00",
  endTime: "17:00",
  windowStart: null,
  windowEnd: null,
  latestFinish: null,
  requiredMinutes: 0,
  breakMinutes: 0,
  deductBreak: true,
  nextDay: false,
  lateTolerance: 0,
  earlyTolerance: 0,
};
export function masterValues(item, kind, copy = false) {
  const base = {
    name: copy ? item.name + " (salinan)" : item?.name || "",
    isActive: item?.is_active ?? true,
  };
  if (item && !copy) {
    base.id = item.id;
    base.version = item.version;
  }
  if (kind === "shifts") return { ...base, rules: item?.revisions?.at(-1)?.rules || defaultRules };
  if (kind === "calendars") return { ...base, days: item?.days || [] };
  return {
    ...base,
    patternType: item?.pattern_type || "weekly",
    cycleDays: item?.cycle_days || 7,
    calendarId: item?.calendar_id ? String(item.calendar_id) : null,
    holidayPolicy: item?.holiday_policy || "roster",
    days: item?.days || Array.from({ length: 7 }, (_, i) => ({ day: i + 1, shiftIds: [] })),
  };
}
/** Editor reusable dengan label pengguna; ID/revisi tetap metadata request. */
export default function MasterEditor({
  open,
  kind,
  item,
  form,
  organizationId,
  onClose,
  onSubmit,
  busy,
}) {
  const type = Form.useWatch(["rules", "type"], form);
  const patternType = Form.useWatch("patternType", form);
  const cycle = Form.useWatch("cycleDays", form) || 7;
  const opts = useScheduleOptions(organizationId, true);
  const [dayPage, setDayPage] = useState(1);
  useEffect(() => {
    if (open) Promise.resolve().then(() => setDayPage(1));
  }, [open]);
  const choices = (opts.shifts || []).map((x) => ({ value: x.id, label: x.name }));
  const updateCycle = (n) => {
    const old = form.getFieldValue("days") || [];
    form.setFieldsValue({
      cycleDays: n,
      days: Array.from(
        { length: n },
        (_, i) => old.find((x) => x.day === i + 1) || { day: i + 1, shiftIds: [] },
      ),
    });
  };
  return (
    <AppModal
      scrollHeaderWithContent
      open={open}
      title={
        kind === "calendars"
          ? item
            ? "Edit kalender libur"
            : "Buat kalender libur"
          : item
            ? "Edit pengaturan kerja"
            : "Tambah pengaturan kerja"
      }
      description={
        kind === "calendars"
          ? "Masukkan tanggal dan nama hari libur. Kalender dapat dipilih pada jadwal kerja sesuai kebutuhan organisasi."
          : "Atur jam atau susunan hari kerja. Perubahan pada jadwal yang sudah digunakan tetap mengikuti aturan perlindungan riwayat."
      }
      size="lg"
      onClose={onClose}
      disableClose={busy}
      footer={
        <Space wrap>
          <Button onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="primary" onClick={onSubmit} loading={busy}>
            {kind === "calendars" ? "Simpan kalender" : "Simpan"}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={onSubmit}>
        <Form.Item
          name="name"
          label={
            kind === "shifts" ? "Nama shift" : kind === "patterns" ? "Nama pola" : "Nama kalender"
          }
          rules={[
            { required: true, message: kind === "calendars" ? "Isi nama kalender." : "Isi nama." },
          ]}
        >
          <Input maxLength={100} />
        </Form.Item>
        {kind === "shifts" && (
          <>
            <Form.Item name={["rules", "type"]} label="Jenis jam kerja">
              <Select
                options={[
                  { value: "fixed", label: "Jam tetap" },
                  { value: "flexible", label: "Jam fleksibel" },
                  { value: "off", label: "Libur" },
                  ...(type === "field"
                    ? [{ value: "field", label: "Lapangan", disabled: true }]
                    : []),
                ]}
              />
            </Form.Item>
            {type !== "off" && type !== "field" && (
              <Box
                sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}
              >
                {type === "fixed" ? (
                  <>
                    <TimeField name={["rules", "startTime"]} label="Jam masuk" required />
                    <TimeField name={["rules", "endTime"]} label="Jam pulang" required />
                  </>
                ) : (
                  <>
                    <TimeField name={["rules", "windowStart"]} label="Boleh masuk mulai" required />
                    <TimeField name={["rules", "windowEnd"]} label="Batas masuk" required />
                    <TimeField name={["rules", "latestFinish"]} label="Batas selesai" required />
                    <MinutesField name={["rules", "requiredMinutes"]} label="Target kerja" />
                  </>
                )}
                <FormSettingSwitch
                  name={["rules", "nextDay"]}
                  title="Pulang hari berikutnya"
                  description="Aktifkan jika jam pulang melewati tengah malam, misalnya 22.00–06.00 besok."
                />
                <MinutesField name={["rules", "breakMinutes"]} label="Istirahat" />
                <FormSettingSwitch
                  name={["rules", "deductBreak"]}
                  title="Kurangi durasi kerja dengan istirahat"
                  description="Aktifkan agar waktu istirahat dikurangi dari rentang jam kerja."
                />
                <MinutesField name={["rules", "lateTolerance"]} label="Toleransi terlambat" />
                <MinutesField name={["rules", "earlyTolerance"]} label="Toleransi pulang awal" />
              </Box>
            )}
            {item && (
              <>
                <DateField name="effectiveFrom" label="Mulai berlaku untuk revisi jam" />
                <Form.Item name="reason" label="Alasan revisi">
                  <Input.TextArea maxLength={1000} rows={2} />
                </Form.Item>
                <FontStyle fontSize={12}>
                  Perubahan jam yang sudah digunakan berlaku paling cepat besok.
                </FontStyle>
              </>
            )}
          </>
        )}
        {kind === "calendars" && (
          <Form.List name="days">
            {(fields, { add, remove }) => (
              <>
                <Divider sx={{ my: 3 }} />
                <FontStyle fontWeight={600}>Tanggal libur</FontStyle>
                <FontStyle explanation sx={{ mt: 1, mb: 2, textAlign: "left" }}>
                  Tambahkan tanggal dan nama hari libur yang berlaku bagi organisasi.
                </FontStyle>
                {fields.map((f) => (
                  <Box
                    key={f.key}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "minmax(0, 1fr)",
                        sm: "minmax(0, 1fr) minmax(0, 2fr) auto",
                      },
                      gap: 2,
                      alignItems: "start",
                      mb: 3,
                      "& .ant-form-item": { mb: 0 },
                    }}
                  >
                    <DateField name={[f.name, "date"]} label="Tanggal" required />
                    <Form.Item
                      name={[f.name, "name"]}
                      label="Nama hari libur"
                      rules={[{ required: true, message: "Isi nama hari libur." }]}
                    >
                      <Input maxLength={100} />
                    </Form.Item>
                    <Box
                      sx={{ "& .ant-form-item-label": { display: { xs: "none", sm: "block" } } }}
                    >
                      <Form.Item label={<span aria-hidden="true">&nbsp;</span>}>
                        <Tooltip title="Hapus tanggal libur" trigger={["hover", "focus"]}>
                          <Button
                            danger
                            aria-label={"Hapus tanggal libur " + (f.name + 1)}
                            onClick={() => remove(f.name)}
                            icon={<AppIcon icon="solar:trash-bin-trash-linear" fontSize={20} />}
                            style={{
                              width: 44,
                              minHeight: 44,
                              height: 44,
                              padding: 0,
                            }}
                          />
                        </Tooltip>
                      </Form.Item>
                    </Box>
                  </Box>
                ))}
                <Button
                  onClick={() => add({})}
                  disabled={fields.length >= 366}
                  style={{ minHeight: 44, height: "auto", maxWidth: "100%", whiteSpace: "normal" }}
                >
                  Tambah tanggal libur
                </Button>
              </>
            )}
          </Form.List>
        )}
        {kind === "patterns" && (
          <>
            <Form.Item name="patternType" label="Jenis pola">
              <Select
                onChange={(v) => {
                  if (v === "weekly") updateCycle(7);
                }}
                options={[
                  { value: "weekly", label: "Mingguan" },
                  { value: "rotation", label: "Rotasi" },
                ]}
              />
            </Form.Item>
            {patternType === "rotation" && (
              <Form.Item
                name="cycleDays"
                label="Jumlah hari dalam pola"
                rules={[{ required: true, message: "Isi jumlah hari." }]}
              >
                <InputNumber
                  min={1}
                  max={366}
                  precision={0}
                  onChange={(n) => {
                    if (Number.isInteger(n) && n >= 1 && n <= 366) updateCycle(n);
                  }}
                />
              </Form.Item>
            )}
            <Form.Item name="calendarId" label="Kalender libur (opsional)">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                onSearch={opts.onSearch}
                options={(opts.calendars || []).map((x) => ({ value: x.id, label: x.name }))}
              />
            </Form.Item>
            <Form.Item name="holidayPolicy" label="Saat hari libur">
              <Select
                options={[
                  { value: "roster", label: "Tetap mengikuti jadwal" },
                  { value: "calendar", label: "Libur mengikuti kalender" },
                ]}
              />
            </Form.Item>
            {opts.error && <div role="alert">{opts.error}</div>}
            <FontStyle fontSize={12}>
              Pilih beberapa shift sesuai urutan sesi. Kosong berarti Libur. Maksimal 16 sesi per
              hari.
            </FontStyle>
            <Form.List name="days">
              {(fields) => (
                <>
                  {fields.slice((dayPage - 1) * 14, dayPage * 14).map((f) => (
                    <Form.Item
                      key={f.key}
                      name={[f.name, "shiftIds"]}
                      label={patternType === "weekly" ? weekdays[f.name] : "Hari " + (f.name + 1)}
                    >
                      <Select
                        mode="multiple"
                        showSearch
                        optionFilterProp="label"
                        onSearch={opts.onSearch}
                        options={choices}
                        maxCount={16}
                        maxTagCount="responsive"
                        placeholder="Libur"
                      />
                    </Form.Item>
                  ))}
                  {cycle > 14 && (
                    <Space>
                      <Button disabled={dayPage === 1} onClick={() => setDayPage((x) => x - 1)}>
                        Sebelumnya
                      </Button>
                      <span>
                        Bagian {dayPage} / {Math.ceil(cycle / 14)}
                      </span>
                      <Button
                        disabled={dayPage * 14 >= cycle}
                        onClick={() => setDayPage((x) => x + 1)}
                      >
                        Berikutnya
                      </Button>
                    </Space>
                  )}
                </>
              )}
            </Form.List>
          </>
        )}
        <Divider sx={{ mt: 3, mb: 1 }} />
        <FormSettingSwitch
          name="isActive"
          notice={{
            on: {
              title: kind === "calendars" ? "Kalender aktif" : "Pengaturan aktif",
              description:
                kind === "calendars"
                  ? "Kalender dapat dipilih pada jadwal kerja."
                  : "Pengaturan dapat dipilih untuk jadwal baru.",
            },
            off: {
              title: kind === "calendars" ? "Kalender nonaktif" : "Pengaturan nonaktif",
              description:
                kind === "calendars"
                  ? "Kalender tidak dapat dipilih pada jadwal baru. Jadwal yang sudah menggunakan kalender ini tetap tersimpan."
                  : "Tidak tersedia untuk pilihan baru. Pengaturan yang sudah digunakan tetap tersimpan.",
            },
          }}
        />
      </Form>
    </AppModal>
  );
}
