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
import PositionForm from "./PositionForm";

/** Halaman CRUD jabatan yang memakai komponen list SITOU secara konsisten. */
export default function PositionsPage() {
  const user = useAuthenticatedUser();
  const isSuperadmin = user.role_code === ROLES.SUPERADMIN;
  const list = useDataList("/api/positions");
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
          const response = await fetch(`/api/positions/${confirm.id}`, { method: "DELETE" });
          const body = await readApiResponse(response);
          showNotification(body.message);
          await list.refresh();
        },
        { message: "Menonaktifkan jabatan..." },
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
      title: "Jabatan",
      key: "position",
      render: (_, item) => (
        <Box>
          <FontStyle fontSize={14} fontWeight={600}>
            {item.name}
          </FontStyle>
          {item.grade && (
            <Box sx={{ mt: 0.75 }}>
              <CompactInfoChip label={`Golongan ${item.grade}`} tone="info" />
            </Box>
          )}
        </Box>
      ),
    },
    ...(isSuperadmin ? [{ title: "Organisasi", dataIndex: "organization_name" }] : []),
    {
      title: "Tingkat jabatan",
      key: "level",
      render: (_, item) => (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          <CompactInfoChip
            label={item.level_no ? `Tingkat ${item.level_no}` : "Belum diatur"}
            tone={item.level_no ? "info" : "neutral"}
          />
          {item.is_managerial ? <CompactInfoChip label="Jabatan pimpinan" tone="warning" /> : null}
        </Box>
      ),
    },
    {
      title: "Pegawai aktif",
      dataIndex: "employee_count",
      render: (value) => <CompactInfoChip label={`${value} pegawai`} tone="info" />,
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
        title="Jabatan"
        description="Atur nama jabatan, golongan, tingkat jabatan, dan jabatan pimpinan."
        action={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setForm({ open: true, item: null })}
          >
            Tambah jabatan
          </Button>
        }
      />
      <OperationalFilterSection
        title="Filter jabatan"
        description="Cari dan saring daftar jabatan sesuai kebutuhan."
        searchLabel="Cari jabatan"
        searchPlaceholder="Nama jabatan"
        statusLabel="Status jabatan"
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
        title="Daftar jabatan"
        description="Jabatan aktif dapat dipakai pada penempatan dan histori karier pegawai."
      >
        <ResponsiveRecordView
          data={list.data}
          columns={columns}
          loading={list.loading}
          error={list.error}
          onRetry={list.refresh}
          pagination={list.pagination}
          onPageChange={list.setPage}
          rowActions={actions}
        />
      </DataPanel>
      <PositionForm
        open={form.open}
        item={form.item}
        presetOrganizationId={organizationId}
        onClose={() => setForm({ open: false, item: null })}
        onSaved={saved}
        onError={(message) => showNotification(message, "error")}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title="Nonaktifkan jabatan?"
        message={`Jabatan ${confirm?.name || ""} tidak dapat dipilih untuk penempatan baru. Histori pegawai tetap disimpan.`}
        confirmText="Nonaktifkan"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={deactivate}
      />
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
