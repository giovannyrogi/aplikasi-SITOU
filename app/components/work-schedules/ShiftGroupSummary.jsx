"use client";
import { Box } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";
import { weekNames, ScheduleSessionDetails, ScheduleHolidayNotice } from "./ScheduleSummary";
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
        Pilih satu shift untuk setiap Pegawai saat menetapkan jadwal.
      </FontStyle>
      <FontStyle>
        Hari kerja: {workingDays.map((day) => weekNames[day - 1]).join(", ") || "Belum dipilih"}
      </FontStyle>
      {shifts.map((shift, index) => (
        <Box
          component="section"
          aria-label={shift.name}
          key={index}
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            p: 2.5,
            display: "grid",
            gap: 2,
          }}
        >
          <FontStyle component="h3" fontSize={15} fontWeight={700}>
            {shift.name}
          </FontStyle>
          <ScheduleSessionDetails rules={shift.rules} showSettings={showSettings} />
        </Box>
      ))}
      {calendarName && (
        <ScheduleHolidayNotice calendarName={calendarName} holidayPolicy={holidayPolicy} />
      )}
    </Box>
  );
}
