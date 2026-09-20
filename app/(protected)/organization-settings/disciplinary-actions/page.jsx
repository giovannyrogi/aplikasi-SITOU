"use client";

import { useState } from "react";
import { Button } from "antd";
import { EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Box } from "@mui/material";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import DataToolbar from "@/app/components/filters/DataToolbar";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import RowActionMenu from "@/app/components/actions/RowActionMenu";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import Notification from "@/app/components/Notifications/Notification";
import FontStyle from "@/app/components/font-style/FontStyle";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import useDataList from "@/app/hooks/useDataList";
import useAppNotification from "@/app/hooks/useAppNotification";
import DisciplinaryActionTypeForm from "@/app/components/discipline/DisciplinaryActionTypeForm";

const durationLabel = (item) =>
  item.duration_mode === "indefinite"
    ? "Tanpa batas waktu"
    : `${item.duration_value} ${item.duration_unit === "day" ? "hari" : "bulan"}`;

export default function DisciplinaryActionSettingsPage() {
  const user = useAuthenticatedUser();
  const superadmin = user.role_code === "superadmin";
  const list = useDataList("/api/discipline/action-types", {
    requiredFilter: superadmin ? "organizationId" : undefined,
    initialFilters: superadmin ? {} : { organizationId: String(user.organization_id) },
  });
  const organizationId = superadmin ? list.filters.organizationId : String(user.organization_id);
  const [form, setForm] = useState({ open: false, item: null });
  const { notification, showNotification, closeNotification } = useAppNotification();
  const actions = (item) => [
    {
      key: "edit",
      icon: <EditOutlined />,
      label: "Edit",
      onClick: () => setForm({ open: true, item }),
    },
  ];
  const columns = [
    {
      title: "Nama sanksi",
      render: (_, item) => (
        <Box>
          <FontStyle fontSize={13} fontWeight={700}>
            {item.name}
          </FontStyle>
          <FontStyle fontSize={11.5} sx={{ mt: 0.4, color: "text.secondary" }}>
            Sudah digunakan pada {item.usage_count} tindakan
          </FontStyle>
        </Box>
      ),
    },
    ...(superadmin ? [{ title: "Organisasi", dataIndex: "organization_name" }] : []),
    {
      title: "Aturan",
      render: (_, item) => (
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          <CompactInfoChip label={durationLabel(item)} tone="info" />
          <CompactInfoChip
            label={item.requires_document ? "Surat wajib" : "Tanpa surat wajib"}
            tone={item.requires_document ? "warning" : "neutral"}
          />
        </Box>
      ),
    },
    {
      title: "Status",
      render: (_, item) => <CompactInfoChip status={item.is_active ? "active" : "inactive"} />,
    },
    { title: "Aksi", width: 72, render: (_, item) => <RowActionMenu items={actions(item)} /> },
  ];
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="Pengaturan Sanksi"
        description="Atur pilihan sanksi, masa berlaku, dan kewajiban surat resmi organisasi."
        action={
          superadmin ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!organizationId}
              onClick={() => setForm({ open: true, item: null })}
            >
              Tambah jenis sanksi
            </Button>
          ) : null
        }
      />
      <DataPanel
        title="Daftar jenis sanksi"
        description="Perubahan aturan hanya berlaku untuk tindakan yang diterbitkan setelah perubahan."
        toolbar={
          <DataToolbar
            embedded
            search={list.search}
            onSearchChange={list.setSearch}
            status={list.status}
            onStatusChange={list.setStatus}
            onRefresh={list.refresh}
            filters={
              superadmin ? (
                <OrganizationSelect
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
          emptyDescription={
            organizationId
              ? "Belum ada jenis sanksi pada organisasi ini."
              : "Pilih organisasi untuk menampilkan pengaturan sanksi."
          }
        />
      </DataPanel>
      <DisciplinaryActionTypeForm
        open={form.open}
        item={form.item}
        presetOrganizationId={organizationId}
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
