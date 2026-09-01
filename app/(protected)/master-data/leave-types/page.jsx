"use client";
import { useState } from "react";
import { Button } from "antd";
import { EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Box } from "@mui/material";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import DataToolbar from "@/app/components/filters/DataToolbar";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import RowActionMenu from "@/app/components/actions/RowActionMenu";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import Notification from "@/app/components/Notifications/Notification";
import FontStyle from "@/app/components/font-style/FontStyle";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { ROLES } from "@/app/constants/roles";
import useDataList from "@/app/hooks/useDataList";
import useAppNotification from "@/app/hooks/useAppNotification";
import LeaveTypeForm from "@/app/components/leave/LeaveTypeForm";
import { LEAVE_CATEGORY, LEAVE_UNIT, formatLeaveUnits } from "@/app/components/leave/leaveLabels";

export default function LeaveTypesPage() {
  const user = useAuthenticatedUser();
  const superadmin = user.role_code === ROLES.SUPERADMIN;
  const list = useDataList("/api/leave-types");
  const organizationId = superadmin ? list.filters.organizationId : String(user.organization_id);
  const [form, setForm] = useState({ open: false, item: null });
  const { notification, showNotification, closeNotification } = useAppNotification();
  const actions = (item) => [
    {
      key: "edit",
      icon: <EditOutlined />,
      label: "Edit",
      onClick: () => setForm({ open: true, item }),
    },
  ];
  const columns = [
    {
      title: "Nama cuti atau izin",
      render: (_, item) => (
        <Box>
          <FontStyle fontSize={13} fontWeight={700}>
            {item.name}
          </FontStyle>
          <Box sx={{ mt: 0.75, display: "flex", gap: 0.75 }}>
            <CompactInfoChip
              label={LEAVE_CATEGORY[item.category]?.[0]}
              tone={LEAVE_CATEGORY[item.category]?.[1]}
            />
          </Box>
        </Box>
      ),
    },
    ...(superadmin ? [{ title: "Organisasi", dataIndex: "organization_name" }] : []),
    {
      title: "Aturan",
      render: (_, item) => (
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          <CompactInfoChip
            label={
              item.uses_balance
                ? `${formatLeaveUnits(item.annual_allowance)} ${LEAVE_UNIT[item.unit]}/tahun`
                : "Tidak mengurangi jatah"
            }
            tone={item.uses_balance ? "info" : "neutral"}
          />
          {item.requires_attachment ? (
            <CompactInfoChip label="Dokumen wajib" tone="warning" />
          ) : null}
        </Box>
      ),
    },
    { title: "Pemakaian", render: (_, item) => `${item.request_count} pencatatan` },
    {
      title: "Status",
      render: (_, item) => <CompactInfoChip status={item.is_active ? "active" : "inactive"} />,
    },
    { title: "Aksi", width: 72, render: (_, item) => <RowActionMenu items={actions(item)} /> },
  ];
  const card = (item) => (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
        <Box>
          <FontStyle fontSize={14} fontWeight={700}>
            {item.name}
          </FontStyle>
        </Box>
        <RowActionMenu items={actions(item)} />
      </Box>
      <Box sx={{ mt: 1.5, display: "flex", gap: 0.75, flexWrap: "wrap" }}>
        <CompactInfoChip
          label={LEAVE_CATEGORY[item.category]?.[0]}
          tone={LEAVE_CATEGORY[item.category]?.[1]}
        />
        <CompactInfoChip
          label={
            item.uses_balance
              ? `${formatLeaveUnits(item.annual_allowance)} ${LEAVE_UNIT[item.unit]}/tahun`
              : "Tidak mengurangi jatah"
          }
        />
        <CompactInfoChip status={item.is_active ? "active" : "inactive"} />
      </Box>
    </Box>
  );
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="Aturan Cuti & Izin"
        description="Atur pilihan cuti dan izin, jatah pegawai, serta dokumen yang diperlukan."
        action={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!organizationId}
            onClick={() => setForm({ open: true, item: null })}
          >
            Tambah aturan
          </Button>
        }
      />
      <DataPanel
        title="Daftar aturan cuti dan izin"
        description="Tambahkan pilihan yang berlaku sesuai kebijakan organisasi."
        toolbar={
          <DataToolbar
            embedded
            search={list.search}
            onSearchChange={list.setSearch}
            status={list.status}
            onStatusChange={list.setStatus}
            onRefresh={list.refresh}
            filters={
              superadmin ? (
                <OrganizationSelect
                  allowClear
                  value={organizationId}
                  onChange={(value) => list.updateFilters({ organizationId: value })}
                />
              ) : null
            }
          />
        }
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
          emptyDescription="Belum ada aturan cuti atau izin pada organisasi ini."
        />
      </DataPanel>
      <LeaveTypeForm
        open={form.open}
        item={form.item}
        presetOrganizationId={organizationId}
        onClose={() => setForm({ open: false, item: null })}
        onSaved={async (message) => {
          setForm({ open: false, item: null });
          showNotification(message);
          await list.refresh();
        }}
        onError={(message) => showNotification(message, "error")}
      />
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
