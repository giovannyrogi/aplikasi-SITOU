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

export function ReportPlacement({ row }) {
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <ReportField label="Lokasi">{row.location_name || "Belum ditempatkan"}</ReportField>
      <ReportField label="Divisi & Unit">{row.unit_name || "Belum ditentukan"}</ReportField>
      <ReportField label="Jabatan">{row.position_name || "Belum ditentukan"}</ReportField>
    </Box>
  );
}

export function ReportEmployment({ row, retirement }) {
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box>
        <CompactInfoChip
          label={row.employment_type_name || "Jenis belum ditentukan"}
          tone="neutral"
        />
      </Box>
      {retirement ? (
        <>
          <ReportField label="Usia">
            {row.age == null ? "Tanggal lahir perlu diperiksa" : row.age + " tahun"}
          </ReportField>
          <ReportField label="Tanggal lahir">{reportDate(row.birth_date)}</ReportField>
          <ReportField label="Masa kerja">{row.tenure || "Belum tersedia"}</ReportField>
          <ReportField label="Bergabung">{reportDate(row.joined_date)}</ReportField>
        </>
      ) : (
        <>
          <ReportField label="Nomor kontrak">{row.contract_no || "Belum tercatat"}</ReportField>
          <ReportField label="Mulai kontrak">{reportDate(row.start_date)}</ReportField>
          <Box>
            <CompactInfoChip
              label={row.successor_start_date ? "Lanjutan tercatat" : "Lanjutan belum tercatat"}
              tone={row.successor_start_date ? "success" : "warning"}
            />
          </Box>
          {row.successor_start_date ? (
            <ReportField label="Mulai kontrak lanjutan">
              {reportDate(row.successor_start_date)}
            </ReportField>
          ) : null}
        </>
      )}
    </Box>
  );
}

export function ReportDeadline({ row, retirement }) {
  const valid = row.days_remaining != null && row.due_date;
  const tone = !valid
    ? "warning"
    : row.days_remaining < 0
      ? "danger"
      : row.days_remaining <= 30
        ? "warning"
        : "info";
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <ReportField label={retirement ? "Proyeksi pensiun" : "Akhir kontrak"}>
        {reportDate(row.due_date)}
      </ReportField>
      <Box>
        <CompactInfoChip
          label={valid ? row.deadline : "Tanggal lahir perlu diperiksa"}
          tone={tone}
        />
      </Box>
    </Box>
  );
}
