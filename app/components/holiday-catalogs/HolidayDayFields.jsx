"use client";
import AppCollapse from "@/app/components/data-display/AppCollapse";
import { useEffect, useState } from "react";
import { Form, Input } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { Box } from "@mui/material";
import dayjs from "dayjs";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import { DateField } from "@/app/components/work-schedules/ScheduleFields";
import IconActionButton from "@/app/components/actions/IconActionButton";
import EmptyState from "@/app/components/data-display/EmptyState";
import AppNotice from "@/app/components/data-display/AppNotice";
import FontStyle from "@/app/components/font-style/FontStyle";
import { categoryLabel, displayDate } from "./HolidayDateList";

function HolidayDayPanel({ field, value = {}, evidence, year, remove, validationFailure }) {
  const form = Form.useFormInstance();
  const [expanded, setExpanded] = useState(() => !value.date || !value.name?.trim());
  useEffect(() => {
    const errors = validationFailure?.fields || [];
    if (!errors.some(({ name }) => name[0] === "days" && name[1] === field.name)) return;
    let cancelled = false;
    let frame;
    queueMicrotask(() => {
      if (cancelled) return;
      setExpanded(true);
      frame = requestAnimationFrame(() => {
        if (cancelled) return;
        if (errors[0]?.name[0] === "days" && errors[0].name[1] === field.name)
          form.scrollToField(errors[0].name, { focus: true, block: "nearest" });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [validationFailure, field.name, form]);
  const dateLabel =
    value.date && dayjs(value.date).isValid() ? displayDate(value.date) : "Pilih tanggal";
  return (
    <AppCollapse
      activeKey={expanded ? ["day"] : []}
      onChange={(keys) => setExpanded(keys.includes("day"))}
      items={[
        {
          key: "day",
          forceRender: true,
          label: (
            <Box sx={{ minWidth: 0, display: "grid", gap: 0.5 }}>
              <FontStyle fontWeight={600} fontSize={14}>
                {dateLabel}
              </FontStyle>
              <FontStyle color="text.secondary" fontSize={14}>
                {value.name?.trim() || "Isi nama hari libur"}
              </FontStyle>
              <FontStyle color="text.secondary" fontSize={14}>
                {categoryLabel(value.category || "national")}
              </FontStyle>
            </Box>
          ),
          extra: (
            <Box
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <IconActionButton
                label={`Hapus ${dateLabel}${value.name ? ` · ${value.name}` : ""}`}
                danger
                icon={<DeleteOutlined />}
                onClick={() => remove(field.name)}
              />
            </Box>
          ),
          children: (
            <Box sx={{ display: "grid", gap: 2, minWidth: 0 }}>
              {evidence && (
                <Box sx={{ display: "grid", gap: 1 }}>
                  <FontStyle color="text.secondary">Halaman sumber: {evidence.page}</FontStyle>
                  <FontStyle color="text.secondary">Teks sumber: {evidence.raw}</FontStyle>
                  {evidence.needsReview && (
                    <AppNotice
                      tone="warning"
                      title="Perlu diperiksa"
                      description={evidence.reviewReason}
                    />
                  )}
                </Box>
              )}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "minmax(0,1fr)",
                    sm: "repeat(2,minmax(0,1fr))",
                    md: "minmax(0,1fr) minmax(0,2fr) minmax(0,1fr)",
                  },
                  gap: 2,
                  "& .ant-form-item": { mb: 0 },
                }}
              >
                <DateField
                  name={[field.name, "date"]}
                  label="Tanggal"
                  required
                  disabledDate={(date) => Boolean(year) && date.year() !== Number(year)}
                  {...(year ? { defaultPickerValue: dayjs(`${year}-01-01`) } : {})}
                />
                <Form.Item
                  name={[field.name, "name"]}
                  label="Nama hari libur"
                  rules={[{ required: true, whitespace: true, message: "Isi nama hari libur." }]}
                >
                  <Input maxLength={100} placeholder="Nama sesuai SKB" />
                </Form.Item>
                <Box sx={{ gridColumn: { xs: "auto", sm: "1 / -1", md: "auto" } }}>
                  <Form.Item
                    name={[field.name, "category"]}
                    label="Kategori"
                    rules={[{ required: true, message: "Pilih kategori." }]}
                  >
                    <AsyncSelect
                      options={[
                        { value: "national", label: "Libur nasional" },
                        { value: "joint_leave", label: "Cuti bersama" },
                      ]}
                    />
                  </Form.Item>
                </Box>
              </Box>
            </Box>
          ),
        },
      ]}
    />
  );
}
export default function HolidayDayFields({ evidence = [], year, validationFailure }) {
  const form = Form.useFormInstance();
  const values =
    Form.useWatch("days", { form, preserve: true }) || form.getFieldValue("days") || [];
  return (
    <Form.List name="days">
      {(fields, { add, remove }) => (
        <Box sx={{ display: "grid", gap: 2 }}>
          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}
          >
            <FontStyle fontSize={14} color="text.secondary">
              {fields.length} / 366 tanggal
            </FontStyle>
            <IconActionButton
              label="Tambah tanggal"
              icon={<PlusOutlined />}
              disabled={fields.length >= 366}
              onClick={() => {
                const index = fields.length;
                add({ date: null, name: "", category: "national" });
                requestAnimationFrame(() =>
                  form.getFieldInstance(["days", index, "date"])?.focus(),
                );
              }}
            />
          </Box>
          {!fields.length && (
            <EmptyState
              compact
              description="Belum ada tanggal hari libur. Tambahkan tanggal sesuai SKB."
            />
          )}
          {fields.map((field) => (
            <HolidayDayPanel
              key={field.key}
              field={field}
              value={values[field.name]}
              evidence={evidence.find((day) => day.date === values[field.name]?.date)}
              year={year}
              remove={remove}
              validationFailure={validationFailure}
            />
          ))}
        </Box>
      )}
    </Form.List>
  );
}
