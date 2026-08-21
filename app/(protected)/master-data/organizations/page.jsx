"use client";

import { useCallback, useState } from "react";
import { Button } from "antd";
import { EditOutlined, PlusOutlined, StopOutlined, SyncOutlined } from "@ant-design/icons";
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
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import useDataList from "@/app/hooks/useDataList";
import useAppNotification from "@/app/hooks/useAppNotification";
import OrganizationForm from "./OrganizationForm";
import SubscriptionModal from "./SubscriptionModal";

/** Memformat tanggal database menjadi tanggal pendek yang mudah dipindai pengguna. */
const fmt = (value) =>
  value
    ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(
        new Date(`${value}T00:00:00`),
      )
    : "—";

/** Memilih tone sisa masa berlaku berdasarkan tingkat urgensinya. */
const getRemainingTone = (daysRemaining) => {
  if (!Number.isFinite(daysRemaining) || daysRemaining < 0) return "danger";
  if (daysRemaining <= 7) return "danger";
  if (daysRemaining <= 30) return "warning";
  return "success";
};

export default function OrganizationsPage() {
  const theme = useTheme();
  const list = useDataList("/api/organizations");
  const refreshOrganizations = list.refresh;
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const [form, setForm] = useState({ open: false, item: null });
  const [confirm, setConfirm] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const handleSubscriptionChanged = useCallback(
    async (message) => {
      showNotification(message);
      await refreshOrganizations();
    },
    [refreshOrganizations, showNotification],
  );
  const handleSubscriptionError = useCallback(
    (message) => showNotification(message, "error"),
    [showNotification],
  );
  const saved = async (message) => {
    setForm({ open: false, item: null });
    showNotification(message);
    await list.refresh();
  };
  const deactivate = async () => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const r = await fetch(`/api/organizations/${confirm.id}`, { method: "DELETE" });
          const b = await r.json();
          if (!r.ok) throw new Error(b.message);
          showNotification(b.message);
          await refreshOrganizations();
        },
        { message: "Menonaktifkan organisasi..." },
      );
    } catch (e) {
      showNotification(e.message, "error");
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
      key: "renew",
      icon: <SyncOutlined />,
      label: "Perpanjang",
      onClick: () => setSubscription(item),
    },
    { type: "divider" },
    {
      key: "deactivate",
      danger: true,
      disabled: !item.is_active,
      icon: <StopOutlined />,
      label: "Nonaktifkan organisasi",
      onClick: () => setConfirm(item),
    },
  ];
  const columns = [
    {
      title: "Organisasi",
      key: "name",
      render: (_, item) => (
        <Box>
          <FontStyle fontSize={12.5} fontWeight={600}>
            {item.name}
          </FontStyle>
          <Box
            sx={{ mt: 0.75, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.75 }}
          >
            <CompactInfoChip label={item.code} />
            {item.legal_name ? (
              <FontStyle fontSize={10.5} sx={{ color: theme.ui.mutedText }}>
                {item.legal_name}
              </FontStyle>
            ) : null}
          </Box>
        </Box>
      ),
    },
    {
      title: "Jenis",
      dataIndex: "organization_type",
      render: (v) => (
        <CompactInfoChip
          label={{ company: "Organisasi", holding: "Holding", agency: "Agency" }[v] || v}
          tone="info"
        />
      ),
    },
    {
      title: "Onboarding",
      key: "counts",
      render: (_, item) => (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          <CompactInfoChip label={`${item.location_count} lokasi`} tone="info" />
          <CompactInfoChip label={`${item.admin_count} admin`} tone="warning" />
        </Box>
      ),
    },
    {
      title: "Masa berlaku",
      key: "validity",
      render: (_, item) => (
        <Box>
          <FontStyle fontSize={11.5}>
            {fmt(item.subscription_starts_on)} - {fmt(item.subscription_ends_on)}
          </FontStyle>
          <Box sx={{ mt: 0.75 }}>
            <CompactInfoChip
              label={
                Number.isFinite(item.days_remaining) && item.days_remaining >= 0
                  ? `${item.days_remaining} hari tersisa`
                  : "Masa akses berakhir"
              }
              tone={getRemainingTone(item.days_remaining)}
            />
          </Box>
        </Box>
      ),
    },
    {
      title: "Status",
      key: "effective_status",
      render: (_, item) => (
        <CompactInfoChip status={item.is_active ? item.subscription_status : "inactive"} />
      ),
    },
    {
      title: "Aksi",
      key: "action",
      fixed: "right",
      width: 72,
      render: (_, item) => <RowActionMenu items={actions(item)} />,
    },
  ];
  const card = (item) => (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
        <Box>
          <FontStyle fontSize={14} fontWeight={600}>
            {item.name}
          </FontStyle>
          <Box sx={{ mt: 0.75 }}>
            <CompactInfoChip label={item.code} />
          </Box>
        </Box>
        <RowActionMenu items={actions(item)} />
      </Box>
      <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 1 }}>
        <CompactInfoChip status={item.is_active ? item.subscription_status : "inactive"} />
        <CompactInfoChip
          label={
            { company: "Organisasi", holding: "Holding", agency: "Agency" }[
              item.organization_type
            ] || item.organization_type
          }
          tone="info"
        />
        <CompactInfoChip
          label={`${item.location_count} lokasi · ${item.admin_count} admin`}
          tone="warning"
        />
      </Box>
      <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
          Berlaku sampai {fmt(item.subscription_ends_on)}
        </FontStyle>
        <CompactInfoChip
          label={
            Number.isFinite(item.days_remaining) && item.days_remaining >= 0
              ? `${item.days_remaining} hari tersisa`
              : "Masa akses berakhir"
          }
          tone={getRemainingTone(item.days_remaining)}
        />
      </Box>
    </Box>
  );
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="Organisasi"
        description="Kelola organisasi, kesiapan onboarding, dan masa akses SITOU."
        action={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setForm({ open: true, item: null })}
          >
            Tambah organisasi
          </Button>
        }
      />
      <DataPanel
        title="Daftar organisasi"
        description="Cari, pantau onboarding, dan kelola masa akses organisasi dari satu tempat."
        toolbar={
          <DataToolbar
            embedded
            search={list.search}
            onSearchChange={list.setSearch}
            status={list.status}
            onStatusChange={list.setStatus}
            onRefresh={list.refresh}
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
      <OrganizationForm
        open={form.open}
        item={form.item}
        onClose={() => setForm({ open: false, item: null })}
        onSaved={saved}
        onError={(m) => showNotification(m, "error")}
      />
      <SubscriptionModal
        open={Boolean(subscription)}
        organization={subscription}
        onClose={() => setSubscription(null)}
        onChanged={handleSubscriptionChanged}
        onError={handleSubscriptionError}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title="Nonaktifkan organisasi?"
        message={`Akun organisasi ${confirm?.name || ""} tidak dapat memakai SITOU setelah dinonaktifkan.`}
        confirmText="Nonaktifkan"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={deactivate}
      />
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
