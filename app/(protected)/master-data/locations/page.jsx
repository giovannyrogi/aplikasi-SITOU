"use client";

import { useState } from "react";
import { Button } from "antd";
import { EditOutlined, PlusOutlined, StopOutlined } from "@ant-design/icons";
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
import LocationForm from "./LocationForm";
const LABEL = {
  head_office: "Kantor pusat",
  branch: "Cabang",
  market: "Pasar",
  site: "Site",
  warehouse: "Gudang",
  other: "Lainnya",
};
export default function LocationsPage() {
  const theme = useTheme();
  const list = useDataList("/api/locations");
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const [form, setForm] = useState({ open: false, item: null });
  const [confirm, setConfirm] = useState(null);
  const organizationId = list.filters.organizationId;
  const saved = async (m) => {
    setForm({ open: false, item: null });
    showNotification(m);
    await list.refresh();
  };
  const deactivate = async () => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const r = await fetch(`/api/locations/${confirm.id}`, { method: "DELETE" });
          const b = await r.json();
          if (!r.ok) throw new Error(b.message);
          showNotification(b.message);
          await list.refresh();
        },
        { message: "Menonaktifkan lokasi..." },
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
      key: "stop",
      danger: true,
      disabled: !item.is_active,
      icon: <StopOutlined />,
      label: "Nonaktifkan",
      onClick: () => setConfirm(item),
    },
  ];
  const columns = [
    {
      title: "Lokasi",
      key: "name",
      render: (_, i) => (
        <Box>
          <FontStyle fontSize={12.5} fontWeight={600}>
            {i.name}
          </FontStyle>
          <Box sx={{ mt: 0.75, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            <CompactInfoChip label={i.code} />
            <CompactInfoChip label={LABEL[i.location_type]} tone="info" />
          </Box>
        </Box>
      ),
    },
    { title: "Organisasi", dataIndex: "organization_name" },
    { title: "Induk", dataIndex: "parent_location_name", render: (v) => v || "-" },
    {
      title: "Admin",
      dataIndex: "admin_count",
      render: (v) => <CompactInfoChip label={`${v} akun`} tone="warning" />,
    },
    {
      title: "Status",
      dataIndex: "is_active",
      render: (v) => <CompactInfoChip status={v ? "active" : "inactive"} />,
    },
    {
      title: "Aksi",
      key: "action",
      width: 72,
      render: (_, i) => <RowActionMenu items={actions(i)} />,
    },
  ];
  const card = (i) => (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Box>
          <FontStyle fontSize={14} fontWeight={600}>
            {i.name}
          </FontStyle>
          <Box sx={{ mt: 0.75, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            <CompactInfoChip label={i.code} />
            <CompactInfoChip label={LABEL[i.location_type]} tone="info" />
          </Box>
        </Box>
        <RowActionMenu items={actions(i)} />
      </Box>
      <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 1 }}>
        <CompactInfoChip status={i.is_active ? "active" : "inactive"} />
        <CompactInfoChip label={`${i.admin_count} admin`} tone="warning" />
      </Box>
      <FontStyle fontSize={11.5} sx={{ mt: 1.5, color: theme.ui.mutedText }}>
        {i.organization_name}
      </FontStyle>
    </Box>
  );
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="Lokasi"
        description="Kelola kantor pusat, cabang, pasar, site, dan lokasi kerja setiap organisasi."
        action={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setForm({ open: true, item: null })}
          >
            Tambah lokasi
          </Button>
        }
      />
      <DataPanel
        title="Daftar lokasi"
        description="Tinjau lokasi operasional dan cakupan Admin/HRD pada setiap organisasi."
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
      <LocationForm
        open={form.open}
        item={form.item}
        presetOrganizationId={organizationId}
        onClose={() => setForm({ open: false, item: null })}
        onSaved={saved}
        onError={(m) => showNotification(m, "error")}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title="Nonaktifkan lokasi?"
        message={`Lokasi ${confirm?.name || ""} akan dinonaktifkan. Akun yang tidak memiliki lokasi operasional aktif lain tidak dapat masuk ke SITOU hingga cakupannya diperbarui atau lokasi ini diaktifkan kembali.`}
        confirmText="Nonaktifkan"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={deactivate}
      />
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
