"use client";

import { useState } from "react";
import { Button } from "antd";
import { EditOutlined, KeyOutlined, PlusOutlined, StopOutlined } from "@ant-design/icons";
import { Box } from "@mui/material";
import PageHeader from "@/app/components/layout/PageHeader";
import DataToolbar from "@/app/components/filters/DataToolbar";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import StatusBadge from "@/app/components/data-display/StatusBadge";
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
  const list = useDataList("/api/admin-users");
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const [form, setForm] = useState({ open: false, item: null });
  const [passwordForm, setPasswordForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const organizationId = list.filters.organizationId;

  const saved = (message) => {
    setForm({ open: false, item: null });
    setPasswordForm(null);
    showNotification(message);
    list.refresh();
  };

  const deactivate = async () => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(`/api/admin-users/${confirm.id}`, { method: "DELETE" });
          const body = await response.json();
          if (!response.ok) throw new Error(body.message);
          showNotification(body.message);
          list.refresh();
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
          <FontStyle fontSize={11} sx={{ color: "#5F6B7A" }}>
            @{item.username} · {item.email}
          </FontStyle>
        </Box>
      ),
    },
    { title: "Organisasi", dataIndex: "organization_name" },
    {
      title: "Cakupan lokasi",
      dataIndex: "location_names",
      render: (value) => value?.join(", ") || "Belum ditetapkan",
    },
    {
      title: "Status",
      dataIndex: "is_active",
      render: (value) => <StatusBadge status={value ? "active" : "inactive"} />,
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
          <FontStyle fontSize={11} sx={{ color: "#5F6B7A" }} noWrap>
            @{item.username} · {item.organization_name}
          </FontStyle>
        </Box>
        <RowActionMenu items={actions(item)} />
      </Box>
      <Box sx={{ mt: 1.5 }}>
        <StatusBadge status={item.is_active ? "active" : "inactive"} />
      </Box>
      <FontStyle fontSize={11.5} sx={{ mt: 1.5, color: "#5F6B7A" }}>
        Cakupan: {item.location_names?.join(", ") || "belum ditetapkan"}
      </FontStyle>
    </Box>
  );

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="Admin Organisasi"
        description="Kelola akun Admin/HRD dan cakupan lokasi yang dapat diakses."
        count={list.pagination.total}
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
      <DataToolbar
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
