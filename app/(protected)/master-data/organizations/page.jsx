"use client";

import { useState } from "react";
import { Button } from "antd";
import { EditOutlined, PlusOutlined, StopOutlined, SyncOutlined } from "@ant-design/icons";
import { Box } from "@mui/material";
import PageHeader from "@/app/components/layout/PageHeader";
import DataToolbar from "@/app/components/filters/DataToolbar";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import StatusBadge from "@/app/components/data-display/StatusBadge";
import RowActionMenu from "@/app/components/actions/RowActionMenu";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import Notification from "@/app/components/Notifications/Notification";
import FontStyle from "@/app/components/font-style/FontStyle";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import useDataList from "@/app/hooks/useDataList";
import useAppNotification from "@/app/hooks/useAppNotification";
import OrganizationForm from "./OrganizationForm";

const fmt = (value) =>
  new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(`${value}T00:00:00`),
  );
export default function OrganizationsPage() {
  const list = useDataList("/api/organizations");
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const [form, setForm] = useState({ open: false, item: null });
  const [confirm, setConfirm] = useState(null);
  const saved = (message) => {
    setForm({ open: false, item: null });
    showNotification(message);
    list.refresh();
  };
  const deactivate = async () => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const r = await fetch(`/api/organizations/${confirm.id}`, { method: "DELETE" });
          const b = await r.json();
          if (!r.ok) throw new Error(b.message);
          showNotification(b.message);
          list.refresh();
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
      onClick: () =>
        showNotification("Fitur perpanjangan akan tersedia pada tahap berikutnya.", "info"),
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
      title: "Organisasi",
      key: "name",
      render: (_, item) => (
        <Box>
          <FontStyle fontSize={12.5} fontWeight={600}>
            {item.name}
          </FontStyle>
          <FontStyle fontSize={11} sx={{ color: "#5F6B7A" }}>
            {item.code}
            {item.legal_name ? ` · ${item.legal_name}` : ""}
          </FontStyle>
        </Box>
      ),
    },
    {
      title: "Jenis",
      dataIndex: "organization_type",
      render: (v) => ({ company: "Perusahaan", holding: "Holding", agency: "Agency" })[v],
    },
    {
      title: "Onboarding",
      key: "counts",
      render: (_, item) => (
        <FontStyle fontSize={11.5}>
          {item.location_count} lokasi · {item.admin_count} admin
        </FontStyle>
      ),
    },
    {
      title: "Masa berlaku",
      key: "validity",
      render: (_, item) => (
        <Box>
          <FontStyle fontSize={11.5}>
            {fmt(item.active_from)} - {fmt(item.active_until)}
          </FontStyle>
          <FontStyle fontSize={10.5} sx={{ color: "#5F6B7A" }}>
            {item.days_remaining >= 0
              ? `${item.days_remaining} hari tersisa`
              : "Masa akses berakhir"}
          </FontStyle>
        </Box>
      ),
    },
    {
      title: "Status",
      dataIndex: "subscription_status",
      render: (v) => <StatusBadge status={v} />,
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
          <FontStyle fontSize={11} sx={{ color: "#5F6B7A" }}>
            {item.code}
          </FontStyle>
        </Box>
        <RowActionMenu items={actions(item)} />
      </Box>
      <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 1 }}>
        <StatusBadge status={item.subscription_status} />
        <StatusBadge
          status={item.location_count > 0 && item.admin_count > 0 ? "ready" : "not_started"}
          label={item.location_count > 0 && item.admin_count > 0 ? "Siap digunakan" : "Onboarding"}
        />
      </Box>
      <FontStyle fontSize={11.5} sx={{ mt: 1.5, color: "#5F6B7A" }}>
        Berlaku sampai {fmt(item.active_until)} · {item.location_count} lokasi · {item.admin_count}{" "}
        admin
      </FontStyle>
    </Box>
  );
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="Organisasi"
        description="Kelola tenant, kesiapan onboarding, dan masa akses SITOU."
        count={list.pagination.total}
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
      <DataToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        status={list.status}
        onStatusChange={list.setStatus}
        onRefresh={list.refresh}
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
      <OrganizationForm
        open={form.open}
        item={form.item}
        onClose={() => setForm({ open: false, item: null })}
        onSaved={saved}
        onError={(m) => showNotification(m, "error")}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title="Nonaktifkan organisasi?"
        message={`Akun tenant ${confirm?.name || ""} tidak dapat memakai SITOU setelah dinonaktifkan.`}
        confirmText="Nonaktifkan"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={deactivate}
      />
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
