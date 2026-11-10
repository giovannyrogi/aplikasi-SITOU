"use client";
import AppCollapse from "@/app/components/data-display/AppCollapse";
import { Box } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";
import AppNotice from "@/app/components/data-display/AppNotice";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";

export const weekNames = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
export function HolidayAttendanceNotice({ allowed = false }) {
  return (
    <AppNotice
      title={allowed ? "Absen pada hari libur diizinkan" : "Absen pada hari libur tidak diizinkan"}
      description={
        allowed
          ? "Tanpa jadwal kerja khusus, Pegawai wajib mengisi alasan. Waktu masuk dan pulang dicatat tanpa penilaian terlambat atau pulang awal."
          : "Pegawai memerlukan jadwal kerja khusus dari HRD untuk absen pada hari libur."
      }
    />
  );
}
export function sessionText(rules) {
  if (!rules || rules.type === "off") return "Libur";
  if (rules.type === "field") return "Kerja lapangan";
  const hours =
    rules.type === "flexible"
      ? `Masuk ${rules.windowStart || "belum diisi"}–${rules.windowEnd || "belum diisi"}. Selesai paling lambat ${rules.latestFinish || "belum diisi"}. Target ${rules.requiredMinutes} menit`
      : `${rules.startTime || "Jam masuk belum diisi"}–${rules.endTime || "Jam pulang belum diisi"}`;
  return `${hours}${rules.nextDay ? " (pulang hari berikutnya)" : ""} · Istirahat ${rules.breakMinutes || 0} menit${rules.deductBreak ? ", mengurangi durasi kerja" : ", tidak mengurangi durasi kerja"}`;
}
/** Fakta jam kerja bersama untuk ringkasan hari dan pilihan shift. */
export function ScheduleSessionDetails({ rules, showSettings = false }) {
  if (!rules || rules.type === "off") return <ScheduleHolidayNotice dayOff />;
  const fields =
    rules.type === "field"
      ? [["Jenis pekerjaan", "Kerja lapangan"]]
      : rules.type === "flexible"
        ? [
            [
              "Waktu masuk",
              `${rules.windowStart || "Belum diisi"}–${rules.windowEnd || "Belum diisi"}`,
            ],
            [
              "Batas selesai",
              `${rules.latestFinish || "Belum diisi"}${rules.nextDay ? " (keesokan hari)" : ""}`,
            ],
            ["Target kerja", `${rules.requiredMinutes || 0} menit`],
          ]
        : [
            [
              "Jam kerja",
              `${rules.startTime || "Belum diisi"}–${rules.endTime || "Belum diisi"}${rules.nextDay ? " (pulang keesokan hari)" : ""}`,
            ],
          ];
  if (rules.type !== "field") {
    fields.push([
      "Istirahat",
      `${rules.breakMinutes || 0} menit${Number(rules.breakMinutes) > 0 ? (rules.deductBreak ? " · Dikurangi dari waktu kerja" : " · Tetap dihitung sebagai waktu kerja") : ""}`,
    ]);
  }
  if (showSettings) {
    fields.push(
      ["Toleransi keterlambatan", `${rules.lateTolerance || 0} menit`],
      ["Toleransi pulang lebih awal", `${rules.earlyTolerance || 0} menit`],
    );
  }
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
        gap: 2,
      }}
    >
      {fields.map(([label, value]) => (
        <Box key={label} sx={{ minWidth: 0 }}>
          <FontStyle component="dt" fontSize={13} color="text.secondary">
            {label}
          </FontStyle>
          <FontStyle component="dd" fontSize={14} sx={{ m: 0, mt: 0.5 }}>
            {value}
          </FontStyle>
        </Box>
      ))}
    </Box>
  );
}
export function ScheduleHolidayNotice({ calendarName, holidayPolicy, dayOff = false }) {
  return (
    <AppNotice
      compact
      title={dayOff || !calendarName ? "Hari libur" : "Kalender libur"}
      description={
        dayOff
          ? "Hari ini ditetapkan sebagai hari libur."
          : calendarName
            ? holidayPolicy === "calendar"
              ? `Hari libur mengikuti ${calendarName}.`
              : `Tetap bekerja sesuai jadwal pada hari libur di ${calendarName}.`
            : "Hari ini ditetapkan sebagai hari libur."
      }
    />
  );
}
export default function ScheduleSummary({
  days = [],
  patternType = "weekly",
  holidayPolicy,
  calendarName,
  showSettings = false,
}) {
  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
      <AppCollapse
        items={days.map((day) => {
          const sessions = (day.sessions || []).filter(
            (session) => session.rules && session.rules.type !== "off",
          );
          const working = sessions.length > 0;
          return {
            key: String(day.day),
            label: (
              <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
                <FontStyle component="h3" fontSize={15} fontWeight={400}>
                  {patternType === "weekly" ? weekNames[day.day - 1] : `Hari ${day.day}`}
                </FontStyle>
                <CompactInfoChip
                  label={working ? "Hari kerja" : "Hari libur"}
                  tone={working ? "success" : "info"}
                />
              </Box>
            ),
            children: (
              <Box sx={{ display: "grid", gap: 3 }}>
                {working ? (
                  sessions.map((s, i) => (
                    <Box key={i}>
                      {sessions.length > 1 && (
                        <FontStyle fontSize={14} fontWeight={600} sx={{ mb: 1.5 }}>
                          Waktu kerja {i + 1}
                        </FontStyle>
                      )}
                      <ScheduleSessionDetails rules={s.rules} showSettings={showSettings} />
                    </Box>
                  ))
                ) : (
                  <ScheduleHolidayNotice dayOff />
                )}
              </Box>
            ),
          };
        })}
      />
      {calendarName && (
        <ScheduleHolidayNotice calendarName={calendarName} holidayPolicy={holidayPolicy} />
      )}
    </Box>
  );
}
