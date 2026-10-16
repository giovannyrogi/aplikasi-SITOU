"use client";
import { useState } from "react";
import { Box, Skeleton } from "@mui/material";
import dayjs from "dayjs";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import AppIcon from "@/app/components/icons/AppIcon";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import ErrorState from "@/app/components/data-display/ErrorState";
import PhotoAvatar from "@/app/components/data-display/PhotoAvatar";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import FontStyle from "@/app/components/font-style/FontStyle";
import { EMPLOYEE_STATUS_PRESENTATION } from "@/app/components/employees/employeeStatus";
import useDashboardData from "./useDashboardData";

const date = (value) => value ? dayjs(value).format("D MMM YYYY") : "Belum tersedia";
function Facts({ values }) {
  return <Box sx={{ display: "grid", gap: 0 }}>{values.map(([label, value]) => <Box key={label} sx={{ minWidth: 0, py: 2, borderBottom: "1px solid", borderColor: "divider", "&:last-child": { borderBottom: 0 } }}>
    <FontStyle fontSize={12} sx={{ color: "text.secondary", mb: 1 }}>{label}</FontStyle>
    <FontStyle fontSize={14} fontWeight={600} sx={{ overflowWrap: "anywhere" }}>{value || "Belum tersedia"}</FontStyle>
  </Box>)}</Box>;
}
/** Judul panel dengan ikon membantu membedakan informasi kerja. */
function SectionTitle({ icon, children }) {
  return <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}><Box sx={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: 2, bgcolor: "action.selected", color: "primary.main" }}><AppIcon icon={icon} width={22} /></Box>{children}</Box>;
}
export default function EmployeeDashboard({ navigation }) {
  const { data, error, loading, retry } = useDashboardData("/api/dashboard/employee_self");
  const [preview, setPreview] = useState(null);
  return <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
    <PageHeader title="Dashboard Pegawai" description="Profil dan informasi kerja Anda." />
    {navigation}
    {error ? <ErrorState message={error.message} onRetry={retry} /> : loading ? <Skeleton variant="rounded" height={280} /> : data ? <>
      <DataPanel contentSx={{ p: { xs: 2, sm: 3 }, borderTop: "3px solid", borderColor: "primary.main" }}>
        <FontStyle component="h2" fontSize={12} fontWeight={600} sx={{ color: "text.secondary", mb: 2 }}>Profil saya</FontStyle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap", minWidth: 0 }}>
          <PhotoAvatar name={data.profile.name} photoUrl={data.profile.photoUrl} size={88} photoLabel="Pas foto" previewTitle="Pas foto saya" onPreview={setPreview} />
          <Box sx={{ minWidth: 0 }}><FontStyle fontSize={{ xs: 18, sm: 22 }} fontWeight={700} sx={{ overflowWrap: "anywhere" }}>{data.profile.name}</FontStyle>
            <FontStyle fontSize={13} sx={{ mt: 1, color: "text.secondary" }}>NIP: {data.profile.nip || "Belum tersedia"}</FontStyle></Box>
          <Box sx={{ ml: { sm: "auto" }, display: "flex", gap: 1, flexWrap: "wrap" }}>
            <CompactInfoChip label={EMPLOYEE_STATUS_PRESENTATION[data.employment.status]?.[0] || "Belum tersedia"} tone={data.employment.status === "active" ? "success" : "neutral"} />
            {data.employment.type ? <CompactInfoChip label={data.employment.type} tone="info" /> : null}
          </Box>
        </Box>
      </DataPanel>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "repeat(3,minmax(0,1fr))" }, gap: 3 }}>
        {data.assignment ? <DataPanel title={<SectionTitle icon="navigation:location">Penempatan saya</SectionTitle>} contentSx={{ px: 3, py: 0 }}><Facts values={[
          ["Jabatan", data.assignment.position], ["Lokasi", data.assignment.location], ["Divisi & Unit", data.assignment.unit],
        ]} /></DataPanel> : null}
        <DataPanel title={<SectionTitle icon="navigation:employees">Kepegawaian</SectionTitle>} contentSx={{ px: 3, py: 0 }}><Facts values={[
          ...(Object.hasOwn(data.employment, "type") ? [["Jenis Pegawai", data.employment.type]] : []),
          ["Status", EMPLOYEE_STATUS_PRESENTATION[data.employment.status]?.[0]], ["Tanggal bergabung", date(data.employment.joinedDate)],
          ["Masa kerja", data.employment.joinedDate ? `${data.employment.serviceYears} tahun ${data.employment.serviceMonths} bulan` : "Belum tersedia"],
        ]} /></DataPanel>
        {Object.hasOwn(data, "contract") ? <DataPanel title={<SectionTitle icon="navigation:expiring-contract">Kontrak saya</SectionTitle>} contentSx={{ px: 3, py: 0 }}>{data.contract ? <Facts values={[
          ["Tanggal mulai", date(data.contract.start)], ["Tanggal berakhir", data.contract.end ? date(data.contract.end) : "Tanpa tanggal akhir"],
          ["Status", ({ active: "Aktif", expired: "Berakhir", terminated: "Diakhiri", renewed: "Diperbarui" })[data.contract.status]],
        ]} /> : <FontStyle>Belum ada kontrak.</FontStyle>}</DataPanel> : null}
      </Box>
    </> : null}
    <ImagePreviewModal open={!!preview} imageUrl={preview?.imageUrl} alt={preview?.alt} title="Pas foto saya" onClose={() => setPreview(null)} />
  </Box>;
}
