"use client";
import { useEffect, useState } from "react";
import { Button, Checkbox, Form, Input, InputNumber, Select, Space } from "antd";
import { Box } from "@mui/material";
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
      open={open}
      title={item ? "Edit data" : "Tambah data"}
      size="lg"
      onClose={onClose}
      disableClose={busy}
      footer={
        <Space wrap>
          <Button onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="primary" onClick={onSubmit} loading={busy}>
            Simpan
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
          rules={[{ required: true, message: "Isi nama." }]}
        >
          <Input maxLength={100} />
        </Form.Item>
        <Form.Item name="isActive" valuePropName="checked">
          <Checkbox>Aktif untuk pilihan baru</Checkbox>
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
                <Form.Item name={["rules", "nextDay"]} valuePropName="checked">
                  <Checkbox>Selesai pada hari berikutnya</Checkbox>
                </Form.Item>
                <MinutesField name={["rules", "breakMinutes"]} label="Istirahat" />
                <Form.Item name={["rules", "deductBreak"]} valuePropName="checked">
                  <Checkbox>Istirahat mengurangi durasi kerja</Checkbox>
                </Form.Item>
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
                <FontStyle fontWeight={600}>Tanggal libur</FontStyle>
                {fields.map((f) => (
                  <Box
                    key={f.key}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 2fr auto" },
                      gap: 1,
                      mt: 2,
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
                    <Button onClick={() => remove(f.name)} style={{ minHeight: 44 }}>
                      Hapus
                    </Button>
                  </Box>
                ))}
                <Button onClick={() => add({})} disabled={fields.length >= 366}>
                  Tambah tanggal
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
      </Form>
    </AppModal>
  );
}
