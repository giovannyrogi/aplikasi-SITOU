"use client";
import { useEffect, useState } from "react";
import { Button, DatePicker, Space } from "antd";
import { Box } from "@mui/material";
import dayjs from "dayjs";
import DataPanel from "@/app/components/data-display/DataPanel";
import FontStyle from "@/app/components/font-style/FontStyle";
import { scheduleRequest } from "./ScheduleFields";
import { sessionText } from "./ScheduleSummary";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";

const statusLabels = {
  scheduled: "Bekerja",
  off: "Libur",
  holiday: "Libur mengikuti kalender",
  needs_review: "Jadwal belum diatur",
  cancelled: "Dibatalkan",
};
export default function ScheduleCalendar({ organizationId, employees, today, revision }) {
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const [range, setRange] = useState([today, dayjs(today).add(6, "day").format("YYYY-MM-DD")]);
  const [state, setState] = useState({ loading: false, rows: [], error: "" });
  const [retry, setRetry] = useState(0);
  const ids = employees
    .map((e) => e.id)
    .sort()
    .join(",");
  const [from, until] = range;
  const query = new URLSearchParams({ organizationId, employeeIds: ids, from, until }).toString();
  useEffect(() => {
    const c = new AbortController();
    Promise.resolve().then(async () => {
      if (c.signal.aborted) return;
      setState({ loading: true, rows: [], error: "" });
      if (!ids) {
        setState({ loading: false, rows: [], error: "" });
        return;
      }
      try {
        const result = await runWithLoadingBackdrop(
          () => scheduleRequest("/api/work-schedules/calendar?" + query, null, c.signal),
          { message: "Memuat jadwal..." },
        );
        if (!c.signal.aborted) setState({ rows: result.data, loading: false, error: "" });
      } catch (e) {
        if (!c.signal.aborted) setState({ rows: [], loading: false, error: e.message });
      }
    });
    return () => c.abort();
  }, [query, ids, retry, revision, runWithLoadingBackdrop]);
  const move = (amount) =>
    setRange(range.map((d) => dayjs(d).add(amount, "day").format("YYYY-MM-DD")));
  const dates = [...new Set(state.rows.map((r) => r.date))];
  return (
    <DataPanel title="Lihat jadwal">
      <Box sx={{ p: { xs: 2, sm: 3 }, display: "grid", gap: 3 }}>
        <FontStyle explanation>
          Pilih Pegawai dan rentang tanggal untuk melihat jadwal kerja serta hari liburnya.
        </FontStyle>
        <Space wrap>
          <Button onClick={() => move(-7)}>Pekan sebelumnya</Button>
          <Button onClick={() => move(7)}>Pekan berikutnya</Button>
        </Space>
        <Box>
          <FontStyle component="label" htmlFor="schedule-date-range" fontWeight={600}>
            Rentang tanggal (maksimal 31 hari)
          </FontStyle>
          <DatePicker.RangePicker
            id="schedule-date-range"
            value={range.map((d) => dayjs(d))}
            format="DD/MM/YYYY"
            allowClear={false}
            style={{ width: "100%", marginTop: 8 }}
            onChange={(dates) => {
              if (dates?.[0] && dates?.[1]) setRange(dates.map((d) => d.format("YYYY-MM-DD")));
            }}
          />
        </Box>
        {!ids ? (
          <FontStyle>Pilih Pegawai pada daftar untuk melihat jadwal.</FontStyle>
        ) : state.loading ? (
          <FontStyle role="status">Memuat jadwal...</FontStyle>
        ) : state.error ? (
          <Box role="alert">
            <FontStyle>{state.error}</FontStyle>
            <Button onClick={() => setRetry((n) => n + 1)}>Coba lagi</Button>
          </Box>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
              gap: 3,
            }}
          >
            {dates.map((date) => (
              <Box
                key={date}
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 2,
                  minWidth: 0,
                  display: "grid",
                  alignContent: "start",
                  gap: 2,
                }}
              >
                <FontStyle component="h3" fontWeight={700}>
                  {dayjs(date).format("dddd, D MMMM YYYY")}
                </FontStyle>
                {state.rows
                  .filter((r) => r.date === date)
                  .map((row) => (
                    <Box
                      key={row.employeeId}
                      sx={{ display: "grid", gap: 1, overflowWrap: "anywhere" }}
                    >
                      <FontStyle fontWeight={600}>{row.name}</FontStyle>
                      <FontStyle>{statusLabels[row.status]}</FontStyle>
                      {row.isHoliday && <FontStyle>{row.holidayName}</FontStyle>}
                      {row.sessions.map((s) => (
                        <FontStyle key={s.sessionNo}>{sessionText(s.rules)}</FontStyle>
                      ))}
                      {row.reason && <FontStyle>Alasan perubahan: {row.reason}</FontStyle>}
                    </Box>
                  ))}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </DataPanel>
  );
}
