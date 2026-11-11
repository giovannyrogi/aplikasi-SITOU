"use client";

import { useState } from "react";
import { Box, Tooltip } from "@mui/material";
import { Button, Input } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import PageHeader from "@/app/components/layout/PageHeader";
import OperationalFilterSection from "@/app/components/filters/OperationalFilterSection";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import ResponsiveRangePicker from "@/app/components/forms/ResponsiveRangePicker";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import DataPanel from "@/app/components/data-display/DataPanel";
import DataPagination from "@/app/components/data-display/DataPagination";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import AppNotice from "@/app/components/data-display/AppNotice";
import FontStyle from "@/app/components/font-style/FontStyle";
import PhotoAvatar from "@/app/components/data-display/PhotoAvatar";
import Notification from "@/app/components/Notifications/Notification";
import useAppNotification from "@/app/hooks/useAppNotification";
import useDashboardData from "@/app/components/dashboard/useDashboardData";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { normalizeRequestError, readApiResponse } from "@/lib/api/clientError";
import {
  ATTENDANCE_INDICATOR,
  ATTENDANCE_STATUS,
  attendanceRowIndicators,
  attendanceSchedule,
  attendanceTime,
  attendanceMinutes,
} from "@/lib/reports/attendancePresentation.mjs";
import { ReportCardFields, reportDate } from "./ReportEmployeeFields";
import { AttendanceIndicators, AttendanceState } from "./AttendanceSummaryFields";
import AttendanceSummaryDetails from "./AttendanceSummaryDetails";

const API = "/api/reports/attendance-summary";
const indicatorOptions = [
  { value: "all", label: "Semua indikator" },
  {
    label: "Waktu dan kondisi absensi",
    options: Object.entries(ATTENDANCE_INDICATOR)
      .filter(([key]) => !["incomplete", "needs_review"].includes(key))
      .map(([value, [label]]) => ({ value, label })),
  },
  {
    label: "Status harian",
    options: Object.entries(ATTENDANCE_STATUS)
      .filter(([key]) => key !== "late")
      .map(([key, [label]]) => ({ value: `status:${key}`, label })),
  },
];
const placementFilters = [
  ["locationId", "Lokasi", "locations", "Semua lokasi"],
  ["organizationUnitId", "Divisi & Unit", "units", "Semua Divisi & Unit"],
  ["positionId", "Jabatan", "positions", "Semua jabatan"],
  ["employmentTypeId", "Jenis kepegawaian", "employmentTypes", "Semua jenis kepegawaian"],
];

export default function AttendanceSummaryReport() {
  const user = useAuthenticatedUser();
  const platform = user.role_code === "superadmin";
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const organizationId = platform ? selectedOrganization : String(user.organization_id || "");
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState("");
  const [cursors, setCursors] = useState([]);
  const [detail, setDetail] = useState(null);
  const [exporting, setExporting] = useState(false);
  const { notification, showNotification, closeNotification } = useAppNotification();
  const organizationQuery = new URLSearchParams({ organizationId: organizationId || "" });
  const references = useDashboardData(
    organizationId ? `${API}/options?${organizationQuery}` : null,
  );
  const today = references.data?.today;
  const query = new URLSearchParams(organizationQuery);
  if (today) {
    query.set("startDate", today);
    query.set("endDate", today);
  }
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }
  const pageSize = filters.pageSize || 10;
  const cursor = cursors.at(-1);
  if (cursor) query.set("cursor", cursor);
  const state = useDashboardData(organizationId && today ? `${API}?${query}` : null);
  const data = state.data;
  const loading = references.loading || state.loading;
  const fieldErrors = state.error?.fieldErrors || {};
  const change = (patch) => {
    setCursors([]);
    setFilters((previous) => ({ ...previous, ...patch }));
  };
  const reset = () => {
    setFilters({});
    setSearch("");
    setCursors([]);
    setDetail(null);
  };
  const items = [
    ...(platform
      ? [
          {
            key: "organizationId",
            label: "Organisasi",
            control: (
              <OrganizationSelect
                value={organizationId}
                onChange={(id) => {
                  setSelectedOrganization(id);
                  reset();
                }}
              />
            ),
          },
        ]
      : []),
    {
      key: "search",
      label: "Cari Pegawai",
      control: (
        <Input.Search
          aria-label="Cari nama atau NIP"
          placeholder="Nama atau NIP"
          allowClear
          value={search}
          maxLength={120}
          onChange={(event) => setSearch(event.target.value)}
          onSearch={(value) => change({ search: value.trim() })}
        />
      ),
    },
    {
      key: "dateRange",
      label: "Rentang Tanggal",
      control: (
        <ResponsiveRangePicker
          aria-label="Rentang Tanggal"
          value={today ? [dayjs(query.get("startDate")), dayjs(query.get("endDate"))] : null}
          disabled={!today}
          allowEmpty={[!today, !today]}
          status={fieldErrors.startDate || fieldErrors.endDate ? "error" : undefined}
          format="DD MMM YYYY"
          presets={
            today
              ? [
                  { label: "Hari ini", value: [dayjs(today), dayjs(today)] },
                  {
                    label: "7 hari terakhir",
                    value: [dayjs(today).subtract(6, "day"), dayjs(today)],
                  },
                  { label: "Bulan ini", value: [dayjs(today).startOf("month"), dayjs(today)] },
                ]
              : []
          }
          onChange={(dates) =>
            change({
              startDate: dates?.[0]?.format("YYYY-MM-DD"),
              endDate: dates?.[1]?.format("YYYY-MM-DD"),
            })
          }
        />
      ),
    },
    ...placementFilters.map(([key, label, source, placeholder]) => ({
      key,
      label,
      control: (
        <AsyncSelect
          aria-label={label}
          allowClear
          value={filters[key]}
          placeholder={placeholder}
          options={references.data?.[source] || []}
          loading={references.loading}
          disabled={!references.data}
          onChange={(value) => change({ [key]: value })}
          style={{ width: "100%" }}
        />
      ),
    })),
    {
      key: "indicator",
      label: "Indikator",
      control: (
        <AsyncSelect
          aria-label="Indikator absensi"
          value={filters.indicator || "all"}
          options={indicatorOptions}
          onChange={(value) => change({ indicator: value === "all" ? undefined : value })}
          style={{ width: "100%" }}
        />
      ),
    },
  ];

  async function exportExcel() {
    setExporting(true);
    try {
      const input = new URLSearchParams(query);
      input.delete("cursor");
      input.delete("pageSize");
      const response = await fetch(`${API}/export?${input}`, { cache: "no-store" });
      if (!response.ok) await readApiResponse(response);
      if (!response.headers.get("content-type")?.includes("spreadsheetml"))
        throw new Error("Unduhan tidak tersedia. Periksa sesi lalu coba kembali.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `sitou-rekap-absensi-${input.get("startDate")}.xlsx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showNotification("Rekap absensi berhasil diunduh.");
    } catch (error) {
      showNotification(normalizeRequestError(error).message, "error");
    } finally {
      setExporting(false);
    }
  }

  const time = (value, row) => attendanceTime(value, data?.timezone, row.work_date);
  const duration = (row) => attendanceMinutes(row.duration_complete ? row.worked_minutes : null);
  const textCell = (lines) => (
    <Box sx={{ display: "grid", gap: 0.5, minWidth: 0 }}>
      {lines.filter(Boolean).map((line, index) => (
        <FontStyle key={index} fontSize="inherit" sx={{ overflowWrap: "anywhere" }}>
          {line}
        </FontStyle>
      ))}
    </Box>
  );
  const identity = (row) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
      <PhotoAvatar
        key={row.profile_photo_file_id || row.id}
        name={row.full_name}
        interactive={false}
        photoUrl={
          row.profile_photo_file_id
            ? `${API}/${row.id}/photos/${row.profile_photo_file_id}?${organizationQuery}`
            : null
        }
      />
      {textCell([row.full_name, row.employee_no ? `NIP ${row.employee_no}` : null])}
    </Box>
  );
  const indicators = (row) => {
    const keys = attendanceRowIndicators(row);
    return keys.length ? (
      <AttendanceIndicators indicators={keys} lateMinutes={row.late_minutes} compact />
    ) : (
      "—"
    );
  };
  const schedule = (row) => {
    const ranges = attendanceSchedule(row, data.timezone);
    return textCell(ranges.length ? ranges : [row.holiday_name || "—"]);
  };
  const action = (row) => (
    <Tooltip title="Lihat rincian" describeChild>
      <Button
        icon={<EyeOutlined />}
        aria-label={`Lihat rincian ${row.full_name}, ${reportDate(row.work_date)}`}
        onClick={() => setDetail(row)}
        style={{ width: 44, height: 44 }}
      />
    </Tooltip>
  );
  const columns = [
    {
      title: "Pegawai",
      key: "employee",
      width: 205,
      render: (_, row) => identity(row),
    },
    {
      title: "Tanggal Absen",
      key: "date",
      width: 115,
      render: (_, row) => reportDate(row.work_date),
    },
    {
      title: "Penempatan",
      key: "placement",
      width: 160,
      render: (_, row) => textCell([row.location_name || "—", row.organization_unit_name]),
    },
    {
      title: "Jadwal Kerja",
      key: "schedule",
      width: 156,
      render: (_, row) => schedule(row),
    },
    {
      title: "Jam Masuk",
      key: "entry",
      width: 102,
      render: (_, row) => time(row.first_check_in, row),
    },
    {
      title: "Jam Pulang",
      key: "exit",
      width: 102,
      render: (_, row) => time(row.last_check_out, row),
    },
    { title: "Durasi bersih", key: "duration", width: 110, render: (_, row) => duration(row) },
    {
      title: "Status",
      key: "status",
      width: 134,
      render: (_, row) => <AttendanceState row={row} />,
    },
    {
      title: "Indikator",
      key: "indicators",
      width: 205,
      render: (_, row) => indicators(row),
    },
    {
      title: "Aksi",
      key: "action",
      width: 64,
      align: "center",
      fixed: "right",
      render: (_, row) => action(row),
    },
  ];
  const renderCard = (row) => (
    <Box sx={{ display: "grid", gap: 1.5, minWidth: 0 }}>
      {identity(row)}
      <AttendanceState row={row} />
      {indicators(row)}
      <ReportCardFields
        fields={[
          ["Tanggal Absen", reportDate(row.work_date)],
          ["Lokasi", row.location_name || "—"],
          ["Divisi & Unit", row.organization_unit_name || "—"],
          ["Jadwal Kerja", schedule(row)],
          ["Jam Masuk", time(row.first_check_in, row)],
          ["Jam Pulang", time(row.last_check_out, row)],
          ["Durasi bersih", duration(row)],
        ]}
      />
      <Box sx={{ justifySelf: "end" }}>{action(row)}</Box>
    </Box>
  );

  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
      <PageHeader
        title="Rekap Absensi"
        description="Pantau jam masuk, jam pulang, dan kondisi absensi Pegawai."
      />
      <OperationalFilterSection
        title="Filter absensi"
        description="Pilih rentang tanggal kerja hingga 92 hari dan persempit hasil sesuai kebutuhan."
        onReset={reset}
        items={items.map((item) => {
          const error =
            item.key === "dateRange"
              ? fieldErrors.startDate || fieldErrors.endDate
              : fieldErrors[item.key];
          return {
            ...item,
            control: error ? (
              <Box sx={{ display: "grid", gap: 0.5, minWidth: 0 }}>
                {item.control}
                <FontStyle role="alert" fontSize={12} color="error.main">
                  {error}
                </FontStyle>
              </Box>
            ) : (
              item.control
            ),
          };
        })}
      />
      {!organizationId ? (
        <AppNotice tone="info" description="Pilih organisasi untuk melihat rekap absensi." />
      ) : (
        <DataPanel
          title="Daftar absensi Pegawai"
          description="Durasi bersih adalah waktu kerja tercatat setelah pengurangan istirahat sesuai pengaturan jadwal."
          exportConfig={{
            enabled: true,
            onExcel: exportExcel,
            loading: exporting,
            disabled: !data,
          }}
        >
          <ResponsiveDataView
            data={data?.rows || []}
            columns={columns}
            loading={loading}
            error={references.error?.message || state.error?.message}
            onRetry={references.error ? references.retry : state.retry}
            scrollX={1380}
            rowOffset={cursors.length * pageSize}
            renderCard={renderCard}
            emptyDescription="Belum ada rekap absensi pada filter ini."
          />
          {data ? (
            <DataPagination
              sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}
              cursor={{ page: cursors.length + 1, next: data.nextCursor }}
              total={data.total}
              displayedCount={data.rows.length}
              pageSize={pageSize}
              onNext={() => setCursors((previous) => [...previous, data.nextCursor])}
              onPrevious={() => setCursors((previous) => previous.slice(0, -1))}
              onPageSizeChange={(size) => change({ pageSize: size })}
            />
          ) : null}
        </DataPanel>
      )}
      {detail ? (
        <AttendanceSummaryDetails
          row={detail}
          organizationId={organizationId}
          onClose={() => setDetail(null)}
        />
      ) : null}
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
