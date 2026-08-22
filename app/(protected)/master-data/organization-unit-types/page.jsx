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
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { ROLES } from "@/app/constants/roles";
import useDataList from "@/app/hooks/useDataList";
import useAppNotification from "@/app/hooks/useAppNotification";
import OrganizationUnitTypeForm from "./OrganizationUnitTypeForm";

/** Halaman CRUD master jenis unit yang fleksibel dan terisolasi per organisasi. */
export default function OrganizationUnitTypesPage() {
  const theme = useTheme();
  const user = useAuthenticatedUser();
  const isSuperadmin = user.role_code === ROLES.SUPERADMIN;
  const list = useDataList("/api/organization-unit-types");
  const organizationId = isSuperadmin ? list.filters.organizationId : String(user.organization_id);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const [form, setForm] = useState({ open: false, item: null });
  const [confirm, setConfirm] = useState(null);

  /** Menutup modal, menampilkan feedback, dan memuat ulang daftar setelah simpan. */
  const saved = async (message) => {
    setForm({ open: false, item: null });
    showNotification(message);
    await list.refresh();
  };

  /** Menonaktifkan jenis tanpa menghapus unit yang telah menggunakannya. */
  const deactivate = async () => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(`/api/organization-unit-types/${confirm.id}`, {
            method: "DELETE",
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.message);
          showNotification(body.message);
          await list.refresh();
        },
        { message: "Menonaktifkan jenis unit..." },
      );
    } catch (error) {
      showNotification(error.message, "error");
    } finally {
      setConfirm(null);
    }
  };

  /** Menyusun aksi konsisten untuk tabel desktop dan kartu mobile. */
  const actions = (item) => [
    {
      key: "edit",
      icon: <EditOutlined />,
      label: "Edit",
      onClick: () => setForm({ open: true, item }),
    },
    {
      key: "deactivate",
      icon: <StopOutlined />,
      label: "Nonaktifkan",
      danger: true,
      disabled: !item.is_active,
      onClick: () => setConfirm(item),
    },
  ];

  const columns = [
    {
      title: "Jenis unit",
      key: "type",
      render: (_, item) => (
        <Box>
          <FontStyle fontSize={12.5} fontWeight={600}>
            {item.name}
          </FontStyle>
          <Box sx={{ mt: 0.75 }}>
            <CompactInfoChip label={item.code} tone="info" />
          </Box>
        </Box>
      ),
    },
    ...(isSuperadmin ? [{ title: "Organisasi", dataIndex: "organization_name" }] : []),
    {
      title: "Deskripsi",
      dataIndex: "description",
      render: (value) => value || "-",
    },
    {
      title: "Urutan",
      dataIndex: "sort_order",
      width: 96,
      render: (value) => <CompactInfoChip label={String(value)} tone="neutral" />,
    },
    {
      title: "Digunakan",
      dataIndex: "usage_count",
      render: (value) => (
        <CompactInfoChip label={`${value} unit`} tone={Number(value) > 0 ? "info" : "neutral"} />
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

  /** Menyajikan data yang sama sebagai kartu pada layar sempit. */
  const card = (item) => (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <FontStyle fontSize={14} fontWeight={600}>
            {item.name}
          </FontStyle>
          <Box sx={{ mt: 0.75 }}>
            <CompactInfoChip label={item.code} tone="info" />
          </Box>
        </Box>
        <RowActionMenu items={actions(item)} />
      </Box>
      <FontStyle fontSize={11.5} sx={{ mt: 1.5, color: theme.ui.mutedText }}>
        {item.description || "Belum ada deskripsi."}
      </FontStyle>
      <Box sx={{ mt: 1.25, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
        <CompactInfoChip status={item.is_active ? "active" : "inactive"} />
        <CompactInfoChip label={`Urutan ${item.sort_order}`} tone="neutral" />
        <CompactInfoChip
          label={`${item.usage_count} unit`}
          tone={Number(item.usage_count) > 0 ? "info" : "neutral"}
        />
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="Jenis Unit Organisasi"
        description="Kelola klasifikasi struktur yang digunakan pada Divisi & Unit."
        action={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setForm({ open: true, item: null })}
          >
            Tambah jenis unit
          </Button>
        }
      />
      <DataPanel
        title="Daftar jenis unit organisasi"
        description="Jenis aktif tersedia pada form Divisi & Unit sesuai urutan tampil."
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
        />
      </DataPanel>
      <OrganizationUnitTypeForm
        open={form.open}
        item={form.item}
        presetOrganizationId={organizationId}
        onClose={() => setForm({ open: false, item: null })}
        onSaved={saved}
        onError={(message) => showNotification(message, "error")}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title="Nonaktifkan jenis unit?"
        message={`Jenis ${confirm?.name || ""} tidak dapat dipilih untuk unit baru. ${confirm?.usage_count || 0} unit yang sudah menggunakannya tetap tersimpan.`}
        confirmText="Nonaktifkan"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={deactivate}
      />
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
