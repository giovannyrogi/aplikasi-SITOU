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
import EmploymentTypeForm from "./EmploymentTypeForm";

/** Halaman CRUD jenis kepegawaian untuk master kontrak organisasi. */
export default function EmploymentTypesPage() {
  const user = useAuthenticatedUser();
  const isSuperadmin = user.role_code === ROLES.SUPERADMIN;
  const list = useDataList("/api/employment-types");
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
          const response = await fetch(`/api/employment-types/${confirm.id}`, {
            method: "DELETE",
          });
          const body = await readApiResponse(response);
          showNotification(body.message);
          await list.refresh();
        },
        { message: "Menonaktifkan jenis kepegawaian..." },
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
      title: "Jenis kepegawaian",
      key: "employmentType",
      render: (_, item) => (
        <Box>
          <FontStyle fontSize={14} fontWeight={600}>
            {item.name}
          </FontStyle>
        </Box>
      ),
    },
    ...(isSuperadmin ? [{ title: "Organisasi", dataIndex: "organization_name" }] : []),
    {
      title: "Tanggal akhir kontrak",
      dataIndex: "requires_end_date",
      render: (value) => (
        <CompactInfoChip
          wrap
          label={value ? "Wajib diisi" : "Tidak digunakan"}
          tone={value ? "warning" : "info"}
        />
      ),
    },
    {
      title: "Kontrak aktif & draft",
      dataIndex: "contract_count",
      render: (value) => <CompactInfoChip label={`${value} kontrak`} tone="info" />,
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
        title="Jenis Kepegawaian"
        description="Kelola istilah hubungan kerja dan aturan tanggal akhir kontrak organisasi."
        action={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setForm({ open: true, item: null })}
          >
            Tambah jenis kepegawaian
          </Button>
        }
      />
      <OperationalFilterSection
        title="Filter jenis kepegawaian"
        description="Cari dan saring daftar jenis kepegawaian sesuai kebutuhan."
        searchLabel="Cari jenis kepegawaian"
        searchPlaceholder="Nama jenis kepegawaian"
        statusLabel="Status jenis kepegawaian"
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
        title="Daftar jenis kepegawaian"
        description="Pilihan yang tersedia dapat digunakan ketika kontrak pegawai dibuat atau diperpanjang."
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
      <EmploymentTypeForm
        open={form.open}
        item={form.item}
        presetOrganizationId={organizationId}
        onClose={() => setForm({ open: false, item: null })}
        onSaved={saved}
        onError={(message) => showNotification(message, "error")}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title="Nonaktifkan jenis kepegawaian?"
        message={`Jenis ${confirm?.name || ""} tidak dapat dipilih untuk kontrak baru. Histori kontrak tetap disimpan.`}
        confirmText="Nonaktifkan"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={deactivate}
      />
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
