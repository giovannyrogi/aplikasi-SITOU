"use client";
import { Box } from "@mui/material";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import FontStyle from "@/app/components/font-style/FontStyle";
import { hoursLabel } from "@/lib/work-schedules/dailyAdjustment.mjs";
import dayjs from "dayjs";

export const adjustmentHours = (sessions) =>
  sessions.length
    ? sessions.map((session) => hoursLabel(session.rules)).join(" dan ")
    : "Tidak ada jam kerja";

export default function DailyAdjustmentReview({ changes, page, pageSize }) {
  const data = changes
    .slice((page - 1) * pageSize, page * pageSize)
    .map((row) => ({ ...row, id: `${row.employeeId}:${row.date}` }));
  return (
    <ResponsiveDataView
      data={data}
      rowOffset={(page - 1) * pageSize}
      scrollX={740}
      columns={[
        {
          title: "Pegawai",
          key: "employee",
          render: (_, row) => (
            <Box>
              <FontStyle fontSize={14}>{row.employeeName}</FontStyle>
              <FontStyle fontSize={13} color="text.secondary">
                NIP {row.employeeNo}
              </FontStyle>
            </Box>
          ),
        },
        {
          title: "Tanggal",
          key: "date",
          render: (_, row) => dayjs(row.date).format("DD MMM YYYY"),
        },
        { title: "Sebelum", key: "before", render: (_, row) => adjustmentHours(row.before) },
        { title: "Sesudah", key: "after", render: (_, row) => adjustmentHours(row.after) },
      ]}
      renderCard={(row) => (
        <Box sx={{ display: "grid", gap: 2 }}>
          <Box>
            <FontStyle fontSize={14} fontWeight={600}>
              {row.employeeName}
            </FontStyle>
            <FontStyle fontSize={14}>NIP {row.employeeNo}</FontStyle>
          </Box>
          {[
            ["Tanggal", dayjs(row.date).format("DD MMM YYYY")],
            ["Sebelum", adjustmentHours(row.before)],
            ["Sesudah", adjustmentHours(row.after)],
          ].map(([label, value]) => (
            <Box key={label}>
              <FontStyle fontSize={14} color="text.secondary">
                {label}
              </FontStyle>
              <FontStyle fontSize={14}>{value}</FontStyle>
            </Box>
          ))}
        </Box>
      )}
    />
  );
}
