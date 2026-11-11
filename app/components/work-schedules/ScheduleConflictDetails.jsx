"use client";
import { Box } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";

const workDate = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "UTC" });
const dateLabel = (date) => workDate.format(new Date(`${date}T00:00:00Z`));

export default function ScheduleConflictDetails({ conflict, employees, timezone }) {
  const format = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
  const interval = ({ startsAt, endsAt }) =>
    format.formatRange(new Date(startsAt), new Date(endsAt));
  const targets = conflict.other.targets || [];
  return (
    <Box sx={{ display: "grid", gap: 2, mt: 2, minWidth: 0 }}>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
        <Box>
          <FontStyle fontSize={13} color="text.secondary">
            Jam kerja yang dipilih
          </FontStyle>
          <FontStyle fontSize={14} fontWeight={600}>
            {interval(conflict.proposed)}
          </FontStyle>
        </Box>
        <Box>
          <FontStyle fontSize={13} color="text.secondary">
            {conflict.betweenProposals
              ? "Jam pilihan yang bertabrakan"
              : "Jam kerja yang sudah berlaku"}
          </FontStyle>
          <FontStyle fontSize={14} fontWeight={600}>
            {interval(conflict.other)}
          </FontStyle>
        </Box>
      </Box>
      {targets.length > 0 && (
        <Box sx={{ borderTop: 1, borderColor: "divider", pt: 1.5 }}>
          <FontStyle fontSize={13} color="text.secondary">
            Pegawai dan tanggal kerja yang terdampak
          </FontStyle>
          <Box component="ul" sx={{ pl: 2.5, mb: 0, mt: 0.75 }}>
            {targets.map(({ employeeId, date }) => (
              <FontStyle component="li" key={`${employeeId}:${date}`} fontSize={14}>
                {employees.find((person) => String(person.id) === employeeId)?.full_name}
                {" · "}
                {dateLabel(date)}
              </FontStyle>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
