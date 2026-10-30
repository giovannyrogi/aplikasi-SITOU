"use client";
import { useEffect, useRef, useState } from "react";
import { Button, DatePicker, Form, InputNumber, Radio, TimePicker } from "antd";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import FontStyle from "@/app/components/font-style/FontStyle";
import AppNotice from "@/app/components/data-display/AppNotice";
import ScheduleSummary from "./ScheduleSummary";
import { Box } from "@mui/material";
import dayjs from "dayjs";
import { readApiResponse, applyApiFieldErrors } from "@/lib/api/clientError";
/** Transport hanya membungkus helper error existing dan membatasi waktu tunggu. */
export async function scheduleRequest(url, body, signal) {
  return readApiResponse(
    await fetch(url, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(45000)])
        : AbortSignal.timeout(45000),
    }),
  );
}
export const requestKey = () => crypto.randomUUID();
export function applyFieldErrors(form, error) {
  return applyApiFieldErrors(form, error, {
    aliases: Object.fromEntries(
      Object.keys(error.fieldErrors || {}).map((k) => [
        k,
        k.split(".").map((x) => (/^\d+$/.test(x) ? Number(x) : x)),
      ]),
    ),
  });
}
export function DateField({ name, label, required = false, ...props }) {
  return (
    <Form.Item
      name={name}
      label={label}
      rules={required ? [{ required: true, message: "Isi tanggal." }] : []}
      normalize={(v) => v?.format("YYYY-MM-DD") || null}
      getValueProps={(v) => ({ value: v ? dayjs(v) : null })}
    >
      <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} {...props} />
    </Form.Item>
  );
}
export function TimeField({ name, label, required = false, disabled = false }) {
  return (
    <Form.Item
      name={name}
      label={label}
      rules={required ? [{ required: true, message: "Isi jam." }] : []}
      normalize={(v) => v?.format("HH:mm") || null}
      getValueProps={(v) => ({ value: v ? dayjs("2000-01-01T" + v) : null })}
    >
      <TimePicker disabled={disabled} format="HH:mm" showNow={false} style={{ width: "100%" }} />
    </Form.Item>
  );
}
export function MinutesField({ name, label, disabled = false }) {
  return (
    <Form.Item name={name} label={label + " (menit)"}>
      <InputNumber disabled={disabled} min={0} max={1440} precision={0} style={{ width: "100%" }} />
    </Form.Item>
  );
}
export function useScheduleOptions(org, master = false) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const [state, setState] = useState({ patterns: [], shifts: [], calendars: [], error: "" });
  useEffect(() => {
    if (!org) return;
    const c = new AbortController();
    Promise.resolve().then(() => {
      if (!c.signal.aborted)
        setState((s) => ({
          ...(s.organizationId === String(org) ? s : { patterns: [], shifts: [], calendars: [] }),
          organizationId: String(org),
          loading: true,
          error: "",
        }));
    });
    scheduleRequest(
      (master ? "/api/shift-patterns/options" : "/api/work-schedules/options") +
        "?organizationId=" +
        org +
        "&q=" +
        encodeURIComponent(query),
      null,
      c.signal,
    )
      .then((r) => {
        if (!c.signal.aborted)
          setState((previous) => {
            const next = { ...r.data, organizationId: String(org), error: "", loading: false };
            for (const key of ["patterns", "shifts", "calendars"])
              next[key] = Array.from(
                new Map(
                  [
                    ...(previous.organizationId === String(org) ? previous[key] || [] : []),
                    ...(r.data[key] || []),
                  ].map((x) => [x.id, x]),
                ).values(),
              );
            return next;
          });
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setState({
            patterns: [],
            shifts: [],
            calendars: [],
            organizationId: String(org),
            error: e.message,
            loading: false,
          });
      });
    return () => c.abort();
  }, [org, master, query, retry]);
  return state.organizationId === String(org)
    ? { ...state, onSearch: setSearch, onRetry: () => setRetry((x) => x + 1) }
    : {
        patterns: [],
        shifts: [],
        calendars: [],
        error: "",
        loading: Boolean(org),
        onSearch: setSearch,
        onRetry: () => setRetry((x) => x + 1),
      };
}
/** Dipakai pada onboarding dan form penetapan; semua tanggal disimpan sebagai date-only. */
export function WorkScheduleFields({
  organizationId,
  prefix = ["workSchedule"],
  optional = false,
  joinedDate,
  allowEndDate = true,
}) {
  const form = Form.useFormInstance();
  const chosen = Form.useWatch([...prefix, "patternId"], { form, preserve: true });
  const options = useScheduleOptions(organizationId);
  const pattern = options.patterns?.find((x) => x.id === chosen);
  const orgRef = useRef(organizationId);
  const from = Form.useWatch([...prefix, "from"], form);
  const joinedValue = Form.useWatch("joinedDate", form);
  const joined =
    joinedDate || (joinedValue?.format ? joinedValue.format("YYYY-MM-DD") : joinedValue);
  useEffect(() => {
    if (orgRef.current !== organizationId) {
      form.setFieldValue([...prefix, "patternId"], undefined);
      form.setFieldValue([...prefix, "from"], undefined);
      form.setFieldValue([...prefix, "until"], undefined);
      form.setFieldValue([...prefix, "anchorDate"], undefined);
      orgRef.current = organizationId;
    }
    if (chosen && options.today) {
      const start = joined && joined > options.today ? joined : options.today;
      if (!from) form.setFieldValue([...prefix, "from"], start);
      if (pattern?.pattern_type === "rotation" && !form.getFieldValue([...prefix, "anchorDate"]))
        form.setFieldValue([...prefix, "anchorDate"], from || start);
    }
  }, [organizationId, chosen, options.today, joined, from, pattern?.pattern_type, form, prefix]);
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        minWidth: 0,
        "& .ant-form-item": { marginBottom: 0 },
        "& .ant-radio-wrapper": { minHeight: 44, alignItems: "center" },
        "& .ant-radio-group": { display: "flex", flexWrap: "wrap", gap: 1 },
      }}
    >
      {optional && (
        <Form.Item label="Pengaturan jadwal">
          <Radio.Group
            value={chosen !== undefined && chosen !== null ? "choose" : "later"}
            onChange={(e) => {
              if (e.target.value === "later")
                form.setFieldValue([...prefix, "patternId"], undefined);
              else form.setFieldValue([...prefix, "patternId"], "");
            }}
            options={[
              { value: "later", label: "Atur jadwal nanti" },
              { value: "choose", label: "Pilih jadwal kerja" },
            ]}
          />
        </Form.Item>
      )}
      {(!optional || (chosen !== undefined && chosen !== null)) && (
        <>
          <Form.Item
            name={[...prefix, "patternId"]}
            label="Jadwal kerja"
            extra={
              <FontStyle explanation>
                Pilih jadwal tetap atau salah satu shift yang akan dijalani Pegawai.
              </FontStyle>
            }
            rules={
              optional
                ? [
                    {
                      validator: (_, value) =>
                        value === ""
                          ? Promise.reject(
                              new Error("Pilih jadwal kerja atau pilih Atur jadwal nanti."),
                            )
                          : Promise.resolve(),
                    },
                  ]
                : [{ required: true, message: "Pilih jadwal kerja." }]
            }
          >
            <AsyncSelect
              allowClear={optional}
              showSearch
              optionFilterProp="label"
              onSearch={options.onSearch}
              loading={options.loading}
              disabled={options.loading || Boolean(options.error)}
              options={(options.patterns || []).map((x) => ({ value: x.id, label: x.name }))}
              placeholder={options.loading ? "Memuat jadwal kerja..." : "Pilih jadwal kerja"}
            />
          </Form.Item>
          {options.error && (
            <AppNotice
              tone="danger"
              title="Jadwal kerja tidak dapat dimuat"
              description={options.error}
              action={<Button onClick={options.onRetry}>Coba lagi</Button>}
            />
          )}
          {!options.loading && !options.error && !options.patterns.length && (
            <AppNotice
              title="Belum ada jadwal kerja"
              description="Jadwal perlu dibuat dan diaktifkan melalui Data Master → Jadwal Kerja sebelum dapat dipilih."
            />
          )}
          {pattern?.days && (
            <ScheduleSummary
              days={pattern.days.slice(0, 7)}
              patternType={pattern.pattern_type}
              holidayPolicy={pattern.holiday_policy}
              calendarName={pattern.calendar_name}
            />
          )}
        </>
      )}
      {(!optional || chosen) && (
        <>
          <DateField name={[...prefix, "from"]} label="Mulai berlaku" required />
          {allowEndDate && <DateField name={[...prefix, "until"]} label="Berakhir (opsional)" />}
          {!allowEndDate && (
            <AppNotice
              compact
              title="Berlaku sampai diganti"
              description="Jadwal berlaku mulai tanggal yang dipilih sampai jadwal pengganti ditetapkan."
            />
          )}
          {pattern?.pattern_type === "rotation" && (
            <DateField
              name={[...prefix, "anchorDate"]}
              label="Tanggal hari pertama putaran"
              required
            />
          )}
        </>
      )}
    </Box>
  );
}
