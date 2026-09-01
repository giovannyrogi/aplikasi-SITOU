"use client";
import { useEffect, useState } from "react";
import { Button, DatePicker, Select } from "antd";
import { CloseCircleOutlined, EyeOutlined, PlusOutlined } from "@ant-design/icons";
import { Box, useTheme } from "@mui/material";
import dayjs from "dayjs";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import OperationalFilterSection from "@/app/components/filters/OperationalFilterSection";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import RowActionMenu from "@/app/components/actions/RowActionMenu";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import EmployeeSelect from "@/app/components/selects/EmployeeSelect";
import LocationSelect from "@/app/components/selects/LocationSelect";
import FontStyle from "@/app/components/font-style/FontStyle";
import Notification from "@/app/components/Notifications/Notification";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { ROLES } from "@/app/constants/roles";
import useDataList from "@/app/hooks/useDataList";
import useAppNotification from "@/app/hooks/useAppNotification";
import LeaveRequestForm from "@/app/components/leave/LeaveRequestForm";
import LeaveDetailModal from "@/app/components/leave/LeaveDetailModal";
import LeaveCancelForm from "@/app/components/leave/LeaveCancelForm";
import {
  LEAVE_CATEGORY,
  LEAVE_STATUS,
  LEAVE_UNIT,
  formatLeaveDate,
  formatLeaveUnits,
} from "@/app/components/leave/leaveLabels";
import { readApiResponse } from "@/lib/api/clientError";

const monthFilters = () => ({
  startDate: dayjs().startOf("month").format("YYYY-MM-DD"),
  endDate: dayjs().endOf("month").format("YYYY-MM-DD"),
});
const DEFAULTS = {
  requestStatus: "all",
  ...monthFilters(),
};
const SelectFilter = ({ value, onChange, options, placeholder }) => (
  <Select
    allowClear={false}
    value={value}
    onChange={onChange}
    options={options}
    placeholder={placeholder}
    style={{ width: "100%" }}
  />
);

export default function LeaveRequestsPage() {
  const theme = useTheme();
  const user = useAuthenticatedUser();
  const canManage = [ROLES.SUPERADMIN, ROLES.HRD].includes(user.role_code);
  const isSuperadmin = user.role_code === ROLES.SUPERADMIN;
  const list = useDataList("/api/leave-requests", {
    requiredFilter: isSuperadmin ? "organizationId" : undefined,
    initialFilters: {
      ...DEFAULTS,
      ...(!isSuperadmin ? { organizationId: String(user.organization_id) } : {}),
    },
  });
  const organizationId = isSuperadmin ? list.filters.organizationId : String(user.organization_id);
  const [references, setReferences] = useState({ organizationUnits: [] });
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [cancel, setCancel] = useState(null);
  const { notification, showNotification, closeNotification } = useAppNotification();
  // URL hanya dipulihkan sekali saat halaman pertama kali dibuka.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const restored = { ...DEFAULTS };
    for (const key of [
      "organizationId",
      "employeeId",
      "locationId",
      "organizationUnitId",
      "requestStatus",
      "startDate",
      "endDate",
    ])
      if (params.get(key)) restored[key] = params.get(key);
    if (!isSuperadmin) restored.organizationId = String(user.organization_id);
    list.updateFilters(restored);
    // Pemulihan URL sengaja hanya dilakukan sekali agar perubahan filter berikutnya tidak ditimpa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!organizationId) {
      Promise.resolve().then(() => setReferences({ organizationUnits: [] }));
      return;
    }
    const controller = new AbortController();
    fetch(`/api/employees/reference-options?organizationId=${organizationId}`, {
      signal: controller.signal,
    })
      .then(readApiResponse)
      .then((body) => {
        setReferences({ organizationUnits: body.data?.organizationUnits || [] });
      })
      .catch((error) => {
        if (error.name !== "AbortError") showNotification(error.message, "error");
      });
    return () => controller.abort();
  }, [organizationId, showNotification]);
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(list.filters).forEach(([key, value]) => {
      if (value && value !== "all") params.set(key, String(value));
    });
    params.set("page", String(list.pagination.page));
    params.set("pageSize", String(list.pagination.pageSize));
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }, [list.filters, list.pagination.page, list.pagination.pageSize]);
  const update = (key, value) => list.updateFilters({ ...list.filters, [key]: value || undefined });
  const clear = () =>
    list.updateFilters({
      ...DEFAULTS,
      ...(isSuperadmin ? { organizationId } : { organizationId: String(user.organization_id) }),
    });
  const filterItems = [
    {
      key: "dateRange",
      label: "Rentang tanggal",
      control: (
        <DatePicker.RangePicker
          allowClear={false}
          aria-label="Rentang tanggal cuti dan izin"
          value={[dayjs(list.filters.startDate), dayjs(list.filters.endDate)]}
          format="DD MMM YYYY"
          presets={[
            { label: "Bulan ini", value: [dayjs().startOf("month"), dayjs().endOf("month")] },
            {
              label: "Bulan lalu",
              value: [
                dayjs().subtract(1, "month").startOf("month"),
                dayjs().subtract(1, "month").endOf("month"),
              ],
            },
            { label: "Tahun ini", value: [dayjs().startOf("year"), dayjs().endOf("year")] },
          ]}
          onChange={(dates) =>
            list.updateFilters({
              ...list.filters,
              startDate: dates[0].format("YYYY-MM-DD"),
              endDate: dates[1].format("YYYY-MM-DD"),
            })
          }
        />
      ),
    },
    ...(isSuperadmin
      ? [
          {
            key: "organizationId",
            label: "Organisasi",
            gridColumn: { xs: "auto", xl: "1 / -1" },
            control: (
              <OrganizationSelect
                value={organizationId}
                onChange={(value) => list.updateFilters({ ...DEFAULTS, organizationId: value })}
              />
            ),
          },
        ]
      : []),
    {
      key: "employeeId",
      label: "Pegawai",
      control: (
        <EmployeeSelect
          allowClear
          placeholder="Semua pegawai"
          organizationId={organizationId}
          value={list.filters.employeeId}
          onChange={(value) => update("employeeId", value)}
        />
      ),
    },
    {
      key: "locationId",
      label: "Lokasi",
      control: (
        <LocationSelect
          allowClear
          placeholder="Semua lokasi"
          organizationId={organizationId}
          value={list.filters.locationId}
          onChange={(value) => update("locationId", value)}
        />
      ),
    },
    {
      key: "organizationUnitId",
      label: "Divisi & Unit",
      control: (
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Semua Divisi & Unit"
          value={list.filters.organizationUnitId}
          onChange={(value) => update("organizationUnitId", value)}
          options={(references.organizationUnits || []).map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
      ),
    },
    {
      key: "requestStatus",
      label: "Status",
      control: (
        <SelectFilter
          value={list.filters.requestStatus || "all"}
          onChange={(value) => update("requestStatus", value)}
          options={[
            { value: "all", label: "Semua status" },
            { value: "approved", label: "Disetujui" },
            { value: "submitted", label: "Menunggu" },
            { value: "rejected", label: "Ditolak" },
            { value: "cancelled", label: "Dibatalkan" },
          ]}
        />
      ),
    },
  ];
  const actions = (item) => [
    { key: "detail", icon: <EyeOutlined />, label: "Lihat detail", onClick: () => setDetail(item) },
    ...(canManage && item.status === "approved"
      ? [
          {
            key: "cancel",
            icon: <CloseCircleOutlined />,
            label: "Batalkan",
            danger: true,
            onClick: () => setCancel(item),
          },
        ]
      : []),
  ];
  const columns = [
    {
      title: "Pegawai",
      render: (_, item) => (
        <Box>
          <FontStyle fontSize={13} fontWeight={700}>
            {item.full_name}
          </FontStyle>
          <FontStyle fontSize={11.5} sx={{ mt: 0.4, color: theme.ui.mutedText }}>
            {item.employee_no} · {item.request_no}
          </FontStyle>
        </Box>
      ),
    },
    {
      title: "Jenis",
      render: (_, item) => (
        <Box>
          <FontStyle fontSize={12.5} fontWeight={600}>
            {item.leave_type_name}
          </FontStyle>
          <Box sx={{ mt: 0.6 }}>
            <CompactInfoChip
              label={LEAVE_CATEGORY[item.category]?.[0]}
              tone={LEAVE_CATEGORY[item.category]?.[1]}
            />
          </Box>
        </Box>
      ),
    },
    {
      title: "Periode",
      render: (_, item) => (
        <Box>
          <FontStyle fontSize={12.5} fontWeight={600}>
            {formatLeaveDate(item.start_date)} - {formatLeaveDate(item.end_date)}
          </FontStyle>
          <FontStyle fontSize={11.5} sx={{ mt: 0.4, color: theme.ui.mutedText }}>
            {formatLeaveUnits(item.requested_units)} {LEAVE_UNIT[item.unit]}
          </FontStyle>
        </Box>
      ),
    },
    {
      title: "Penempatan",
      render: (_, item) => (
        <Box>
          <FontStyle fontSize={12}>
            {item.organization_unit_name || "Belum ada Divisi & Unit"}
          </FontStyle>
          <FontStyle fontSize={11.5} sx={{ mt: 0.4, color: theme.ui.mutedText }}>
            {item.location_name || "Belum ada lokasi"}
          </FontStyle>
        </Box>
      ),
    },
    {
      title: "Status",
      render: (_, item) => (
        <CompactInfoChip
          label={LEAVE_STATUS[item.status]?.[0]}
          tone={LEAVE_STATUS[item.status]?.[1]}
        />
      ),
    },
    { title: "Aksi", width: 72, render: (_, item) => <RowActionMenu items={actions(item)} /> },
  ];
  const card = (item) => (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
        <Box>
          <FontStyle fontSize={14} fontWeight={700}>
            {item.full_name}
          </FontStyle>
          <FontStyle fontSize={11.5} sx={{ mt: 0.4, color: theme.ui.mutedText }}>
            {item.employee_no} · {item.request_no}
          </FontStyle>
        </Box>
        <RowActionMenu items={actions(item)} />
      </Box>
      <FontStyle fontSize={12.5} fontWeight={600} sx={{ mt: 1.5 }}>
        {item.leave_type_name}
      </FontStyle>
      <FontStyle fontSize={12} sx={{ mt: 0.6 }}>
        {formatLeaveDate(item.start_date)} - {formatLeaveDate(item.end_date)} ·{" "}
        {formatLeaveUnits(item.requested_units)} {LEAVE_UNIT[item.unit]}
      </FontStyle>
      <Box sx={{ mt: 1.25, display: "flex", gap: 0.75, flexWrap: "wrap" }}>
        <CompactInfoChip
          label={LEAVE_CATEGORY[item.category]?.[0]}
          tone={LEAVE_CATEGORY[item.category]?.[1]}
        />
        <CompactInfoChip
          label={LEAVE_STATUS[item.status]?.[0]}
          tone={LEAVE_STATUS[item.status]?.[1]}
        />
        {item.attachment_count ? (
          <CompactInfoChip label={`${item.attachment_count} lampiran`} tone="info" />
        ) : null}
      </Box>
    </Box>
  );
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="Cuti & Izin"
        description="Catat, telusuri, dan pantau cuti, izin, sakit, dinas, saldo, serta dokumen pegawai."
        metadata={<CompactInfoChip label={`${list.pagination.total} pencatatan`} tone="info" />}
        action={
          canManage ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!organizationId}
              onClick={() => setFormOpen(true)}
            >
              Catat cuti/izin
            </Button>
          ) : null
        }
      />
      <OperationalFilterSection
        title="Filter cuti dan izin"
        description="Data awal menampilkan bulan berjalan. Pilih pegawai, lokasi, Divisi & Unit, atau status untuk mempersempit hasil."
        items={filterItems}
        onReset={clear}
      />
      <DataPanel
        title="Daftar cuti dan izin"
        description="Hasil mengikuti rentang tanggal dan filter yang dipilih di atas."
      >
        <ResponsiveDataView
          data={list.data}
          columns={columns}
          loading={list.loading}
          error={list.error}
          onRetry={list.refresh}
          pagination={list.pagination}
          onPageChange={list.setPage}
          renderCard={card}
          emptyDescription="Tidak ada cuti atau izin pada rentang tanggal dan filter yang dipilih."
        />
      </DataPanel>
      <LeaveRequestForm
        open={formOpen}
        organizationId={organizationId}
        onClose={() => setFormOpen(false)}
        onSaved={async (message) => {
          setFormOpen(false);
          showNotification(message);
          await list.refresh();
        }}
        onError={(message) => showNotification(message, "error")}
      />
      <LeaveDetailModal item={detail} onClose={() => setDetail(null)} />
      {cancel ? (
        <LeaveCancelForm
          item={cancel}
          onClose={() => setCancel(null)}
          onSaved={async (message) => {
            setCancel(null);
            showNotification(message);
            await list.refresh();
          }}
          onError={(message) => showNotification(message, "error")}
        />
      ) : null}
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
