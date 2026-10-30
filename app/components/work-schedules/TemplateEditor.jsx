"use client";
import { useEffect, useState } from "react";
import { Button, Checkbox, Collapse, Form, Input, Space } from "antd";
import { Box, Divider } from "@mui/material";
import FormSettingSwitch from "@/app/components/forms/FormSettingSwitch";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import AppModal from "@/app/components/modals/AppModal";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import { useScheduleOptions } from "./ScheduleFields";
import { weekNames } from "./ScheduleSummary";

import { emptyRules, weeklyScheduleDays } from "./scheduleForm.mjs";
import WorkTimeFields from "./WorkTimeFields";
import ShiftGroupFields from "./ShiftGroupFields";
import ScheduleSummary from "./ScheduleSummary";
import AppNotice from "@/app/components/data-display/AppNotice";
export default function TemplateEditor({
  open,
  form,
  item,
  organizationId,
  onSubmit,
  onClose,
  busy,
  validationFocus,
}) {
  const values = Form.useWatch([], { form, preserve: true }) || {};
  const opts = useScheduleOptions(organizationId, true);
  const [editedDay, setEditedDay] = useState(null);
  const [dailyOpen, setDailyOpen] = useState(false);
  useEffect(() => {
    if (!validationFocus?.day) return;
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setDailyOpen(true);
        setEditedDay(validationFocus.day);
      }
    });
    return () => {
      active = false;
    };
  }, [validationFocus]);
  const locked = Boolean(item?.used);
  const weekly = values.workType === "fixed";
  const shiftMode = values.workType === "shift";
  const legacy = values.workType === "legacy";
  const days = weekly ? weeklyScheduleDays(values) : values.days || [];
  const customDays = values.customDays || [];
  const selectedDays = weekly ? days.filter((d) => values.workingDays?.includes(d.day)) : days;
  const setDay = (day, sessions, customize = true) => {
    const raw = values.days || days;
    form.setFieldsValue({
      days: raw.map((d) => (d.day === day ? { ...d, sessions: structuredClone(sessions) } : d)),
      customDays: customize ? [...new Set([...customDays, day])] : customDays,
      differentDays: true,
    });
  };
  const editDay = (day) => {
    if (editedDay === day.day) {
      setEditedDay(null);
      return;
    }
    if (!locked && (!weekly || !customDays.includes(day.day)))
      setDay(
        day.day,
        day.sessions.length
          ? day.sessions
          : [{ rules: weekly ? values.sharedRules || emptyRules() : emptyRules() }],
        false,
      );
    setEditedDay(day.day);
  };
  const clearReference = (changed) => {
    if (
      changed.sharedRules &&
      weekly &&
      editedDay &&
      !(form.getFieldValue("customDays") || []).includes(editedDay)
    ) {
      const index = (form.getFieldValue("days") || []).findIndex((day) => day.day === editedDay);
      if (index >= 0)
        form.setFieldValue(
          ["days", index, "sessions"],
          [{ rules: structuredClone(form.getFieldValue("sharedRules")) }],
        );
    }
    changed.days?.forEach((day, di) =>
      day?.sessions?.forEach((s, si) => {
        if (s?.rules) {
          form.setFieldValue(["days", di, "sessions", si, "shiftId"], undefined);
          if (weekly)
            form.setFieldValue("customDays", [
              ...new Set([...(form.getFieldValue("customDays") || []), di + 1]),
            ]);
        }
      }),
    );
  };
  const renderDay = (day) => {
    const di = (values.days || days).findIndex((d) => d.day === day.day);
    const label = weekNames[day.day - 1],
      rule = day.sessions[0]?.rules;
    return (
      <Box
        key={day.day}
        sx={{
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          p: { xs: 2, sm: 3 },
          display: "grid",
          gap: 3,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "stretch", sm: "flex-start" },
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center", mb: 1 }}>
              <FontStyle fontWeight={600} fontSize={14}>
                {label}
              </FontStyle>
              <CompactInfoChip
                label={customDays.includes(day.day) ? "Jam khusus" : "Jam utama"}
                tone={customDays.includes(day.day) ? "info" : "neutral"}
                sx={{
                  height: "auto",
                  minHeight: 24,
                  "& .MuiChip-label": { whiteSpace: "normal", lineHeight: 1.4, py: 0.5 },
                }}
              />
            </Box>
            <FontStyle>
              {rule?.startTime && rule?.endTime
                ? `${rule.startTime}–${rule.endTime}${rule.nextDay ? " besok" : ""}`
                : "Jam belum diisi"}
            </FontStyle>
          </Box>
          <Button
            onClick={() => editDay(day)}
            aria-label={`${editedDay === day.day ? "Tutup pengaturan" : locked ? "Lihat jam" : "Ubah jam"} ${label}`}
          >
            {editedDay === day.day ? "Tutup" : locked ? "Lihat jam" : "Ubah jam"}
          </Button>
        </Box>
        {editedDay === day.day && (
          <>
            <Divider />
            <WorkTimeFields
              prefix={["days", di, "sessions", 0, "rules"]}
              readOnly={locked}
              validationFocus={validationFocus}
            />
          </>
        )}
      </Box>
    );
  };
  return (
    <AppModal
      scrollHeaderWithContent
      open={open}
      title={item ? "Edit jadwal kerja" : "Buat jadwal kerja"}
      description="Pilih jenis jam kerja, lalu atur hari dan jamnya. Periksa ringkasan sebelum menyimpan."
      size="lg"
      onClose={onClose}
      disableClose={busy}
      contentSx={{
        "& .ant-checkbox-wrapper, & .ant-radio-wrapper": { minHeight: 44, alignItems: "center" },
        "& .ant-checkbox-group": {
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", sm: "repeat(4,minmax(0,1fr))" },
          gap: 1,
        },
      }}
      footer={
        <Space wrap>
          <Button onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button
            type="primary"
            loading={busy}
            onClick={() => onSubmit(opts.calendars.find((c) => c.id === values.calendarId)?.name)}
          >
            Simpan jadwal
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" requiredMark={false} onValuesChange={clearReference}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              md: legacy ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))",
            },
            columnGap: 2,
          }}
        >
          <Form.Item
            name="name"
            label="Nama jadwal"
            rules={[{ required: true, whitespace: true, message: "Isi nama jadwal." }]}
          >
            <Input maxLength={100} />
          </Form.Item>
          {!legacy && (
            <Form.Item
              name="workType"
              label="Jenis jam kerja"
              rules={[{ required: true, message: "Pilih jenis jam kerja." }]}
            >
              <AsyncSelect
                disabled={Boolean(item)}
                placeholder="Pilih jenis jam kerja"
                options={[
                  { value: "fixed", label: "Jam kerja tetap" },
                  { value: "shift", label: "Kerja shift" },
                ]}
              />
            </Form.Item>
          )}
        </Box>
        {locked && (
          <AppNotice
            tone="info"
            title="Jadwal sudah digunakan"
            description="Nama dan status tetap dapat diubah. Buat salinan jadwal untuk mengubah hari atau jam kerja."
          />
        )}
        {legacy && (
          <Box sx={{ display: "grid", gap: 3, my: 3 }}>
            <AppNotice
              tone="info"
              title="Jadwal dengan pengaturan lama"
              description="Nama dan status tetap dapat diubah. Buat jadwal baru untuk menggunakan pengaturan jam tetap atau shift."
            />
            <ScheduleSummary days={values.days} patternType={values.patternType} showSettings />
          </Box>
        )}
        {shiftMode && (
          <>
            <Divider sx={{ my: 3 }} />
            <ShiftGroupFields locked={locked} validationFocus={validationFocus} />
          </>
        )}
        {weekly && (
          <>
            <Divider sx={{ my: 3 }} />
            <Form.Item
              name="workingDays"
              label="Hari kerja"
              rules={[{ required: true, message: "Pilih hari kerja." }]}
            >
              <Checkbox.Group
                disabled={locked}
                options={weekNames.map((label, index) => ({ label, value: index + 1 }))}
              />
            </Form.Item>
            <FontStyle explanation>Hari yang tidak dipilih adalah libur.</FontStyle>
            <Divider sx={{ my: 3 }} />
            {selectedDays.some((d) => !customDays.includes(d.day)) && (
              <>
                <FontStyle component="h3" fontSize={14} fontWeight={600} sx={{ mb: 2 }}>
                  Jam kerja utama
                </FontStyle>
                <FontStyle explanation sx={{ mb: 2 }}>
                  Berlaku untuk hari kerja yang menggunakan jam utama.
                </FontStyle>
                <WorkTimeFields
                  prefix={["sharedRules"]}
                  readOnly={locked}
                  validationFocus={validationFocus}
                />
              </>
            )}
            {selectedDays.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Collapse
                  activeKey={dailyOpen ? ["daily"] : []}
                  onChange={(keys) => setDailyOpen(keys.includes("daily"))}
                  items={[
                    {
                      key: "daily",
                      label: "Atur jam kerja per hari",
                      children: (
                        <Box sx={{ display: "grid", gap: 2 }}>
                          <FontStyle explanation>
                            Gunakan jika ada hari yang jam kerjanya berbeda. Hari yang tidak diubah
                            tetap mengikuti jam utama.
                          </FontStyle>
                          {selectedDays.map(renderDay)}
                        </Box>
                      ),
                    },
                  ]}
                />
              </Box>
            )}
          </>
        )}
        {!legacy && values.workType && (
          <>
            <Divider sx={{ my: 3 }} />
            <FontStyle component="h3" fontSize={14} fontWeight={600} sx={{ mb: 2 }}>
              Aturan hari libur
            </FontStyle>
            <Form.Item name="calendarId" label="Kalender libur (opsional)">
              <AsyncSelect
                allowClear
                disabled={locked}
                loading={opts.loading}
                options={opts.calendars.map((c) => ({ value: c.id, label: c.name }))}
                onSearch={opts.onSearch}
                onChange={() => form.setFieldValue("holidayPolicy", undefined)}
              />
            </Form.Item>
            {opts.error && (
              <Box role="alert">
                <FontStyle>{opts.error}</FontStyle>
                <Button onClick={opts.onRetry}>Coba lagi</Button>
              </Box>
            )}
            {values.calendarId && (
              <Form.Item
                name="holidayPolicy"
                label="Saat tanggal libur"
                rules={[{ required: true, message: "Pilih ketentuan saat tanggal libur." }]}
              >
                <AsyncSelect
                  disabled={locked}
                  options={[
                    { value: "calendar", label: "Libur mengikuti kalender" },
                    { value: "roster", label: "Tetap bekerja sesuai jadwal" },
                  ]}
                />
              </Form.Item>
            )}
          </>
        )}
        <Divider sx={{ my: 3 }} />
        <FormSettingSwitch
          name="isActive"
          notice={{
            on: { title: "Jadwal aktif", description: "Jadwal dapat dipilih untuk Pegawai." },
            off: {
              title: "Jadwal nonaktif",
              description:
                "Jadwal tidak dapat dipilih untuk penetapan baru. Jadwal Pegawai yang sudah ada tetap tersimpan.",
            },
          }}
        />
      </Form>
    </AppModal>
  );
}
