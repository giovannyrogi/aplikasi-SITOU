"use client";
import { Box } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";

export const weekNames = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
export function sessionText(rules) {
  if (!rules || rules.type === "off") return "Libur";
  if (rules.type === "field") return "Kerja lapangan";
  const hours =
    rules.type === "flexible"
      ? `Masuk ${rules.windowStart || "belum diisi"}–${rules.windowEnd || "belum diisi"}. Selesai paling lambat ${rules.latestFinish || "belum diisi"}. Target ${rules.requiredMinutes} menit`
      : `${rules.startTime || "Jam masuk belum diisi"}–${rules.endTime || "Jam pulang belum diisi"}`;
  return `${hours}${rules.nextDay ? " (pulang hari berikutnya)" : ""} · Istirahat ${rules.breakMinutes || 0} menit${rules.deductBreak ? ", mengurangi durasi kerja" : ", tidak mengurangi durasi kerja"}`;
}
export default function ScheduleSummary({
  days = [],
  patternType = "weekly",
  holidayPolicy,
  calendarName,
  showSettings = false,
}) {
  return (
    <Box sx={{ display: "grid", gap: 1, minWidth: 0 }}>
      {days.map((day) => (
        <Box
          key={day.day}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "112px minmax(0, 1fr)" },
            gap: 1,
          }}
        >
          <FontStyle fontWeight={600}>
            {patternType === "weekly" ? weekNames[day.day - 1] : `Hari ${day.day}`}
          </FontStyle>
          <Box>
            {day.sessions?.length ? (
              day.sessions.map((s, i) => (
                <Box key={i} sx={{ mb: showSettings ? 2 : 0 }}>
                  <FontStyle>
                    {day.sessions.length > 1 ? `Waktu kerja ${i + 1}: ` : ""}
                    {sessionText(s.rules)}
                  </FontStyle>
                  {showSettings && s.rules?.type !== "off" && (
                    <FontStyle fontSize={12.5} color="text.secondary">
                      {s.rules?.type === "flexible"
                        ? "Jam fleksibel"
                        : s.rules?.type === "field"
                          ? "Kerja lapangan"
                          : "Jam tetap"}{" "}
                      · Toleransi terlambat {s.rules?.lateTolerance || 0} menit · Toleransi pulang
                      awal {s.rules?.earlyTolerance || 0} menit
                    </FontStyle>
                  )}
                </Box>
              ))
            ) : (
              <FontStyle>Libur</FontStyle>
            )}
          </Box>
        </Box>
      ))}
      <FontStyle fontSize={12}>
        {calendarName
          ? `${calendarName} · ${holidayPolicy === "calendar" ? "Libur mengikuti kalender" : "Tetap bekerja sesuai jadwal"}`
          : "Libur mengikuti hari yang diatur pada jadwal"}
      </FontStyle>
    </Box>
  );
}
