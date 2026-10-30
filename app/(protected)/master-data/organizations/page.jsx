"use client";

import { useCallback, useState } from "react";
import { Button } from "antd";
import {
  EditOutlined,
  PlusOutlined,
  SettingOutlined,
  StopOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { Box } from "@mui/material";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import OperationalFilterSection from "@/app/components/filters/OperationalFilterSection";
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
import OrganizationModulesModal from "@/app/components/access/OrganizationModulesModal";
import { ORGANIZATION_MODULES } from "@/lib/access/organizationModules.mjs";
import { ReportCardFields } from "@/app/components/reports/ReportEmployeeFields";

/** Memformat tanggal database menjadi tanggal pendek yang mudah dipindai pengguna. */
const fmt = (value) =>
  value
    ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(
        new Date(`${value}T00:00:00`),
      )
    : "—";

export default function OrganizationsPage() {
  const list = useDataList("/api/organizations");
  const refreshOrganizations = list.refresh;
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const [form, setForm] = useState({ open: false, item: null });
  const [confirm, setConfirm] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [moduleOrganization, setModuleOrganization] = useState(null);
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
      key: "modules",
      icon: <SettingOutlined />,
      label: "Kelola fitur",
      onClick: () => setModuleOrganization(item),
    },
    {
      key: "edit",
      icon: <EditOutlined />,
      label: "Edit",
      onClick: () => setForm({ open: true, item }),
    },
    {
      key: "renew",
      icon: <SyncOutlined />,
      label: "Perpanjang masa akses",
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
  const accessStatus = (item) => (
    <CompactInfoChip wrap status={item.is_active ? item.subscription_status : "inactive"} />
  );
  const accessEnd = (item) =>
    item.subscription_status === "grace"
      ? item.subscription_grace_ends_on || item.subscription_ends_on
      : item.subscription_ends_on;
  const featureStatus = (item, code) => (
    <CompactInfoChip
      wrap
      status={
        item.active_features?.some((feature) => feature.code === code) ? "active" : "inactive"
      }
    />
  );
  const columns = [
    {
      title: "Kode",
      dataIndex: "code",
      width: 90,
      render: (value) => <CompactInfoChip wrap label={value} tone="neutral" />,
    },
    {
      title: "Nama organisasi",
      dataIndex: "name",
      width: 230,
      render: (value) => (
        <FontStyle fontSize={13} fontWeight={600}>
          {value}
        </FontStyle>
      ),
    },
    { title: "Lokasi aktif", dataIndex: "location_count", width: 100, align: "center" },
    { title: "Akun HRD", dataIndex: "admin_count", width: 100, align: "center" },
    {
      title: "Akses berakhir",
      key: "access_end",
      width: 150,
      render: (_, item) => (accessEnd(item) ? fmt(accessEnd(item)) : "Belum diatur"),
    },
    {
      title: "Status akses",
      key: "effective_status",
      width: 165,
      render: (_, item) => accessStatus(item),
    },
    ...ORGANIZATION_MODULES.map((feature) => ({
      title: feature.label,
      key: "feature_" + feature.code,
      width: 115,
      render: (_, item) => featureStatus(item, feature.code),
    })),
    {
      title: "Aksi",
      key: "action",
      fixed: "right",
      width: 72,
      render: (_, item) => (
        <RowActionMenu items={actions(item)} triggerLabel={"Aksi untuk " + item.name} />
      ),
    },
  ];
  const card = (item) => (
    <Box sx={{ minWidth: 0 }}>
      <FontStyle fontSize={14} fontWeight={600}>
        {item.name}
      </FontStyle>
      <ReportCardFields
        stacked
        fields={[
          ["Kode", <CompactInfoChip wrap key="code" label={item.code} tone="neutral" />],
          ["Lokasi aktif", item.location_count],
          ["Akun HRD", item.admin_count],
          ["Akses berakhir", accessEnd(item) ? fmt(accessEnd(item)) : "Belum diatur"],
          ["Status akses", accessStatus(item)],
          ...ORGANIZATION_MODULES.map((feature) => [
            feature.label,
            featureStatus(item, feature.code),
          ]),
        ]}
      />
      <Box sx={{ mt: 2 }}>
        <RowActionMenu
          items={actions(item)}
          triggerLabel={"Aksi untuk " + item.name}
          buttonLabel="Aksi organisasi"
          fullWidth
        />
      </Box>
    </Box>
  );
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="Organisasi"
        description="Kelola identitas organisasi, masa akses SITOU, serta aktivasi Inventaris dan Absensi."
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
      <OperationalFilterSection
        title="Filter organisasi"
        description="Cari dan saring daftar organisasi sesuai kebutuhan."
        searchLabel="Cari organisasi"
        searchPlaceholder="Nama atau kode organisasi"
        statusLabel="Status organisasi"
        search={list.search}
        onSearchChange={list.setSearch}
        status={list.status}
        onStatusChange={list.setStatus}
        onRefresh={list.refresh}
      />
      <DataPanel
        title="Daftar organisasi"
        description="Lihat lokasi aktif, akun HRD, masa akses, serta status Inventaris dan Absensi setiap organisasi."
      >
        <ResponsiveDataView
          scrollX={1210}
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
      <OrganizationModulesModal
        organization={moduleOrganization}
        onClose={() => setModuleOrganization(null)}
        onSaved={async (message) => {
          setModuleOrganization(null);
          showNotification(message);
          await list.refresh();
        }}
        onError={(message) => showNotification(message, "error")}
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
