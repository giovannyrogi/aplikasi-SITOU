"use client";
import { useEffect, useState } from "react";
import { DatePicker, Form, InputNumber, TimePicker, Select } from "antd";
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
export function TimeField({ name, label, required = false }) {
  return (
    <Form.Item
      name={name}
      label={label}
      rules={required ? [{ required: true, message: "Isi jam." }] : []}
      normalize={(v) => v?.format("HH:mm") || null}
      getValueProps={(v) => ({ value: v ? dayjs("2000-01-01T" + v) : null })}
    >
      <TimePicker format="HH:mm" style={{ width: "100%" }} />
    </Form.Item>
  );
}
export function MinutesField({ name, label }) {
  return (
    <Form.Item name={name} label={label + " (menit)"}>
      <InputNumber min={0} max={1440} precision={0} style={{ width: "100%" }} />
    </Form.Item>
  );
}
export function useScheduleOptions(org, master = false) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const [state, setState] = useState({ patterns: [], shifts: [], calendars: [], error: "" });
  useEffect(() => {
    if (!org) return;
    const c = new AbortController();
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
            const next = { ...r.data, organizationId: String(org), error: "" };
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
          });
      });
    return () => c.abort();
  }, [org, master, query]);
  return state.organizationId === String(org)
    ? { ...state, onSearch: setSearch }
    : { patterns: [], shifts: [], calendars: [], error: "", onSearch: setSearch };
}
/** Dipakai pada onboarding dan form penetapan; semua tanggal disimpan sebagai date-only. */
export function WorkScheduleFields({
  organizationId,
  prefix = ["workSchedule"],
  optional = false,
}) {
  const form = Form.useFormInstance();
  const chosen = Form.useWatch([...prefix, "patternId"], form);
  const options = useScheduleOptions(organizationId);
  const pattern = options.patterns?.find((x) => x.id === chosen);
  return (
    <>
      <Form.Item
        name={[...prefix, "patternId"]}
        label={optional ? "Pola kerja (opsional)" : "Pola kerja"}
        rules={optional ? [] : [{ required: true, message: "Pilih pola kerja." }]}
      >
        <Select
          allowClear={optional}
          showSearch
          optionFilterProp="label"
          onSearch={options.onSearch}
          options={(options.patterns || []).map((x) => ({ value: x.id, label: x.name }))}
          placeholder="Pilih pola kerja"
        />
      </Form.Item>
      {options.error && <div role="alert">{options.error}</div>}
      {(!optional || chosen) && (
        <>
          <DateField name={[...prefix, "from"]} label="Mulai berlaku" required />
          <DateField name={[...prefix, "until"]} label="Berakhir (opsional)" />
          {pattern?.pattern_type === "rotation" && (
            <DateField
              name={[...prefix, "anchorDate"]}
              label="Tanggal hari pertama pola"
              required
            />
          )}
        </>
      )}
    </>
  );
}
