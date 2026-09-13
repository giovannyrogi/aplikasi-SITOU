"use client";

import { Box, Typography } from "@mui/material";
import dayjs from "dayjs";
import EmployeeAvatar from "../employees/EmployeeAvatar";
import CompactInfoChip from "../chips/CompactInfoChip";

export const reportDate = (value) =>
  value && dayjs(value).isValid() ? dayjs(value).format("DD MMM YYYY") : "Belum tersedia";

export function ReportIdentity({ row, onPreview }) {
  return (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", minWidth: 0 }}>
      <EmployeeAvatar employee={row} onPreview={onPreview} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, overflowWrap: "anywhere", mb: 0.75 }}>
          {row.full_name}
        </Typography>
        <CompactInfoChip label={row.employee_no || "NIP belum tersedia"} tone="info" />
      </Box>
    </Box>
  );
}

export function ReportField({ label, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 11.5, color: "text.secondary", mb: 0.3 }}>{label}</Typography>
      <Typography component="div" sx={{ fontSize: 12.5, overflowWrap: "anywhere" }}>
        {children}
      </Typography>
    </Box>
  );
}

/** Chip tenggat bersama untuk tabel, kartu, dan ringkasan dashboard. */
export function ReportRemaining({ row }) {
  const valid = row.days_remaining != null && row.due_date;
  const tone = !valid
    ? "warning"
    : row.days_remaining < 0
      ? "danger"
      : row.days_remaining <= 30
        ? "warning"
        : "info";
  return (
    <CompactInfoChip label={valid ? row.deadline : "Tanggal lahir perlu diperiksa"} tone={tone} />
  );
}

/** Baris label-nilai mobile mengikuti kepadatan daftar pegawai. */
export function ReportCardFields({ fields }) {
  return (
    <Box
      sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider", display: "grid", gap: 0.75 }}
    >
      {fields.map(([label, value]) => (
        <Box
          key={label}
          sx={{ display: "grid", gridTemplateColumns: "minmax(80px, 38%) minmax(0, 1fr)", gap: 1 }}
        >
          <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>{label}</Typography>
          <Typography
            component="div"
            sx={{ fontSize: 11.5, fontWeight: 600, overflowWrap: "anywhere" }}
          >
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export function ReportDeadline({ row, retirement }) {
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <ReportField label={retirement ? "Proyeksi pensiun" : "Akhir kontrak"}>
        {reportDate(row.due_date)}
      </ReportField>
      <Box>
        <ReportRemaining row={row} />
      </Box>
    </Box>
  );
}
