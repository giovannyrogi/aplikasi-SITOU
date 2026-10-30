"use client";
import { useEffect, useState } from "react";
import { Button, Checkbox, Collapse, Form, Input } from "antd";
import { Box, Divider } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";
import AppNotice from "@/app/components/data-display/AppNotice";
import WorkTimeFields from "./WorkTimeFields";
import { weekNames } from "./ScheduleSummary";
import { emptyRules } from "./scheduleForm.mjs";

function ShiftPanel({ field, locked, removable, remove, validationFocus }) {
  const form = Form.useFormInstance();
  const shift = Form.useWatch(["shifts", field.name], { form, preserve: true }) || {};
  const [expanded, setExpanded] = useState(
    () => !form.getFieldValue(["shifts", field.name, "name"]),
  );
  const scope = `shifts.${field.name}.`;
  useEffect(() => {
    if (!validationFocus?.path?.startsWith(scope)) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setExpanded(true);
    });
    return () => {
      active = false;
    };
  }, [scope, validationFocus]);
  return (
    <Collapse
      activeKey={expanded ? ["shift"] : []}
      onChange={(keys) => setExpanded(keys.includes("shift"))}
      items={[
        {
          key: "shift",
          forceRender: true,
          label: (
            <Box sx={{ minWidth: 0, display: "grid", gap: 0.5 }}>
              <FontStyle fontWeight={600}>
                {shift.name?.trim() || `Shift ${field.name + 1}`}
              </FontStyle>
              <FontStyle color="text.secondary">
                {shift.rules?.startTime && shift.rules?.endTime
                  ? `${shift.rules.startTime}–${shift.rules.endTime}${shift.rules.nextDay ? " · Pulang hari berikutnya" : ""}`
                  : "Isi nama dan jam kerja shift"}
              </FontStyle>
            </Box>
          ),
          children: (
            <Box sx={{ p: { xs: 0, sm: 1 } }}>
              <Form.Item
                name={[field.name, "name"]}
                label={`Nama shift ${field.name + 1}`}
                rules={[{ required: true, whitespace: true, message: "Isi nama shift." }]}
              >
                <Input maxLength={100} disabled={locked} />
              </Form.Item>
              <WorkTimeFields
                prefix={[field.name, "rules"]}
                watchPrefix={["shifts", field.name, "rules"]}
                readOnly={locked}
                validationFocus={validationFocus}
              />
              {!locked && removable && (
                <>
                  <Divider sx={{ my: 3 }} />
                  <Button danger onClick={() => remove(field.name)}>
                    Hapus shift {field.name + 1}
                  </Button>
                </>
              )}
            </Box>
          ),
        },
      ]}
    />
  );
}
export default function ShiftGroupFields({ locked, validationFocus }) {
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
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
      <AppNotice
        tone="info"
        title="Hari libur dan pilihan shift"
        description="Hari yang tidak dipilih adalah libur. HRD memilih satu shift untuk setiap Pegawai saat menetapkan jadwal."
      />
      <Form.List name="shifts">
        {(fields, { add, remove }) => (
          <>
            {fields.map((field) => (
              <ShiftPanel
                key={field.key}
                field={field}
                locked={locked}
                removable={fields.length > 1}
                remove={remove}
                validationFocus={validationFocus}
              />
            ))}
            {!locked && fields.length < 16 && (
              <Button onClick={() => add({ name: "", rules: emptyRules() })}>Tambah shift</Button>
            )}
            {!locked && fields.length >= 16 && (
              <FontStyle explanation>Satu jadwal memuat maksimal 16 shift.</FontStyle>
            )}
          </>
        )}
      </Form.List>
    </Box>
  );
}
