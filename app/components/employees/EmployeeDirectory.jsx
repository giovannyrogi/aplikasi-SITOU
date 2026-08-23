"use client";

import { useState } from "react";
import { Button } from "antd";
import { EyeOutlined, ImportOutlined, PlusOutlined } from "@ant-design/icons";
import { Box, useTheme } from "@mui/material";
import { useRouter } from "next/navigation";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import DataToolbar from "@/app/components/filters/DataToolbar";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import RowActionMenu from "@/app/components/actions/RowActionMenu";
import Notification from "@/app/components/Notifications/Notification";
import FontStyle from "@/app/components/font-style/FontStyle";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { ROLES } from "@/app/constants/roles";
import useDataList from "@/app/hooks/useDataList";
import useAppNotification from "@/app/hooks/useAppNotification";
import EmployeeForm from "./EmployeeForm";
import EmployeeImportModal from "./EmployeeImportModal";

const EMPLOYEE_STATUS = {
  active: ["Aktif", "success"],
  probation: ["Masa percobaan", "info"],
  leave: ["Cuti", "warning"],
  suspended: ["Ditangguhkan", "danger"],
  draft: ["Draft", "neutral"],
  terminated: ["Berakhir", "danger"],
  retired: ["Pensiun", "neutral"],
  deceased: ["Meninggal", "neutral"],
};

/** Direktori pegawai menjadi satu pintu masuk seluruh profil dan histori kepegawaian. */
export default function EmployeeDirectory() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAuthenticatedUser();
  const isSuperadmin = user.role_code === ROLES.SUPERADMIN;
  const readOnly = user.role_code === ROLES.LEADER;
  const list = useDataList("/api/employees", {
    requiredFilter: isSuperadmin ? "organizationId" : undefined,
  });
  const { startNavigationLoading } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const [form, setForm] = useState({ open: false, item: null });
  const [importOpen, setImportOpen] = useState(false);
  const organizationId = isSuperadmin ? list.filters.organizationId : String(user.organization_id);

  /** Membuka tab detail tertentu dan mempertahankan organisasi pilihan Superadmin. */
  const openDetail = (item, tab = "summary") => {
    startNavigationLoading({ message: "Membuka detail pegawai..." });
    const query = new URLSearchParams({ tab });
    if (organizationId) query.set("organizationId", organizationId);
    router.push(`/employees/${item.id}?${query.toString()}`);
  };

  /** Menyediakan satu pintu masuk agar seluruh riwayat dibuka dari workspace detail pegawai. */
  const actions = (item) => [
    {
      key: "summary",
      icon: <EyeOutlined />,
      label: "Lihat ringkasan",
      onClick: () => openDetail(item),
    },
  ];

  const columns = [
    {
      title: "Pegawai",
      key: "employee",
      render: (_, item) => (
        <Box sx={{ minWidth: 180 }}>
          <FontStyle fontSize={12.5} fontWeight={600}>
            {item.full_name}
          </FontStyle>
          <Box sx={{ mt: 0.75, display: "flex", gap: 0.75, flexWrap: "wrap" }}>
            <CompactInfoChip label={item.employee_no} tone="info" />
            {item.active_sanction_count > 0 ? (
              <CompactInfoChip label={`${item.active_sanction_count} sanksi aktif`} tone="danger" />
            ) : null}
          </Box>
        </Box>
      ),
    },
    ...(isSuperadmin ? [{ title: "Organisasi", dataIndex: "organization_name", width: 180 }] : []),
    {
      title: "Lokasi",
      dataIndex: "location_name",
      render: (value) => value || "Belum ditempatkan",
    },
    {
      title: "Divisi & Unit",
      dataIndex: "unit_name",
      render: (value) => value || "Belum ditentukan",
    },
    {
      title: "Jabatan",
      dataIndex: "position_name",
      render: (value) => value || "Belum ditentukan",
    },
    {
      title: "Status",
      dataIndex: "employment_status",
      render: (value) => (
        <CompactInfoChip
          label={EMPLOYEE_STATUS[value]?.[0] || value}
          tone={EMPLOYEE_STATUS[value]?.[1] || "neutral"}
        />
      ),
    },
    {
      title: "Aksi",
      key: "action",
      width: 72,
      render: (_, item) => <RowActionMenu items={actions(item)} />,
    },
  ];

  /** Card mobile mempertahankan hierarchy informasi tanpa tabel horizontal. */
  const renderCard = (item) => (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <FontStyle fontWeight={700}>{item.full_name}</FontStyle>
          <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
            {item.employee_no}
          </FontStyle>
        </Box>
        <RowActionMenu items={actions(item)} />
      </Box>
      <Box sx={{ mt: 1.5, display: "grid", gap: 0.5 }}>
        <FontStyle fontSize={12}>{item.location_name || "Belum ditempatkan"}</FontStyle>
        <FontStyle fontSize={12} sx={{ color: theme.ui.mutedText }}>
          {[item.unit_name, item.position_name].filter(Boolean).join(" · ") ||
            "Divisi dan jabatan belum ditentukan"}
        </FontStyle>
      </Box>
      <Box sx={{ mt: 1.25, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
        <CompactInfoChip
          label={EMPLOYEE_STATUS[item.employment_status]?.[0] || item.employment_status}
          tone={EMPLOYEE_STATUS[item.employment_status]?.[1] || "neutral"}
        />
        {item.active_sanction_count > 0 ? (
          <CompactInfoChip label={`${item.active_sanction_count} sanksi`} tone="danger" />
        ) : null}
      </Box>
    </Box>
  );

  /** Menutup modal dan menyegarkan daftar setelah transaksi selesai. */
  const saved = async (message) => {
    setForm({ open: false, item: null });
    setImportOpen(false);
    showNotification(message);
    await list.refresh();
  };

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="Data Pegawai"
        description="Kelola profil lengkap dan telusuri seluruh histori kepegawaian dari satu tempat."
        action={
          !readOnly ? (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button
                icon={<ImportOutlined />}
                onClick={() => setImportOpen(true)}
                disabled={!organizationId}
              >
                Import data
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setForm({ open: true, item: null })}
                disabled={!organizationId}
              >
                Tambah pegawai
              </Button>
            </Box>
          ) : null
        }
      />
      <DataPanel
        title="Daftar data pegawai"
        description="Cari pegawai, periksa status aktif, lalu buka detail untuk melihat histori lengkap."
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
                  onChange={(value) =>
                    list.updateFilters({ ...list.filters, organizationId: value })
                  }
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
          renderCard={renderCard}
          emptyDescription={
            isSuperadmin && !organizationId
              ? "Pilih organisasi untuk menampilkan data pegawai."
              : "Belum ada data pegawai."
          }
        />
      </DataPanel>
      {!readOnly ? (
        <EmployeeForm
          open={form.open}
          item={form.item}
          organizationId={organizationId}
          onClose={() => setForm({ open: false, item: null })}
          onSaved={saved}
          onError={(message) => showNotification(message, "error")}
        />
      ) : null}
      {!readOnly ? (
        <EmployeeImportModal
          open={importOpen}
          organizationId={organizationId}
          onClose={() => setImportOpen(false)}
          onCommitted={saved}
          onError={(message) => showNotification(message, "error")}
        />
      ) : null}
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
