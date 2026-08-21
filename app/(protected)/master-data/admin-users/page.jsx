"use client";

import { useState } from "react";
import { Button } from "antd";
import { EditOutlined, KeyOutlined, PlusOutlined, StopOutlined } from "@ant-design/icons";
import { Box, useTheme } from "@mui/material";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import DataToolbar from "@/app/components/filters/DataToolbar";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import RowActionMenu from "@/app/components/actions/RowActionMenu";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import Notification from "@/app/components/Notifications/Notification";
import FontStyle from "@/app/components/font-style/FontStyle";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import useDataList from "@/app/hooks/useDataList";
import useAppNotification from "@/app/hooks/useAppNotification";
import AdminUserForm from "./AdminUserForm";
import ResetPasswordForm from "./ResetPasswordForm";

export default function AdminUsersPage() {
  const theme = useTheme();
  const list = useDataList("/api/admin-users");
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const [form, setForm] = useState({ open: false, item: null });
  const [passwordForm, setPasswordForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const organizationId = list.filters.organizationId;

  const saved = async (message) => {
    setForm({ open: false, item: null });
    setPasswordForm(null);
    showNotification(message);
    await list.refresh();
  };

  const deactivate = async () => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(`/api/admin-users/${confirm.id}`, { method: "DELETE" });
          const body = await response.json();
          if (!response.ok) throw new Error(body.message);
          showNotification(body.message);
          await list.refresh();
        },
        { message: "Menonaktifkan Admin/HRD..." },
      );
    } catch (error) {
      showNotification(error.message, "error");
    } finally {
      setConfirm(null);
    }
  };

  const actions = (item) => [
    {
      key: "edit",
      icon: <EditOutlined />,
      label: "Edit",
      onClick: () => setForm({ open: true, item }),
    },
    {
      key: "password",
      icon: <KeyOutlined />,
      label: "Atur ulang password",
      onClick: () => setPasswordForm(item),
    },
    { type: "divider" },
    {
      key: "deactivate",
      danger: true,
      disabled: !item.is_active,
      icon: <StopOutlined />,
      label: "Nonaktifkan",
      onClick: () => setConfirm(item),
    },
  ];

  const columns = [
    {
      title: "Admin/HRD",
      key: "name",
      render: (_, item) => (
        <Box>
          <FontStyle fontSize={12.5} fontWeight={600}>
            {item.full_name}
          </FontStyle>
          <Box
            sx={{ mt: 0.75, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.75 }}
          >
            <CompactInfoChip label={`@${item.username}`} />
            <FontStyle fontSize={10.5} sx={{ color: theme.ui.mutedText }}>
              {item.email}
            </FontStyle>
          </Box>
        </Box>
      ),
    },
    {
      title: "Organisasi",
      dataIndex: "organization_name",
      render: (value) => <CompactInfoChip label={value} tone="info" />,
    },
    {
      title: "Cakupan lokasi",
      dataIndex: "location_names",
      render: (value) => (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {(value || []).slice(0, 2).map((location) => (
            <CompactInfoChip key={location} label={location} tone="success" />
          ))}
          {(value || []).length > 2 ? (
            <CompactInfoChip label={`+${value.length - 2} lokasi`} tone="success" />
          ) : null}
          {!value?.length ? <FontStyle fontSize={11.5}>Belum ditetapkan</FontStyle> : null}
        </Box>
      ),
    },
    {
      title: "Status",
      dataIndex: "is_active",
      render: (value) => <CompactInfoChip status={value ? "active" : "inactive"} />,
    },
    {
      title: "Aksi",
      key: "action",
      width: 72,
      render: (_, item) => <RowActionMenu items={actions(item)} />,
    },
  ];

  const card = (item) => (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <FontStyle fontSize={14} fontWeight={600} noWrap>
            {item.full_name}
          </FontStyle>
          <Box sx={{ mt: 0.75, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            <CompactInfoChip label={`@${item.username}`} />
            <CompactInfoChip label={item.organization_name} tone="info" />
          </Box>
        </Box>
        <RowActionMenu items={actions(item)} />
      </Box>
      <Box sx={{ mt: 1.5 }}>
        <CompactInfoChip status={item.is_active ? "active" : "inactive"} />
      </Box>
      <Box sx={{ mt: 1.5 }}>
        <FontStyle fontSize={11} sx={{ mb: 0.75, color: theme.ui.mutedText }}>
          Cakupan lokasi
        </FontStyle>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {item.location_names?.length ? (
            item.location_names.map((location) => (
              <CompactInfoChip key={location} label={location} tone="success" />
            ))
          ) : (
            <CompactInfoChip label="Belum ditetapkan" tone="warning" />
          )}
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="Admin Organisasi"
        description="Kelola akun Admin/HRD dan cakupan lokasi yang dapat diakses."
        action={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setForm({ open: true, item: null })}
          >
            Tambah Admin/HRD
          </Button>
        }
      />
      <DataPanel
        title="Daftar Admin/HRD"
        description="Kelola identitas akun, organisasi, serta cakupan lokasi yang dapat diakses."
        toolbar={
          <DataToolbar
            embedded
            search={list.search}
            onSearchChange={list.setSearch}
            status={list.status}
            onStatusChange={list.setStatus}
            onRefresh={list.refresh}
            filters={
              <OrganizationSelect
                allowClear
                value={organizationId}
                onChange={(value) => list.updateFilters({ organizationId: value })}
                style={{ minWidth: 220 }}
              />
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
        />
      </DataPanel>
      <AdminUserForm
        open={form.open}
        item={form.item}
        presetOrganizationId={organizationId}
        onClose={() => setForm({ open: false, item: null })}
        onSaved={saved}
        onError={(message) => showNotification(message, "error")}
      />
      <ResetPasswordForm
        open={Boolean(passwordForm)}
        item={passwordForm}
        onClose={() => setPasswordForm(null)}
        onSaved={saved}
        onError={(message) => showNotification(message, "error")}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title="Nonaktifkan Admin/HRD?"
        message={`Akun @${confirm?.username || ""} tidak dapat masuk atau mengakses data organisasi setelah dinonaktifkan.`}
        confirmText="Nonaktifkan"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={deactivate}
      />
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
