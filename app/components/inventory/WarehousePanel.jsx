"use client";
import { useEffect, useState } from "react";
import { Button } from "antd";
import { EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Box } from "@mui/material";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import DataToolbar from "@/app/components/filters/DataToolbar";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import RowActionMenu from "@/app/components/actions/RowActionMenu";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import Notification from "@/app/components/Notifications/Notification";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import useDataList from "@/app/hooks/useDataList";
import useAppNotification from "@/app/hooks/useAppNotification";
import WarehouseForm from "./WarehouseForm";
export default function WarehousePanel({ organizationId, organizationFilter }) {
  const user = useAuthenticatedUser();
  const list = useDataList("/api/inventory/warehouses", {
    requiredFilter: "organizationId",
    initialFilters: { organizationId },
  });
  const { notification, showNotification, closeNotification } = useAppNotification();
  const [form, setForm] = useState({ open: false, item: null });
  const refresh = list.refresh;
  useEffect(() => {
    const handler = () => void refresh();
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [refresh]);
  const actions = (row) =>
    row.canEdit ? (
      <RowActionMenu
        items={[
          {
            key: "edit",
            label: "Edit gudang",
            icon: <EditOutlined />,
            onClick: () => setForm({ open: true, item: row }),
          },
        ]}
      />
    ) : null;
  const columns = [
    {
      title: "Gudang",
      key: "name",
      render: (_, row) => (
        <Box>
          <FontStyle fontWeight={700}>{row.name}</FontStyle>
          <Box sx={{ mt: 0.75 }}>
            <CompactInfoChip label={row.code} tone="info" />
          </Box>
        </Box>
      ),
    },
    { title: "Lokasi", dataIndex: "location_name" },
    {
      title: "Status",
      dataIndex: "is_active",
      render: (value) => <CompactInfoChip status={value ? "active" : "inactive"} />,
    },
    {
      title: "Aksi",
      key: "action",
      align: "center",
      width: 88,
      render: (_, row) => (
        <Box sx={{ display: "flex", justifyContent: "center" }}>{actions(row)}</Box>
      ),
    },
  ];
  const card = (row) => (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 2 }}>
        <Box>
          <FontStyle fontWeight={700}>{row.name}</FontStyle>
          <Box sx={{ mt: 0.75 }}>
            <CompactInfoChip label={row.code} tone="info" />
          </Box>
        </Box>
        {actions(row)}
      </Box>
      <FontStyle fontSize={13}>{row.location_name}</FontStyle>
      <Box>
        <CompactInfoChip status={row.is_active ? "active" : "inactive"} />
      </Box>
    </Box>
  );
  return (
    <Box sx={{ minWidth: 0, display: "grid", gap: 3 }}>
      <PageHeader
        title="Gudang"
        description={
          organizationId
            ? "Kelola tempat penyimpanan barang sesuai cakupan akses."
            : "Pilih organisasi pada filter untuk membuka gudang."
        }
        action={
          organizationId && !list.loading && !list.error && user.access?.canCreateWarehouse ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setForm({ open: true, item: null })}
            >
              Tambah gudang
            </Button>
          ) : null
        }
      />
      <DataPanel
        title="Daftar gudang"
        description={
          list.loading
            ? "Memuat gudang..."
            : `${list.pagination.total} gudang sesuai cakupan akses Anda.`
        }
        toolbar={
          <DataToolbar
            embedded
            search={list.search}
            onSearchChange={list.setSearch}
            status={list.status}
            onStatusChange={list.setStatus}
            onRefresh={list.refresh}
            filters={organizationFilter}
          />
        }
      >
        <ResponsiveDataView
          data={list.data}
          columns={columns}
          renderCard={card}
          loading={list.loading}
          error={list.error}
          emptyDescription={
            !organizationId ? "Pilih organisasi pada filter untuk menampilkan data." : undefined
          }
          onRetry={list.refresh}
          pagination={list.pagination}
          onPageChange={list.setPage}
        />
      </DataPanel>
      <WarehouseForm
        open={form.open}
        item={form.item}
        organizationId={organizationId}
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
