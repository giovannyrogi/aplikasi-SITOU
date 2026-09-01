"use client";

import { useState } from "react";
import { Button } from "antd";
import { EditOutlined, KeyOutlined, PlusOutlined } from "@ant-design/icons";
import { Box, useTheme } from "@mui/material";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import DataToolbar from "@/app/components/filters/DataToolbar";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import RowActionMenu from "@/app/components/actions/RowActionMenu";
import FontStyle from "@/app/components/font-style/FontStyle";
import Notification from "@/app/components/Notifications/Notification";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { ROLES } from "@/app/constants/roles";
import useDataList from "@/app/hooks/useDataList";
import useAppNotification from "@/app/hooks/useAppNotification";
import OrganizationAccountForm, {
  AccountPasswordForm,
} from "@/app/components/access/OrganizationAccountForm";

/** Akun organisasi mengelola akses tanpa mencampur profil pegawai dengan credential login. */
export default function OrganizationAccountsPage() {
  const theme = useTheme();
  const user = useAuthenticatedUser();
  const isSuperadmin = user.role_code === ROLES.SUPERADMIN;
  const list = useDataList("/api/access/accounts", {
    requiredFilter: isSuperadmin ? "organizationId" : undefined,
  });
  const { notification, showNotification, closeNotification } = useAppNotification();
  const [form, setForm] = useState({ open: false, item: null });
  const [passwordItem, setPasswordItem] = useState(null);
  const organizationId = isSuperadmin ? list.filters.organizationId : String(user.organization_id);
  const roleTone = { hrd: "info", leader: "warning", employee: "neutral" };
  const canManage = (item) => isSuperadmin || item.role_code === ROLES.EMPLOYEE;
  const actions = (item) =>
    canManage(item)
      ? [
          {
            key: "edit",
            icon: <EditOutlined />,
            label: "Edit",
            onClick: () => setForm({ open: true, item }),
          },
          {
            key: "password",
            icon: <KeyOutlined />,
            label: "Reset password",
            onClick: () => setPasswordItem(item),
          },
        ]
      : [];
  const columns = [
    {
      title: "Akun",
      key: "account",
      render: (_, item) => (
        <Box>
          <FontStyle fontWeight={700}>{item.display_name}</FontStyle>
          <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
            @{item.username}
            {item.contact_email ? ` · ${item.contact_email}` : ""}
          </FontStyle>
        </Box>
      ),
    },
    ...(isSuperadmin ? [{ title: "Organisasi", dataIndex: "organization_name" }] : []),
    {
      title: "Profil pegawai",
      key: "employee",
      render: (_, item) =>
        item.employee_name ? (
          <Box>
            <FontStyle fontWeight={600}>{item.employee_name}</FontStyle>
            <CompactInfoChip label={item.employee_no} tone="info" />
          </Box>
        ) : (
          <CompactInfoChip label="Belum ditautkan" tone="warning" />
        ),
    },
    {
      title: "Role",
      dataIndex: "role_code",
      render: (value) => (
        <CompactInfoChip
          label={value === "leader" ? "Pimpinan" : value === "employee" ? "Pegawai" : "HRD"}
          tone={roleTone[value]}
        />
      ),
    },
    {
      title: "Cakupan",
      key: "scope",
      render: (_, item) => (
        <CompactInfoChip
          label={
            item.role_code !== "hrd" || item.location_scope_mode === "all"
              ? "Seluruh lokasi"
              : `${item.locations.length} lokasi`
          }
          tone={item.location_scope_mode === "selected" ? "warning" : "success"}
        />
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
      render: (_, item) =>
        canManage(item) ? <RowActionMenu items={actions(item)} /> : <FontStyle>-</FontStyle>,
    },
  ];
  const card = (item) => (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
        <Box>
          <FontStyle fontWeight={700}>{item.display_name}</FontStyle>
          <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
            @{item.username}
          </FontStyle>
        </Box>
        {canManage(item) ? <RowActionMenu items={actions(item)} /> : null}
      </Box>
      <FontStyle fontSize={12} sx={{ mt: 1 }}>
        {item.employee_name || "Belum ditautkan ke pegawai"}
      </FontStyle>
      <Box sx={{ mt: 1.25, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
        <CompactInfoChip label={item.role_name} tone={roleTone[item.role_code]} />
        <CompactInfoChip status={item.is_active ? "active" : "inactive"} />
      </Box>
    </Box>
  );
  const saved = async (message) => {
    setForm({ open: false, item: null });
    setPasswordItem(null);
    showNotification(message);
    await list.refresh();
  };
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="Akun Organisasi"
        description={
          isSuperadmin
            ? "Kelola akun HRD, Pimpinan, dan Pegawai pada organisasi yang dipilih."
            : "Buat dan kelola akun Pegawai yang terhubung dengan profil pegawai."
        }
        action={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setForm({ open: true, item: null })}
            disabled={!isSuperadmin && !organizationId}
          >
            Tambah akun
          </Button>
        }
      />
      <DataPanel
        title="Daftar akun organisasi"
        description={
          isSuperadmin
            ? "Role Superadmin tidak dapat diberikan melalui menu ini."
            : "Daftar hanya menampilkan akun Pegawai yang dapat Anda kelola."
        }
        toolbar={
          <DataToolbar
            embedded
            search={list.search}
            onSearchChange={list.setSearch}
            status={list.status}
            onStatusChange={list.setStatus}
            onRefresh={list.refresh}
            filters={
              isSuperadmin ? (
                <OrganizationSelect
                  allowClear
                  autoSelectFirst
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
          emptyDescription={
            isSuperadmin && !organizationId
              ? "Pilih organisasi untuk menampilkan akun dan hak akses."
              : "Belum ada akun organisasi."
          }
        />
      </DataPanel>
      <OrganizationAccountForm
        open={form.open}
        item={form.item}
        organizationId={organizationId}
        onClose={() => setForm({ open: false, item: null })}
        onSaved={saved}
        onError={(message) => showNotification(message, "error")}
      />
      {passwordItem ? (
        <AccountPasswordForm
          open
          item={passwordItem}
          onClose={() => setPasswordItem(null)}
          onSaved={saved}
          onError={(message) => showNotification(message, "error")}
        />
      ) : null}
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
