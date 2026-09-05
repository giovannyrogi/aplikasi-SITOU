"use client";

import { useEffect, useState } from "react";
import { Button, Input, Select } from "antd";
import {
  EditOutlined,
  EyeOutlined,
  ImportOutlined,
  PlusOutlined,
  SearchOutlined,
  UserDeleteOutlined,
} from "@ant-design/icons";
import { Box, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useRouter } from "next/navigation";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import OperationalFilterSection from "@/app/components/filters/OperationalFilterSection";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import RowActionMenu from "@/app/components/actions/RowActionMenu";
import Notification from "@/app/components/Notifications/Notification";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import FontStyle from "@/app/components/font-style/FontStyle";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import LocationSelect from "@/app/components/selects/LocationSelect";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { ROLES } from "@/app/constants/roles";
import useDataList from "@/app/hooks/useDataList";
import useAppNotification from "@/app/hooks/useAppNotification";
import { readApiResponse } from "@/lib/api/clientError";
import EmployeeAvatar from "./EmployeeAvatar";
import EmployeeForm from "./EmployeeForm";
import EmployeeImportModal from "./EmployeeImportModal";
import EmployeeTerminationForm from "./EmployeeTerminationForm";
import { getEmployeeStatusPresentation, isFinalEmploymentStatus } from "./employeeStatus";

/** Direktori pegawai menjadi satu pintu masuk seluruh profil dan histori kepegawaian. */
export default function EmployeeDirectory() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAuthenticatedUser();
  const isSuperadmin = user.role_code === ROLES.SUPERADMIN;
  const readOnly = user.role_code === ROLES.LEADER;
  const list = useDataList("/api/employees", {
    requiredFilter: isSuperadmin ? "organizationId" : undefined,
    initialFilters: !isSuperadmin ? { organizationId: String(user.organization_id) } : {},
  });
  const { startNavigationLoading } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const [form, setForm] = useState({ open: false, item: null });
  const [terminationEmployee, setTerminationEmployee] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [references, setReferences] = useState({
    locations: [],
    organizationUnits: [],
    positions: [],
    employmentTypes: [],
  });
  const organizationId = isSuperadmin ? list.filters.organizationId : String(user.organization_id);

  useEffect(() => {
    if (!organizationId) {
      Promise.resolve().then(() =>
        setReferences({ locations: [], organizationUnits: [], positions: [], employmentTypes: [] }),
      );
      return;
    }
    const controller = new AbortController();
    fetch(`/api/employees/reference-options?organizationId=${organizationId}`, {
      signal: controller.signal,
    })
      .then(readApiResponse)
      .then((body) =>
        setReferences({
          locations: body.data?.locations || [],
          organizationUnits: body.data?.organizationUnits || [],
          positions: body.data?.positions || [],
          employmentTypes: body.data?.employmentTypes || [],
        }),
      )
      .catch((error) => {
        if (error.name !== "AbortError") showNotification(error.message, "error");
      });
    return () => controller.abort();
  }, [organizationId, showNotification]);

  const updateFilter = (key, value) =>
    list.updateFilters({ ...list.filters, [key]: value || undefined });
  const resetFilters = () => {
    list.setSearch("");
    list.updateFilters(
      isSuperadmin ? { organizationId } : { organizationId: String(user.organization_id) },
    );
  };
  const filterItems = [
    ...(isSuperadmin
      ? [
          {
            key: "organizationId",
            label: "Organisasi",
            gridColumn: { xs: "auto", xl: "1 / -1" },
            control: (
              <OrganizationSelect
                autoSelectFirst
                value={organizationId}
                onChange={(value) => {
                  list.setSearch("");
                  list.updateFilters({ organizationId: value });
                }}
              />
            ),
          },
        ]
      : []),
    {
      key: "search",
      label: "Cari pegawai",
      control: (
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Nama atau NIP"
          value={list.search}
          onChange={(event) => list.setSearch(event.target.value)}
          aria-label="Cari pegawai berdasarkan nama atau NIP"
        />
      ),
    },
    {
      key: "locationId",
      label: "Lokasi",
      control: (
        <LocationSelect
          allowClear
          placeholder="Semua lokasi"
          organizationId={organizationId}
          options={references.locations}
          value={list.filters.locationId}
          onChange={(value) => updateFilter("locationId", value)}
        />
      ),
    },
    {
      key: "organizationUnitId",
      label: "Divisi & Unit",
      control: (
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Semua Divisi & Unit"
          value={list.filters.organizationUnitId}
          onChange={(value) => updateFilter("organizationUnitId", value)}
          options={references.organizationUnits.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
      ),
    },
    {
      key: "positionId",
      label: "Jabatan",
      control: (
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Semua jabatan"
          value={list.filters.positionId}
          onChange={(value) => updateFilter("positionId", value)}
          options={references.positions.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
      ),
    },
    {
      key: "employmentTypeId",
      label: "Jenis kepegawaian/kontrak",
      control: (
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Semua jenis"
          value={list.filters.employmentTypeId}
          onChange={(value) => updateFilter("employmentTypeId", value)}
          options={references.employmentTypes.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
      ),
    },
    {
      key: "employmentStatus",
      label: "Status pegawai",
      control: (
        <Select
          value={list.filters.employmentStatus || "all"}
          onChange={(value) => updateFilter("employmentStatus", value)}
          options={[
            { value: "all", label: "Semua status" },
            { value: "active", label: "Aktif" },
            { value: "probation", label: "Masa percobaan" },
            { value: "suspended", label: "Ditangguhkan" },
            { value: "terminated", label: "Diberhentikan" },
            { value: "retired", label: "Pensiun" },
            { value: "deceased", label: "Meninggal dunia" },
          ]}
          style={{ width: "100%" }}
        />
      ),
    },
  ];

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
    ...(!readOnly && !isFinalEmploymentStatus(item.employment_status)
      ? [
          {
            key: "edit",
            icon: <EditOutlined />,
            label: "Edit data pegawai",
            onClick: () => setForm({ open: true, item }),
          },
          {
            key: "terminate",
            icon: <UserDeleteOutlined />,
            label: "Akhiri hubungan kerja",
            danger: true,
            onClick: () => setTerminationEmployee(item),
          },
        ]
      : []),
  ];

  /** Menjaga nilai tabel tetap ringkas tanpa menyembunyikan teks lengkap dari pengguna. */
  const renderTableText = (value, emptyValue = "-") => {
    const label = value || emptyValue;
    return (
      <FontStyle
        title={label}
        fontSize={12}
        sx={{
          display: "block",
          maxWidth: "100%",
          overflow: "hidden",
          color: value ? theme.palette.text.primary : theme.ui.mutedText,
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </FontStyle>
    );
  };

  const columns = [
    {
      title: "Pegawai",
      key: "employee",
      width: 270,
      render: (_, item) => (
        <Box sx={{ display: "flex", alignItems: "center", minWidth: 0, gap: 1.5 }}>
          <EmployeeAvatar employee={item} onPreview={setPhotoPreview} />
          <Box sx={{ minWidth: 0 }}>
            <FontStyle
              title={item.full_name}
              fontSize={12.5}
              fontWeight={700}
              sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {item.full_name}
            </FontStyle>
            <FontStyle
              title={item.employee_no}
              fontSize={11.5}
              sx={{
                mt: 0.25,
                overflow: "hidden",
                color: theme.ui.mutedText,
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.employee_no || "-"}
            </FontStyle>
            {item.active_sanction_count > 0 ? (
              <Box sx={{ mt: 0.65 }}>
                <CompactInfoChip
                  label={item.active_sanction_count + " sanksi aktif"}
                  tone="danger"
                />
              </Box>
            ) : null}
          </Box>
        </Box>
      ),
    },
    ...(isSuperadmin
      ? [
          {
            title: "Organisasi",
            dataIndex: "organization_name",
            width: 190,
            render: (value) => renderTableText(value),
          },
        ]
      : []),
    {
      title: "Lokasi",
      dataIndex: "location_name",
      width: 190,
      render: (value) => renderTableText(value, "Belum ditempatkan"),
    },
    {
      title: "Divisi & Unit",
      dataIndex: "unit_name",
      width: 230,
      render: (value) => renderTableText(value, "Belum ditentukan"),
    },
    {
      title: "Jabatan",
      dataIndex: "position_name",
      width: 190,
      render: (value) => renderTableText(value, "Belum ditentukan"),
    },
    {
      title: "Jenis kepegawaian",
      dataIndex: "employment_type_name",
      width: 180,
      render: (value) => <CompactInfoChip label={value || "-"} tone="neutral" />,
    },
    {
      title: "Status",
      dataIndex: "employment_status",
      width: 128,
      align: "center",
      render: (value) => {
        const status = getEmployeeStatusPresentation(value);
        return <CompactInfoChip label={status[0]} tone={status[1]} />;
      },
    },
    {
      title: "Aksi",
      key: "action",
      width: 76,
      align: "center",
      fixed: "right",
      render: (_, item) => <RowActionMenu items={actions(item)} />,
    },
  ];

  /** Card mobile mempertahankan hierarki informasi tanpa tabel horizontal. */
  const renderCard = (item) => {
    const status = getEmployeeStatusPresentation(item.employment_status);
    return (
      <Box>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
          <EmployeeAvatar employee={item} size={46} onPreview={setPhotoPreview} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <FontStyle
              title={item.full_name}
              fontWeight={700}
              sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {item.full_name}
            </FontStyle>
            <FontStyle
              title={item.employee_no}
              fontSize={11.5}
              sx={{
                mt: 0.25,
                overflow: "hidden",
                color: theme.ui.mutedText,
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.employee_no || "-"}
            </FontStyle>
          </Box>
          <RowActionMenu items={actions(item)} />
        </Box>

        <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          <CompactInfoChip label={status[0]} tone={status[1]} />
          <CompactInfoChip label={item.employment_type_name || "-"} tone="neutral" />
          {item.active_sanction_count > 0 ? (
            <CompactInfoChip label={item.active_sanction_count + " sanksi aktif"} tone="danger" />
          ) : null}
        </Box>

        <Box
          sx={{
            mt: 1.5,
            display: "grid",
            gap: 0.75,
            pt: 1.5,
            borderTop: "1px solid " + theme.ui.panelBorderSubtle,
          }}
        >
          {[
            ["Lokasi", item.location_name],
            ["Divisi & Unit", item.unit_name],
            ["Jabatan", item.position_name],
          ].map(([label, value]) => (
            <Box
              key={label}
              sx={{ display: "grid", gridTemplateColumns: "112px minmax(0, 1fr)", gap: 1 }}
            >
              <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
                {label}
              </FontStyle>
              <FontStyle
                title={value || "-"}
                fontSize={11.5}
                fontWeight={600}
                sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {value || "-"}
              </FontStyle>
            </Box>
          ))}
        </Box>
      </Box>
    );
  };

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
      <OperationalFilterSection
        title="Filter data pegawai"
        description="Cari pegawai atau persempit daftar berdasarkan penempatan, jenis kepegawaian/kontrak, dan status pegawai."
        items={filterItems}
        onReset={resetFilters}
        wideColumns={6}
      />
      <DataPanel
        title="Daftar data pegawai"
        description="Hasil mengikuti pencarian dan filter yang dipilih di atas."
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
          scrollX={isSuperadmin ? 1450 : 1260}
          emptyDescription={
            isSuperadmin && !organizationId
              ? "Pilih organisasi untuk menampilkan data pegawai."
              : "Tidak ada data pegawai yang sesuai dengan filter yang dipilih."
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
      {!readOnly ? (
        <EmployeeTerminationForm
          open={Boolean(terminationEmployee)}
          employee={terminationEmployee}
          organizationId={organizationId}
          onClose={() => setTerminationEmployee(null)}
          onSaved={async (message) => {
            setTerminationEmployee(null);
            showNotification(message);
            await list.refresh();
          }}
          onError={(message) => showNotification(message, "error")}
        />
      ) : null}
      <ImagePreviewModal
        open={Boolean(photoPreview)}
        onClose={() => setPhotoPreview(null)}
        imageUrl={photoPreview?.imageUrl}
        alt={photoPreview?.alt}
        title={photoPreview?.title}
      />{" "}
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
