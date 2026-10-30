"use client";
import { Box } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";
import { weekNames, sessionText } from "./ScheduleSummary";
export default function ShiftGroupSummary({
  shifts = [],
  workingDays = [],
  holidayPolicy,
  calendarName,
  showSettings = false,
}) {
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <FontStyle explanation>
        HRD memilih satu shift untuk setiap Pegawai saat menetapkan jadwal.
      </FontStyle>
      <FontStyle>
        Hari kerja: {workingDays.map((day) => weekNames[day - 1]).join(", ") || "Belum dipilih"}
      </FontStyle>
      {shifts.map((shift, index) => (
        <Box key={index} sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 2 }}>
          <FontStyle fontWeight={600}>{shift.name}</FontStyle>
          <FontStyle>{sessionText(shift.rules)}</FontStyle>
          {showSettings && (
            <FontStyle fontSize={12.5} color="text.secondary">
              Toleransi terlambat {shift.rules?.lateTolerance || 0} menit · Toleransi pulang awal{" "}
              {shift.rules?.earlyTolerance || 0} menit
            </FontStyle>
          )}
        </Box>
      ))}
      <FontStyle>
        {calendarName
          ? `${calendarName}. ${holidayPolicy === "calendar" ? "Libur mengikuti kalender" : "Tetap bekerja sesuai jadwal"}`
          : "Libur mengikuti hari yang diatur pada jadwal"}
      </FontStyle>
    </Box>
  );
}
