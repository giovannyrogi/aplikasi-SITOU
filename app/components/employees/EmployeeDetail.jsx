"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "antd";
import {
  BankOutlined,
  BookOutlined,
  ContactsOutlined,
  CloseCircleOutlined,
  EditOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  IdcardOutlined,
  KeyOutlined,
  MailOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
  TeamOutlined,
  UserOutlined,
  WhatsAppOutlined,
} from "@ant-design/icons";
import { Avatar, Box, Divider, useTheme } from "@mui/material";
import { usePathname, useSearchParams } from "next/navigation";
import PageHeader from "@/app/components/layout/PageHeader";
import DetailTabs from "@/app/components/navigation/DetailTabs";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import Notification from "@/app/components/Notifications/Notification";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { ROLES } from "@/app/constants/roles";
import useAppNotification from "@/app/hooks/useAppNotification";
import { AssignmentForm, ContractCancelForm, ContractForm } from "./EmployeeLifecycleForms";
import EmployeeProfileSectionsForm from "./EmployeeProfileSectionsForm";
import {
  EmployeeBankDetails,
  EmployeeCompetencyDetails,
  EmployeeRelatedSummary,
} from "./EmployeeProfileDetails";
import EmptyState from "@/app/components/data-display/EmptyState";
import {
  DisciplineCaseForm,
  DisciplinaryActionForm,
} from "@/app/components/discipline/DisciplineForms";

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

const CHANGE_TYPE_LABELS = {
  initial: "Penempatan awal",
  transfer: "Mutasi",
  rotation: "Rolling",
  promotion: "Promosi",
  demotion: "Demosi",
  correction: "Koreksi",
};

const CONTRACT_STATUS = {
  draft: ["Draft", "neutral"],
  active: ["Aktif", "success"],
  expired: ["Berakhir", "danger"],
  terminated: ["Dihentikan", "danger"],
  renewed: ["Diperpanjang", "info"],
  cancelled: ["Dibatalkan", "danger"],
};

const CASE_STATUS = {
  open: ["Terbuka", "warning"],
  investigating: ["Dalam pemeriksaan", "info"],
  closed_no_action: ["Ditutup tanpa tindakan", "neutral"],
  action_issued: ["Tindakan diterbitkan", "danger"],
};

const SEVERITY = {
  light: ["Ringan", "info"],
  moderate: ["Sedang", "warning"],
  severe: ["Berat", "danger"],
};

const ACTION_LABELS = {
  oral_warning: "Teguran lisan",
  sp1: "SP1",
  sp2: "SP2",
  sp3: "SP3",
  suspension: "Skorsing",
  salary_delay: "Penundaan gaji",
  promotion_delay: "Penundaan promosi",
  demotion: "Demosi",
  fine: "Denda",
  termination: "Pengakhiran hubungan kerja",
  other: "Tindakan lain",
};

const ACTION_STATUS = {
  draft: ["Draft", "neutral"],
  active: ["Aktif", "danger"],
  expired: ["Berakhir", "neutral"],
  revoked: ["Dicabut", "warning"],
  appealed: ["Dalam banding", "info"],
};

const VALID_TABS = [
  "summary",
  "assignments",
  "contracts",
  "documents",
  "competencies",
  "bank",
  "discipline",
  "account",
];

/** Memformat tanggal ISO menjadi Bahasa Indonesia tanpa mengubah timezone tanggal kalender. */
function formatDate(value, fallback = "Belum ditentukan") {
  if (!value) return fallback;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Menghasilkan dua huruf avatar dari nama pegawai. */
function getInitials(name) {
  return String(name || "P")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/** Label tab memakai ikon agar bagian lebih cepat dikenali. */
function TabLabel({ icon, children }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      {icon}
      <span>{children}</span>
    </Box>
  );
}

/** Header setiap tab menjaga judul, petunjuk, dan aksi pada posisi yang konsisten. */
function TabSectionHeader({ title, description, action }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: { xs: "stretch", sm: "center" },
        justifyContent: "space-between",
        flexDirection: { xs: "column", sm: "row" },
        gap: 2,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <FontStyle component="h2" fontSize={17} fontWeight={700}>
          {title}
        </FontStyle>
        <FontStyle fontSize={12.5} sx={{ mt: 0.5, color: theme.ui.mutedText, lineHeight: 1.6 }}>
          {description}
        </FontStyle>
      </Box>
      {action ? (
        <Box sx={{ flexShrink: 0, "& .ant-btn": { width: { xs: "100%", sm: "auto" } } }}>
          {action}
        </Box>
      ) : null}
    </Box>
  );
}

/** Field ringkasan membedakan label dan nilai serta menjaga teks panjang tetap terbaca. */
function InfoField({ label, value, icon }) {
  const theme = useTheme();
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: theme.ui.mutedText }}>
        {icon}
        <FontStyle fontSize={11.5} fontWeight={600}>
          {label}
        </FontStyle>
      </Box>
      <FontStyle
        fontSize={13}
        fontWeight={600}
        sx={{ mt: 0.65, lineHeight: 1.55, overflowWrap: "anywhere" }}
      >
        {value || "Belum ditentukan"}
      </FontStyle>
    </Box>
  );
}

/** Section ringkasan mengelompokkan data berdasarkan kebutuhan pengguna. */
function SummarySection({ icon, title, children }) {
  const theme = useTheme();
  return (
    <Box component="section">
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          pb: 1.25,
          borderBottom: `1px solid ${theme.ui.panelBorderSubtle}`,
        }}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            color: theme.palette.primary.main,
            bgcolor: theme.ui.panelAccentBg,
            borderRadius: "8px",
          }}
        >
          {icon}
        </Box>
        <FontStyle component="h3" fontSize={14} fontWeight={700}>
          {title}
        </FontStyle>
      </Box>
      <Box
        sx={{
          mt: 2,
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
          gap: 2.25,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

/** Detail pegawai menyatukan profil dan seluruh histori tanpa sumber kebenaran duplikat. */
export default function EmployeeDetail({ employeeId }) {
  const theme = useTheme();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useAuthenticatedUser();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const organizationId = searchParams.get("organizationId") || user.organization_id;
  const readOnly = user.role_code === ROLES.LEADER;
  const requestedTab = searchParams.get("tab");
  const initialTab =
    VALID_TABS.includes(requestedTab) && !(readOnly && ["account", "bank"].includes(requestedTab))
      ? requestedTab
      : "summary";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [state, setState] = useState({
    employee: null,
    history: { assignments: [], contracts: [] },
    discipline: [],
    documents: { checklist: [] },
    profile: {
      bankAccounts: [],
      dependents: [],
      emergencyContacts: [],
      socialAccounts: [],
      educations: [],
      skills: [],
      certifications: [],
    },
  });
  const [modal, setModal] = useState(null);
  const [actionCase, setActionCase] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);
  const [contractToCancel, setContractToCancel] = useState(null);

  /** Memuat seluruh bagian paralel agar perpindahan tab tidak menghasilkan request waterfall. */
  const load = useCallback(async () => {
    if (!organizationId) return;
    try {
      await runWithLoadingBackdrop(
        async () => {
          const query = `?organizationId=${organizationId}`;
          const responses = await Promise.all([
            fetch(`/api/employees/${employeeId}${query}`),
            fetch(`/api/employees/${employeeId}/history${query}`),
            fetch(`/api/employees/${employeeId}/discipline-history${query}`),
            fetch(`/api/employees/${employeeId}/documents${query}`),
            fetch(`/api/employees/${employeeId}/profile${query}`),
          ]);
          const bodies = await Promise.all(responses.map((response) => response.json()));
          const failedIndex = responses.findIndex((response) => !response.ok);
          if (failedIndex >= 0) throw new Error(bodies[failedIndex].message);
          setState({
            employee: bodies[0].data,
            history: bodies[1].data || { assignments: [], contracts: [] },
            discipline: bodies[2].data || [],
            documents: bodies[3].data || { checklist: [] },
            profile: bodies[4].data || {},
          });
        },
        { message: "Memuat detail pegawai..." },
      );
    } catch (error) {
      showNotification(error.message, "error");
    }
  }, [employeeId, organizationId, runWithLoadingBackdrop, showNotification]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Menyelaraskan tab dari histori browser tanpa memicu request halaman baru. */
  useEffect(() => {
    const syncFromHistory = () => {
      const tab = new URLSearchParams(window.location.search).get("tab");
      setActiveTab(
        VALID_TABS.includes(tab) && !(readOnly && ["account", "bank"].includes(tab))
          ? tab
          : "summary",
      );
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, [readOnly]);

  /** Mengubah URL tab tanpa memicu request halaman atau loading global. */
  const changeTab = (nextTab) => {
    setActiveTab(nextTab);
    const query = new URLSearchParams(searchParams.toString());
    query.set("tab", nextTab);
    window.history.pushState(null, "", `${pathname}?${query.toString()}`);
  };

  if (!state.employee) return <Notification {...notification} onClose={closeNotification} />;
  const employee = state.employee;

  const contentSx = { p: { xs: 2, sm: 2.5, lg: 3 }, minWidth: 0 };

  const tabItems = [
    {
      key: "summary",
      label: <TabLabel icon={<UserOutlined />}>Ringkasan</TabLabel>,
      children: (
        <Box sx={contentSx}>
          <TabSectionHeader
            title="Ringkasan pegawai"
            description="Informasi utama yang paling sering dibutuhkan untuk mengenali status dan penempatan pegawai."
            action={
              !readOnly ? (
                <Button type="primary" icon={<EditOutlined />} onClick={() => setModal("profile")}>
                  Kelola profil lengkap
                </Button>
              ) : null
            }
          />
          <Divider sx={{ my: 3, borderColor: theme.ui.panelBorderSubtle }} />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" },
              columnGap: 4,
              rowGap: 3.5,
            }}
          >
            <SummarySection icon={<IdcardOutlined />} title="Informasi pribadi">
              <InfoField label="Nomor pegawai" value={employee.employee_no} />
              <InfoField label="NIK" value={employee.national_id} />
              <InfoField label="Tempat lahir" value={employee.birth_place} />
              <InfoField label="Tanggal lahir" value={formatDate(employee.birth_date)} />
            </SummarySection>
            <SummarySection icon={<ContactsOutlined />} title="Kontak">
              <InfoField
                label="Email pribadi"
                value={employee.personal_email}
                icon={<MailOutlined />}
              />
              <InfoField
                label="Nomor WhatsApp"
                value={employee.whatsapp}
                icon={<WhatsAppOutlined />}
              />
              <InfoField label="Alamat sesuai KTP" value={employee.ktp_address} />
              <InfoField label="Alamat domisili" value={employee.domicile_address} />
            </SummarySection>
            <SummarySection icon={<EnvironmentOutlined />} title="Penempatan aktif">
              <InfoField label="Lokasi" value={employee.location_name} />
              <InfoField label="Divisi & Unit" value={employee.unit_name} />
              <InfoField label="Jabatan" value={employee.position_name} />
              <InfoField label="Atasan langsung" value={employee.supervisor_name} />
            </SummarySection>
            <SummarySection icon={<FileTextOutlined />} title="Hubungan kerja">
              <InfoField label="Jenis kepegawaian" value={employee.employment_type_name} />
              <InfoField label="Nomor kontrak" value={employee.contract_no} />
              <InfoField label="Tanggal bergabung" value={formatDate(employee.joined_date)} />
              <InfoField
                label="Akhir kontrak"
                value={formatDate(employee.contract_end_date, "Tanpa batas akhir")}
              />
            </SummarySection>
          </Box>
          <EmployeeRelatedSummary profile={state.profile} />
        </Box>
      ),
    },
    {
      key: "assignments",
      label: <TabLabel icon={<SwapOutlined />}>Penempatan</TabLabel>,
      children: (
        <Box sx={contentSx}>
          <TabSectionHeader
            title="Histori penempatan"
            description="Telusuri lokasi, Divisi & Unit, jabatan, serta perubahan penempatan dari waktu ke waktu."
            action={
              !readOnly ? (
                <Button
                  type="primary"
                  icon={<SwapOutlined />}
                  onClick={() => setModal("assignment")}
                >
                  Penempatan baru
                </Button>
              ) : null
            }
          />
          <Divider sx={{ my: 3, borderColor: theme.ui.panelBorderSubtle }} />
          {state.history.assignments.length ? (
            <Box component="ol" sx={{ m: 0, p: 0, listStyle: "none", display: "grid" }}>
              {state.history.assignments.map((item, index) => {
                const active = !item.effective_until;
                return (
                  <Box
                    component="li"
                    key={item.id}
                    sx={{
                      position: "relative",
                      display: "grid",
                      gridTemplateColumns: "24px minmax(0, 1fr)",
                      gap: 1.5,
                      pb: index === state.history.assignments.length - 1 ? 0 : 3,
                      "&::after":
                        index === state.history.assignments.length - 1
                          ? undefined
                          : {
                              content: '""',
                              position: "absolute",
                              top: 20,
                              bottom: 0,
                              left: 7,
                              width: 2,
                              bgcolor: theme.ui.panelBorder,
                            },
                    }}
                  >
                    <Box
                      sx={{
                        zIndex: 1,
                        width: 16,
                        height: 16,
                        mt: 0.4,
                        borderRadius: "50%",
                        bgcolor: active ? theme.palette.primary.main : theme.ui.panelBg,
                        border: `3px solid ${active ? theme.ui.panelAccentBg : theme.ui.panelBorder}`,
                      }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <FontStyle fontSize={13.5} fontWeight={700}>
                          {item.position_name || "Jabatan belum ditentukan"}
                        </FontStyle>
                        <CompactInfoChip
                          label={active ? "Penempatan aktif" : CHANGE_TYPE_LABELS[item.change_type]}
                          tone={active ? "success" : "info"}
                        />
                      </Box>
                      <FontStyle fontSize={12.5} sx={{ mt: 0.75 }}>
                        {item.unit_name} · {item.location_name}
                      </FontStyle>
                      <FontStyle fontSize={11.5} sx={{ mt: 0.5, color: theme.ui.mutedText }}>
                        {formatDate(item.effective_from)} sampai{" "}
                        {formatDate(item.effective_until, "sekarang")}
                        {item.supervisor_name ? ` · Atasan: ${item.supervisor_name}` : ""}
                      </FontStyle>
                      {item.document_file_id ? (
                        <Button
                          size="small"
                          icon={<FileTextOutlined />}
                          href={`/api/uploads/${item.document_file_id}?organizationId=${organizationId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ marginTop: 8 }}
                        >
                          Dokumen SK
                        </Button>
                      ) : null}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <EmptyState description="Belum ada penempatan yang tercatat untuk pegawai ini." />
          )}
        </Box>
      ),
    },
    {
      key: "contracts",
      label: <TabLabel icon={<FileTextOutlined />}>Kontrak</TabLabel>,
      children: (
        <Box sx={contentSx}>
          <TabSectionHeader
            title="Histori kontrak kerja"
            description="Lihat hubungan kerja aktif dan riwayat perpanjangan tanpa menimpa kontrak sebelumnya."
            action={
              !readOnly ? (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setSelectedContract(null);
                    setModal("contract");
                  }}
                >
                  Kontrak baru
                </Button>
              ) : null
            }
          />
          <Divider sx={{ my: 3, borderColor: theme.ui.panelBorderSubtle }} />
          {state.history.contracts.length ? (
            <Box sx={{ display: "grid" }}>
              {state.history.contracts.map((item, index) => (
                <Box
                  key={item.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "180px minmax(0, 1fr)" },
                    gap: { xs: 1, sm: 2.5 },
                    py: 2,
                    borderTop: index === 0 ? "none" : `1px solid ${theme.ui.panelBorderSubtle}`,
                  }}
                >
                  <Box>
                    <FontStyle fontSize={12} fontWeight={600} sx={{ color: theme.ui.mutedText }}>
                      {formatDate(item.start_date)}
                    </FontStyle>
                    <FontStyle fontSize={11.5} sx={{ mt: 0.35, color: theme.ui.mutedText }}>
                      sampai {formatDate(item.end_date, "tanpa batas akhir")}
                    </FontStyle>
                  </Box>
                  <Box
                    sx={{
                      minWidth: 0,
                      display: "flex",
                      alignItems: { xs: "flex-start", md: "center" },
                      justifyContent: "space-between",
                      flexDirection: { xs: "column", md: "row" },
                      gap: 1.5,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <FontStyle fontSize={13.5} fontWeight={700}>
                          {item.employment_type_name}
                        </FontStyle>
                        <CompactInfoChip
                          label={CONTRACT_STATUS[item.status]?.[0] || "Status belum dikenali"}
                          tone={CONTRACT_STATUS[item.status]?.[1] || "neutral"}
                        />
                      </Box>
                      <FontStyle fontSize={12} sx={{ mt: 0.65, color: theme.ui.mutedText }}>
                        Nomor kontrak: {item.contract_no || "Belum dicatat"}
                      </FontStyle>
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", flexShrink: 0 }}>
                      {item.document_file_id ? (
                        <Button
                          size="small"
                          icon={<FileTextOutlined />}
                          href={`/api/uploads/${item.document_file_id}?organizationId=${organizationId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Dokumen kontrak
                        </Button>
                      ) : null}
                      {!readOnly && item.status !== "cancelled" ? (
                        <>
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => {
                              setSelectedContract(item);
                              setModal("contractEdit");
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            danger
                            icon={<CloseCircleOutlined />}
                            onClick={() => setContractToCancel(item)}
                          >
                            Batalkan
                          </Button>
                        </>
                      ) : null}
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <EmptyState description="Belum ada kontrak kerja yang tercatat untuk pegawai ini." />
          )}
        </Box>
      ),
    },
    {
      key: "documents",
      label: <TabLabel icon={<FolderOpenOutlined />}>Dokumen</TabLabel>,
      children: (
        <Box sx={contentSx}>
          <TabSectionHeader
            title="Kelengkapan dokumen pegawai"
            description="Ringkasan dokumen yang sudah tersedia. Dokumen dikelola dari profil, kontrak, penempatan, atau kompetensi sesuai konteksnya."
          />
          <Box
            component="ul"
            aria-label="Kelengkapan dokumen pegawai"
            sx={{
              m: 0,
              mt: 3,
              p: 0,
              listStyle: "none",
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
              borderTop: `1px solid ${theme.ui.panelBorderSubtle}`,
            }}
          >
            {state.documents.checklist.map((item) => {
              const available = item.status === "available";
              return (
                <Box
                  component="li"
                  key={item.kind}
                  sx={{
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    py: 2,
                    pr: { xs: 0, md: 2 },
                    borderBottom: `1px solid ${theme.ui.panelBorderSubtle}`,
                    "&:nth-of-type(even)": { pl: { xs: 0, md: 2 } },
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      color: available ? theme.status.success.main : theme.ui.mutedText,
                      bgcolor: available ? theme.status.success.background : theme.ui.panelSubtleBg,
                      borderRadius: "8px",
                    }}
                  >
                    <FileTextOutlined />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <FontStyle fontSize={12.5} fontWeight={700}>
                      {item.label}
                    </FontStyle>
                    <Box sx={{ mt: 0.55, display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                      <CompactInfoChip
                        label={available ? "Tersedia" : "Belum dilengkapi"}
                        tone={available ? "success" : "neutral"}
                      />
                      {item.count > 1 ? (
                        <CompactInfoChip label={`${item.count} dokumen`} tone="info" />
                      ) : null}
                    </Box>
                    {item.latestUploadedAt ? (
                      <FontStyle fontSize={11} sx={{ mt: 0.5, color: theme.ui.mutedText }}>
                        Terakhir diperbarui {formatDate(item.latestUploadedAt)}
                      </FontStyle>
                    ) : null}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      ),
    },
    {
      key: "competencies",
      label: <TabLabel icon={<BookOutlined />}>Kompetensi</TabLabel>,
      children: (
        <Box sx={contentSx}>
          <TabSectionHeader
            title="Pendidikan dan kompetensi"
            description="Lihat riwayat pendidikan, keahlian, serta sertifikasi pegawai dalam satu bagian."
          />
          <Divider sx={{ my: 3, borderColor: theme.ui.panelBorderSubtle }} />
          <EmployeeCompetencyDetails profile={state.profile} organizationId={organizationId} />
        </Box>
      ),
    },
    ...(!readOnly
      ? [
          {
            key: "bank",
            label: <TabLabel icon={<BankOutlined />}>Rekening</TabLabel>,
            children: (
              <Box sx={contentSx}>
                <TabSectionHeader
                  title="Informasi rekening"
                  description="Data rekening bersifat sensitif dan hanya tersedia bagi HRD serta Superadmin."
                />
                <Divider sx={{ my: 3, borderColor: theme.ui.panelBorderSubtle }} />
                <EmployeeBankDetails profile={state.profile} />
              </Box>
            ),
          },
        ]
      : []),
    {
      key: "discipline",
      label: <TabLabel icon={<SafetyCertificateOutlined />}>Disiplin</TabLabel>,
      children: (
        <Box sx={contentSx}>
          <TabSectionHeader
            title="Disiplin dan sanksi"
            description="Kasus dicatat untuk pemeriksaan HRD. Sistem tidak menerbitkan sanksi secara otomatis."
            action={
              !readOnly ? (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setModal("disciplineCase")}
                >
                  Catat kasus
                </Button>
              ) : null
            }
          />
          <Divider sx={{ my: 3, borderColor: theme.ui.panelBorderSubtle }} />
          {state.discipline.length ? (
            <Box sx={{ display: "grid", gap: 2 }}>
              {state.discipline.map((disciplineCase) => (
                <Box
                  component="article"
                  key={disciplineCase.id}
                  sx={{
                    p: { xs: 2, sm: 2.5 },
                    bgcolor: theme.ui.panelSubtleBg,
                    border: `1px solid ${theme.ui.panelBorderSubtle}`,
                    borderRadius: "8px",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                      flexDirection: { xs: "column", sm: "row" },
                      gap: 1.5,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <FontStyle fontSize={13.5} fontWeight={700}>
                        {disciplineCase.case_no}
                      </FontStyle>
                      <FontStyle fontSize={11.5} sx={{ mt: 0.4, color: theme.ui.mutedText }}>
                        Kejadian {formatDate(disciplineCase.incident_date)}
                      </FontStyle>
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                      <CompactInfoChip
                        label={SEVERITY[disciplineCase.severity]?.[0]}
                        tone={SEVERITY[disciplineCase.severity]?.[1]}
                      />
                      <CompactInfoChip
                        label={CASE_STATUS[disciplineCase.status]?.[0] || disciplineCase.status}
                        tone={CASE_STATUS[disciplineCase.status]?.[1] || "neutral"}
                      />
                    </Box>
                  </Box>
                  <FontStyle fontSize={12.5} sx={{ mt: 1.5, lineHeight: 1.65 }}>
                    {disciplineCase.description}
                  </FontStyle>
                  {disciplineCase.actions.length ? (
                    <Box sx={{ mt: 2, display: "grid", gap: 1 }}>
                      {disciplineCase.actions.map((action) => (
                        <Box
                          key={action.id}
                          sx={{
                            display: "flex",
                            alignItems: { xs: "flex-start", sm: "center" },
                            justifyContent: "space-between",
                            flexDirection: { xs: "column", sm: "row" },
                            gap: 1,
                            py: 1.25,
                            borderTop: `1px solid ${theme.ui.panelBorder}`,
                          }}
                        >
                          <Box>
                            <FontStyle fontSize={12.5} fontWeight={700}>
                              {ACTION_LABELS[action.action_type] || action.action_type}
                            </FontStyle>
                            <FontStyle fontSize={11.5} sx={{ mt: 0.35, color: theme.ui.mutedText }}>
                              Terbit {formatDate(action.issued_date)} · Berlaku{" "}
                              {formatDate(action.effective_from)} sampai{" "}
                              {formatDate(action.effective_until, "selesai sesuai keputusan")}
                            </FontStyle>
                          </Box>
                          <CompactInfoChip
                            label={ACTION_STATUS[action.status]?.[0] || "Status belum dikenali"}
                            tone={ACTION_STATUS[action.status]?.[1] || "neutral"}
                          />
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <FontStyle fontSize={11.5} sx={{ mt: 1.5, color: theme.ui.mutedText }}>
                      Belum ada tindakan yang diterbitkan untuk kasus ini.
                    </FontStyle>
                  )}
                  {!readOnly && disciplineCase.status !== "closed_no_action" ? (
                    <Button
                      type="link"
                      icon={<FileTextOutlined />}
                      onClick={() => setActionCase(disciplineCase)}
                      style={{ marginTop: 12, paddingInline: 0 }}
                    >
                      Tetapkan tindakan
                    </Button>
                  ) : null}
                </Box>
              ))}
            </Box>
          ) : (
            <EmptyState description="Belum ada kasus disiplin yang tercatat untuk pegawai ini." />
          )}
        </Box>
      ),
    },
    ...(!readOnly
      ? [
          {
            key: "account",
            label: <TabLabel icon={<KeyOutlined />}>Akun</TabLabel>,
            children: (
              <Box sx={contentSx}>
                <TabSectionHeader
                  title="Keterkaitan akun"
                  description="Akun, role, password, dan cakupan akses dikelola melalui menu Akun & Akses."
                />
                <Divider sx={{ my: 3, borderColor: theme.ui.panelBorderSubtle }} />
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
                  <CompactInfoChip
                    label={employee.user_id ? "Sudah memiliki akun" : "Belum memiliki akun"}
                    tone={employee.user_id ? "success" : "neutral"}
                  />
                  <FontStyle fontSize={12.5} sx={{ color: theme.ui.mutedText }}>
                    {employee.user_id
                      ? "Profil pegawai telah terhubung dengan akun login."
                      : "Profil ini belum dihubungkan dengan akun login organisasi."}
                  </FontStyle>
                </Box>
              </Box>
            ),
          },
        ]
      : []),
  ];

  const profilePhotoUrl = employee.profile_photo_file_id
    ? `/api/uploads/${employee.profile_photo_file_id}?organizationId=${organizationId}`
    : undefined;
  const status = EMPLOYEE_STATUS[employee.employment_status] || [
    employee.employment_status,
    "neutral",
  ];

  return (
    <Box sx={{ width: "100%", minWidth: 0, maxWidth: "100%", display: "grid", gap: 3 }}>
      <PageHeader
        title={employee.full_name}
        description={`${employee.employee_no} · ${employee.organization_name}`}
        leading={
          <Avatar
            src={profilePhotoUrl}
            alt={`Pas foto ${employee.full_name}`}
            sx={{
              width: { xs: 54, sm: 68 },
              height: { xs: 54, sm: 68 },
              bgcolor: theme.ui.panelAccentBg,
              color: theme.palette.primary.main,
              border: `2px solid ${theme.ui.panelBorderSubtle}`,
              fontSize: { xs: 17, sm: 21 },
              fontWeight: 700,
            }}
          >
            {getInitials(employee.full_name)}
          </Avatar>
        }
        metadata={
          <>
            <CompactInfoChip label={status[0]} tone={status[1]} />
            <CompactInfoChip
              icon={<EnvironmentOutlined />}
              label={employee.location_name || "Belum ditempatkan"}
              tone="info"
            />
            {employee.position_name ? (
              <CompactInfoChip
                icon={<TeamOutlined />}
                label={employee.position_name}
                tone="neutral"
              />
            ) : null}
          </>
        }
      />
      <DetailTabs items={tabItems} activeKey={activeTab} onChange={changeTab} />
      {!readOnly ? (
        <AssignmentForm
          open={modal === "assignment"}
          employee={employee}
          onClose={() => setModal(null)}
          onSaved={async (message) => {
            setModal(null);
            showNotification(message);
            await load();
          }}
          onError={(message) => showNotification(message, "error")}
        />
      ) : null}
      {!readOnly ? (
        <ContractForm
          open={modal === "contract" || modal === "contractEdit"}
          employee={employee}
          contract={modal === "contractEdit" ? selectedContract : null}
          onClose={() => {
            setModal(null);
            setSelectedContract(null);
          }}
          onSaved={async (message) => {
            setModal(null);
            setSelectedContract(null);
            showNotification(message);
            await load();
          }}
          onError={(message) => showNotification(message, "error")}
        />
      ) : null}
      {!readOnly && contractToCancel ? (
        <ContractCancelForm
          open
          employee={employee}
          contract={contractToCancel}
          onClose={() => setContractToCancel(null)}
          onSaved={async (message) => {
            setContractToCancel(null);
            showNotification(message);
            await load();
          }}
          onError={(message) => showNotification(message, "error")}
        />
      ) : null}
      {!readOnly ? (
        <EmployeeProfileSectionsForm
          open={modal === "profile"}
          employee={employee}
          organizationId={organizationId}
          onClose={() => setModal(null)}
          onSaved={async (message) => {
            setModal(null);
            showNotification(message);
            await load();
          }}
          onError={(message) => showNotification(message, "error")}
        />
      ) : null}
      {!readOnly ? (
        <DisciplineCaseForm
          open={modal === "disciplineCase"}
          organizationId={organizationId}
          employee={employee}
          onClose={() => setModal(null)}
          onSaved={async (message) => {
            setModal(null);
            showNotification(message);
            await load();
          }}
          onError={(message) => showNotification(message, "error")}
        />
      ) : null}
      {!readOnly && actionCase ? (
        <DisciplinaryActionForm
          open
          disciplineCase={{
            ...actionCase,
            employee_id: employee.id,
            organization_id: organizationId,
          }}
          onClose={() => setActionCase(null)}
          onSaved={async (message) => {
            setActionCase(null);
            showNotification(message);
            await load();
          }}
          onError={(message) => showNotification(message, "error")}
        />
      ) : null}
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
