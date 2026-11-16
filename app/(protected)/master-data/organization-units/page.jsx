"use client";

import { readApiResponse } from "@/lib/api/clientError";

import { useState } from "react";
import { Button } from "antd";
import { EditOutlined, PlusOutlined, StopOutlined } from "@ant-design/icons";
import { Box } from "@mui/material";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import OperationalFilterSection from "@/app/components/filters/OperationalFilterSection";
import ResponsiveRecordView from "@/app/components/data-display/ResponsiveRecordView";
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
import OrganizationUnitForm from "./OrganizationUnitForm";

/** Halaman CRUD Divisi & Unit untuk Superadmin dan Admin/HRD yang terisolasi organisasi. */
export default function OrganizationUnitsPage() {
  const user = useAuthenticatedUser();
  const isSuperadmin = user.role_code === ROLES.SUPERADMIN;
  const list = useDataList("/api/organization-units");
  const organizationId = isSuperadmin ? list.filters.organizationId : String(user.organization_id);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const [form, setForm] = useState({ open: false, item: null });
  const [confirm, setConfirm] = useState(null);

  const saved = async (message) => {
    setForm({ open: false, item: null });
    showNotification(message);
    await list.refresh();
  };

  const deactivate = async () => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(`/api/organization-units/${confirm.id}`, {
            method: "DELETE",
          });
          const body = await readApiResponse(response);
          showNotification(body.message);
          await list.refresh();
        },
        { message: "Menonaktifkan divisi atau unit..." },
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
      title: "Divisi atau unit",
      key: "unit",
      cardRender: (_, item) => item.name,
      render: (_, item) => (
        <Box>
          <FontStyle fontSize={14} fontWeight={600}>
            {item.name}
          </FontStyle>
          <Box sx={{ mt: 0.75, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            <CompactInfoChip
              label={item.unit_type_name}
              tone={item.unit_type_is_active ? "info" : "warning"}
            />
          </Box>
        </Box>
      ),
    },
    ...(isSuperadmin ? [{ title: "Organisasi", dataIndex: "organization_name" }] : []),
    {
      title: "Unit induk",
      dataIndex: "parent_unit_name",
      render: (value) => value || "Tanpa unit induk",
    },
    {
      title: "Lokasi operasional",
      key: "locations",
      cardRender: (_, item) =>
        item.locations?.length
          ? item.locations.map((location) => location.name).join("\n")
          : "Belum ada lokasi",
      render: (_, item) => (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {(item.locations || []).slice(0, 2).map((location) => (
            <CompactInfoChip wrap key={location.id} label={location.name} tone="info" />
          ))}
          {item.locations?.length > 2 ? (
            <CompactInfoChip label={`+${item.locations.length - 2} lokasi`} tone="warning" />
          ) : null}
          {!item.locations?.length ? (
            <CompactInfoChip label="Belum ada lokasi" tone="neutral" />
          ) : null}
        </Box>
      ),
    },
    {
      title: "Status",
      key: "status",
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

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="Divisi & Unit"
        description="Susun direktorat, divisi, departemen, unit, dan tim pada organisasi."
        action={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setForm({ open: true, item: null })}
          >
            Tambah divisi atau unit
          </Button>
        }
      />
      <OperationalFilterSection
        title="Filter Divisi & Unit"
        description="Cari dan saring daftar Divisi & Unit sesuai kebutuhan."
        searchLabel="Cari Divisi & Unit"
        searchPlaceholder="Nama Divisi & Unit"
        statusLabel="Status Divisi & Unit"
        search={list.search}
        onSearchChange={list.setSearch}
        status={list.status}
        onStatusChange={list.setStatus}
        onRefresh={list.refresh}
        items={[
          {
            key: "organization",
            label: "Organisasi",
            control: isSuperadmin ? (
              <OrganizationSelect
                allowClear
                value={organizationId}
                onChange={(value) => list.updateFilters({ organizationId: value })}
              />
            ) : null,
          },
        ]}
      />
      <DataPanel
        title="Daftar divisi & unit"
        description="Kelola hierarki struktur dan lokasi operasional setiap unit."
      >
        <ResponsiveRecordView
          data={list.data}
          columns={columns}
          loading={list.loading}
          error={list.error}
          onRetry={list.refresh}
          pagination={list.pagination}
          onPageChange={list.setPage}
          renderCardBadges={(item) => (
            <CompactInfoChip
              wrap
              label={item.unit_type_name}
              tone={item.unit_type_is_active ? "info" : "warning"}
            />
          )}
          rowActions={actions}
        />
      </DataPanel>
      <OrganizationUnitForm
        open={form.open}
        item={form.item}
        presetOrganizationId={organizationId}
        onClose={() => setForm({ open: false, item: null })}
        onSaved={saved}
        onError={(message) => showNotification(message, "error")}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title="Nonaktifkan divisi atau unit?"
        message={`Divisi atau unit ${confirm?.name || ""} tidak dapat dipilih untuk penempatan baru. Pegawai yang masih ditempatkan di sini dapat kehilangan akses sampai dipindahkan atau unit diaktifkan kembali.`}
        confirmText="Nonaktifkan"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={deactivate}
      />
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
