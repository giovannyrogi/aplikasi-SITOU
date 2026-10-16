"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Box, useTheme } from "@mui/material";
import { Button, DatePicker, Input, Tooltip } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import DataPagination from "@/app/components/data-display/DataPagination";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import ErrorState from "@/app/components/data-display/ErrorState";
import AppNotice from "@/app/components/data-display/AppNotice";
import OperationalFilterSection from "@/app/components/filters/OperationalFilterSection";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import useDashboardData from "@/app/components/dashboard/useDashboardData";
import Notification from "@/app/components/Notifications/Notification";
import useAppNotification from "@/app/hooks/useAppNotification";
import { readApiResponse, normalizeRequestError } from "@/lib/api/clientError";
import { LEAVE_UNIT } from "@/lib/leave/labels.mjs";
import { ReportIdentity } from "./ReportEmployeeFields";
import LeaveSummaryDetailsModal from "./LeaveSummaryDetailsModal";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import LeaveBalanceFields, {
  LEAVE_BALANCE_FIELDS,
  LeaveBalanceValue,
  LeaveBalanceEmpty,
} from "./LeaveBalanceFields";
import { formatLeaveDate } from "@/lib/leave/labels.mjs";

export default function LeaveSummaryReport() {
  const user = useAuthenticatedUser(),
    theme = useTheme(),
    router = useRouter(),
    path = usePathname(),
    params = useSearchParams();
  const currentYear = new Intl.DateTimeFormat("en", {
    year: "numeric",
    timeZone: user.organization_timezone || "Asia/Makassar",
  }).format(new Date());
  const year = params.get("year") || currentYear,
    organizationId =
      user.role_code === "superadmin" ? params.get("organizationId") : String(user.organization_id);
  const [history, setHistory] = useState([]),
    [detail, setDetail] = useState(null),
    [preview, setPreview] = useState(null),
    [exporting, setExporting] = useState(false);
  const { notification, showNotification, closeNotification } = useAppNotification();
  const query = new URLSearchParams(params);
  query.set("year", year);
  if (organizationId) query.set("organizationId", organizationId);
  query.delete("view");
  const state = useDashboardData(organizationId ? `/api/reports/leave-summary?${query}` : null),
    data = state.data;
  const refs = useDashboardData(
    organizationId ? `/api/employees/reference-options?organizationId=${organizationId}` : null,
  );
  const navigate = (patch, reset = true) => {
    const next = new URLSearchParams(query);
    if (reset) {
      next.delete("cursor");
      setHistory([]);
    }
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, String(v)) : next.delete(k)));
    router.replace(`${path}?${next}`, { scroll: false });
  };
  const select = (key, options, label) => (
    <AsyncSelect
      aria-label={label}
      loading={key === "leaveTypeId" ? state.loading : refs.loading}
      allowClear
      value={params.get(key) || undefined}
      onChange={(value) => navigate({ [key]: value })}
      options={options || []}
      placeholder={label}
      style={{ width: "100%", minHeight: 44 }}
    />
  );
  const items = [
    ...(user.role_code === "superadmin"
      ? [
          {
            key: "organizationId",
            label: "Organisasi",
            control: (
              <OrganizationSelect
                value={organizationId}
                onChange={(id) =>
                  navigate({
                    organizationId: id,
                    locationId: null,
                    organizationUnitId: null,
                    employeeId: null,
                    leaveTypeId: null,
                  })
                }
              />
            ),
          },
        ]
      : []),
    {
      key: "search",
      label: "Cari pegawai",
      control: (
        <Input.Search
          key={params.get("search") || ""}
          aria-label="Cari nama atau NIP"
          defaultValue={params.get("search") || ""}
          placeholder="Nama atau NIP"
          allowClear
          onSearch={(value) => navigate({ search: value })}
        />
      ),
    },
    {
      key: "year",
      label: "Tahun",
      control: (
        <DatePicker
          aria-label="Tahun laporan"
          picker="year"
          allowClear={false}
          value={dayjs(`${year}-01-01`).isValid() ? dayjs(`${year}-01-01`) : null}
          onChange={(date) => date && navigate({ year: date.year() })}
          style={{ width: "100%", minHeight: 44 }}
        />
      ),
    },
    {
      key: "locationId",
      label: "Lokasi",
      control: select(
        "locationId",
        refs.data?.locations?.map((row) => ({ value: String(row.id), label: row.name })),
        "Semua lokasi",
      ),
    },
    {
      key: "organizationUnitId",
      label: "Divisi & Unit",
      control: select(
        "organizationUnitId",
        refs.data?.organizationUnits?.map((row) => ({ value: String(row.id), label: row.name })),
        "Semua Divisi & Unit",
      ),
    },
    {
      key: "leaveTypeId",
      label: "Jenis cuti/izin",
      control: select("leaveTypeId", data?.type_options, "Semua jenis cuti/izin"),
    },
  ];
  const exportExcel = async () => {
    setExporting(true);
    try {
      const input = new URLSearchParams(query);
      input.delete("cursor");
      input.delete("pageSize");
      const response = await fetch(`/api/reports/leave-summary/export?${input}`, {
        cache: "no-store",
      });
      if (!response.ok) await readApiResponse(response);
      if (!response.headers.get("content-type")?.includes("spreadsheetml"))
        throw new Error("Unduhan tidak tersedia. Periksa sesi lalu coba kembali.");
      const url = URL.createObjectURL(await response.blob()),
        link = document.createElement("a");
      link.href = url;
      link.download = `sitou-rekap-cuti-izin-${year}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showNotification("Rekap berhasil diunduh.");
    } catch (error) {
      showNotification(normalizeRequestError(error).message, "error");
    } finally {
      setExporting(false);
    }
  };
  const count = (value, tone) => (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: 0.5,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <FontStyle
        component="span"
        fontSize={14}
        fontWeight={700}
        sx={{ color: value ? theme.status[tone].text : theme.ui.mutedText }}
      >
        {new Intl.NumberFormat("id-ID").format(value)}
      </FontStyle>
      <FontStyle component="span" fontSize={12} sx={{ color: theme.ui.mutedText }}>
        cuti/izin
      </FontStyle>
    </Box>
  );
  const placement = (row) => (
    <Box sx={{ display: "grid", gap: 0.75, minWidth: 0 }}>
      <FontStyle fontSize={13} fontWeight={600} sx={{ overflowWrap: "anywhere" }}>
        {row.organization_unit_name || "Belum ditempatkan"}
      </FontStyle>
      <FontStyle fontSize={12} sx={{ color: theme.ui.mutedText, overflowWrap: "anywhere" }}>
        {row.location_name || "Lokasi belum tersedia"}
      </FontStyle>
    </Box>
  );
  const action = (row) => (
    <Tooltip title="Lihat rincian cuti dan izin">
      <Button
        aria-label={`Lihat rincian ${row.full_name} ${row.leave_type_name}`}
        icon={<EyeOutlined />}
        disabled={!row.approved && !row.cancelled}
        onClick={() => setDetail(row)}
        style={{ width: 44, height: 44 }}
      />
    </Tooltip>
  );
  const columns = [
    {
      title: "Pegawai",
      width: 260,
      render: (_, row) => <ReportIdentity row={row} onPreview={setPreview} />,
    },
    {
      title: "Penempatan saat ini",
      width: 240,
      render: (_, row) => placement(row),
    },
    {
      title: "Jenis cuti/izin",
      width: 180,
      render: (_, row) => (
        <FontStyle fontSize={13} fontWeight={600}>
          {row.leave_type_name}
        </FontStyle>
      ),
    },
    {
      title: "Disetujui",
      align: "center",
      width: 125,
      render: (_, row) => count(row.approved, "success"),
    },
    {
      title: "Durasi cuti/izin",
      align: "center",
      width: 140,
      render: (_, row) => (
        <FontStyle fontSize={14} fontWeight={600} sx={{ fontVariantNumeric: "tabular-nums" }}>
          {new Intl.NumberFormat("id-ID").format(row.duration)} {LEAVE_UNIT[row.unit]}
        </FontStyle>
      ),
    },
    {
      title: "Dibatalkan",
      align: "center",
      width: 125,
      render: (_, row) => count(row.cancelled, "neutral"),
    },
    {
      title: `Saldo ${year}`,
      align: "center",
      onHeaderCell: () => ({ className: "leave-balance-group" }),
      children: LEAVE_BALANCE_FIELDS.map((field, index) => ({
        title: (
          <Tooltip title={field.description} trigger={["hover", "focus"]}>
            <span tabIndex={0}>{field.label}</span>
          </Tooltip>
        ),
        key: field.key,
        onHeaderCell: () => ({ className: `leave-balance-sub leave-balance-${index}` }),
        width: 115,
        align: "center",
        onCell: (row) => ({
          className: `leave-balance-cell leave-balance-${index}`,
          ...(row.balance == null || !row.uses_balance ? { colSpan: index === 0 ? 3 : 0 } : {}),
        }),
        render: (_, row) =>
          row.balance == null || !row.uses_balance ? (
            <LeaveBalanceEmpty row={row} />
          ) : (
            <LeaveBalanceValue row={row} field={field.key} />
          ),
      })),
    },
    { title: "Aksi", width: 80, align: "center", fixed: "right", render: (_, row) => action(row) },
  ];
  const card = (row) => (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
        <ReportIdentity row={row} onPreview={setPreview} />
        {action(row)}
      </Box>
      <FontStyle fontWeight={600}>{row.leave_type_name}</FontStyle>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <CompactInfoChip label={`${row.approved} disetujui`} tone="success" />
        <CompactInfoChip label={`${row.cancelled} dibatalkan`} tone="neutral" />
        <CompactInfoChip label={`${row.duration} ${LEAVE_UNIT[row.unit]}`} tone="info" />
      </Box>
      {placement(row)}
      <LeaveBalanceFields row={row} year={year} />
    </Box>
  );
  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
      <PageHeader
        title="Rekap Cuti & Izin"
        description="Rekap tahunan cuti, izin, dan saldo per pegawai."
      />
      <OperationalFilterSection
        title="Filter rekap"
        description="Pilih tahun dan cakupan data yang ingin dilihat."
        items={items.map((item) => ({
          ...item,
          control: (
            <Box sx={{ display: "grid", gap: 1, minWidth: 0 }}>
              {item.control}
              {state.error?.fieldErrors?.[item.key] ? (
                <FontStyle role="alert" fontSize={12} sx={{ color: theme.status.danger.text }}>
                  {state.error.fieldErrors[item.key]}
                </FontStyle>
              ) : null}
            </Box>
          ),
        }))}
        onReset={() => {
          setHistory([]);
          router.replace(
            `${path}?${new URLSearchParams({ year: currentYear, ...(organizationId ? { organizationId } : {}) })}`,
            { scroll: false },
          );
        }}
      />
      {refs.error ? (
        <AppNotice tone="warning" compact>
          Filter penempatan belum dapat dimuat. <Button onClick={refs.retry}>Coba lagi</Button>
        </AppNotice>
      ) : null}
      {!organizationId ? (
        <AppNotice tone="info">Pilih organisasi untuk melihat rekap.</AppNotice>
      ) : state.error ? (
        <ErrorState message={state.error.message} onRetry={state.retry} />
      ) : (
        <>
          <DataPanel
            title="Rekap pegawai"
            description={`Satu baris per pegawai dan jenis cuti/izin. Saldo ${year} per ${data?.asOf ? formatLeaveDate(data.asOf) : "tanggal organisasi"}.`}
            exportConfig={{
              enabled: true,
              onExcel: exportExcel,
              loading: exporting,
              disabled: state.loading || !data,
            }}
          >
            <ResponsiveDataView
              data={data?.rows || []}
              columns={columns}
              loading={state.loading}
              renderCard={card}
              emptyDescription="Belum ada cuti, izin, atau saldo pada filter ini."
              scrollX={1560}
              tableSx={{
                "& .ant-table-wrapper .ant-table-container": {
                  borderTop: "1px solid " + theme.ui.panelBorder,
                  borderLeft: "1px solid " + theme.ui.panelBorder,
                },
                "& .ant-table-wrapper .ant-table-thead > tr > th, & .ant-table-wrapper .ant-table-tbody > tr > td":
                  {
                    borderRight: "1px solid " + theme.ui.panelBorder,
                    borderBottom: "1px solid " + theme.ui.panelBorder,
                  },
                "& .ant-table-wrapper .ant-table-thead > tr > th::before": { display: "none" },
                "& .ant-table-wrapper .ant-table-thead > tr > th.leave-balance-group[colspan]": {
                  borderBottom: "1px solid " + theme.ui.panelBorder,
                },
                "& .ant-table-wrapper .ant-table-thead > tr > th.leave-balance-group, & .ant-table-wrapper .ant-table-thead > tr > th.leave-balance-sub":
                  { bgcolor: theme.ui.panelSubtleBg },
              }}
              rowOffset={history.length * Number(params.get("pageSize") || 10)}
            />
            <Box sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
              <DataPagination
                cursor={{ page: history.length + 1, next: data?.nextCursor }}
                total={data?.total || 0}
                pageSize={Number(params.get("pageSize") || 10)}
                loading={state.loading}
                onPageSizeChange={(size) => navigate({ pageSize: size })}
                onNext={() => {
                  setHistory([...history, query.get("cursor") || ""]);
                  navigate({ cursor: data.nextCursor }, false);
                }}
                onPrevious={() => {
                  navigate({ cursor: history.at(-1) || null }, false);
                  setHistory(history.slice(0, -1));
                }}
              />
            </Box>
          </DataPanel>
        </>
      )}
      {detail ? (
        <LeaveSummaryDetailsModal
          key={detail.id}
          row={detail}
          query={query.toString()}
          onPreview={setPreview}
          onClose={() => setDetail(null)}
        />
      ) : null}
      <ImagePreviewModal
        open={Boolean(preview)}
        imageUrl={preview?.imageUrl}
        title={preview?.title}
        alt={preview?.alt}
        onClose={() => setPreview(null)}
      />
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
