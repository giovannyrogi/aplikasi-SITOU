"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "antd";
import {
  BankOutlined,
  BookOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  ContactsOutlined,
  CloseCircleOutlined,
  EditOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  IdcardOutlined,
  KeyOutlined,
  MailOutlined,
  PlusCircleOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
  UserOutlined,
  UserDeleteOutlined,
  WhatsAppOutlined,
} from "@ant-design/icons";
import { alpha, Box, Divider, useTheme } from "@mui/material";
import { usePathname, useSearchParams } from "next/navigation";
import PageHeader from "@/app/components/layout/PageHeader";
import DetailTabs from "@/app/components/navigation/DetailTabs";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import Notification from "@/app/components/Notifications/Notification";
import AppModal from "@/app/components/modals/AppModal";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { ROLES } from "@/app/constants/roles";
import useAppNotification from "@/app/hooks/useAppNotification";
import { AssignmentForm, ContractCancelForm, ContractForm } from "./EmployeeLifecycleForms";
import EmployeeProfileSectionsForm from "./EmployeeProfileSectionsForm";
import {
  EmployeeBankDetails,
  EmployeeEducationDetails,
  EmployeeRelatedSummary,
} from "./EmployeeProfileDetails";
import EmptyState from "@/app/components/data-display/EmptyState";
import {
  DisciplineCaseForm,
  DisciplinaryActionForm,
  DisciplinaryActionRevokeForm,
} from "@/app/components/discipline/DisciplineForms";
import DisciplineCaseDetailModal from "@/app/components/discipline/DisciplineCaseDetailModal";
import EmployeeTerminationForm from "./EmployeeTerminationForm";
import LeaveRequestForm from "@/app/components/leave/LeaveRequestForm";
import LeaveDetailModal from "@/app/components/leave/LeaveDetailModal";
import LeaveCancelForm from "@/app/components/leave/LeaveCancelForm";
import LeaveBalanceAdjustmentForm from "@/app/components/leave/LeaveBalanceAdjustmentForm";
import {
  LEAVE_CATEGORY,
  LEAVE_STATUS,
  LEAVE_UNIT,
  formatLeaveDate,
  formatLeaveUnits,
} from "@/app/components/leave/leaveLabels";
import { getEmployeeStatusPresentation, isFinalEmploymentStatus } from "./employeeStatus";
import { calculateEmployeeTenure } from "@/lib/employees/tenure";
import {
  ACTION_LABELS,
  ACTION_STATUS,
  CASE_STATUS,
  SEVERITY,
} from "@/app/components/discipline/disciplineLabels";

const CHANGE_TYPE_LABELS = {
  initial: "Penempatan awal",
  transfer: "Mutasi",
  rotation: "Rolling",
  promotion: "Promosi",
  demotion: "Demosi",
  acting: "Pelaksana tugas",
  correction: "Koreksi",
};

const ASSIGNMENT_TYPE_LABELS = {
  primary: "Utama",
  acting: "Pelaksana tugas",
  temporary: "Sementara",
  additional: "Tambahan",
};

const CONTRACT_STATUS = {
  draft: ["Draft", "neutral"],
  active: ["Aktif", "success"],
  expired: ["Berakhir", "danger"],
  terminated: ["Dihentikan", "danger"],
  renewed: ["Diperpanjang", "info"],
  cancelled: ["Dibatalkan", "danger"],
};

const VALID_TABS = [
  "summary",
  "assignments",
  "contracts",
  "documents",
  "insurance",
  "education",
  "bank",
  "leave",
  "discipline",
  "account",
];

/** Bookmark lama tetap diarahkan ke nama tab baru tanpa mempertahankan label Kompetensi. */
function normalizeDetailTab(value) {
  return value === "competencies" ? "education" : value;
}

const GENDER_LABELS = {
  male: "Laki-laki",
  female: "Perempuan",
  other: "Lainnya",
  undisclosed: "Tidak disebutkan",
};

const MARITAL_STATUS_LABELS = {
  single: "Belum menikah",
  married: "Menikah",
  divorced: "Cerai hidup",
  widowed: "Cerai mati",
};

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

/** Memformat waktu audit agar pelaku dan waktu perubahan mudah ditelusuri. */
function formatDateTime(value, fallback = "Belum ditentukan") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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

/** Aksi ringkas memakai ikon di desktop dan label lengkap pada layar sentuh kecil. */
function ResponsiveActionButton({ label, style, ...props }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        width: { xs: "100%", sm: "auto" },
        flexShrink: 0,
        "& .ant-btn": {
          width: { xs: "100%", sm: 44 },
          minWidth: { xs: 0, sm: 44 },
          minHeight: 44,
          px: { sm: 0 },
        },
        "& .ant-btn .anticon": {
          flex: "0 0 auto",
          fontSize: 18,
          lineHeight: 0,
        },
        "& .ant-btn .anticon svg": {
          width: 18,
          height: 18,
        },
        "& .ant-btn .anticon svg path": {
          stroke: "currentColor",
          strokeWidth: 14,
          strokeLinejoin: "round",
        },
      }}
    >
      <Button {...props} aria-label={label} title={label} style={style}>
        <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>
          {label}
        </Box>
      </Button>
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
function InfoField({ label, value, valueContent, icon, sx }) {
  const theme = useTheme();
  return (
    <Box sx={{ minWidth: 0, ...sx }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: theme.ui.mutedText }}>
        {icon}
        <FontStyle fontSize={11.5} fontWeight={600}>
          {label}
        </FontStyle>
      </Box>
      {valueContent ? (
        <Box sx={{ mt: 0.65 }}>{valueContent}</Box>
      ) : (
        <FontStyle
          fontSize={13}
          fontWeight={600}
          sx={{ mt: 0.65, lineHeight: 1.55, overflowWrap: "anywhere" }}
        >
          {value || "Belum ditentukan"}
        </FontStyle>
      )}
    </Box>
  );
}

/** Section ringkasan mengelompokkan data berdasarkan kebutuhan pengguna. */
function SummarySection({ icon, title, action, children, contentSx }) {
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
        <FontStyle component="h3" fontSize={14} fontWeight={700} sx={{ minWidth: 0 }}>
          {title}
        </FontStyle>
        {action ? <Box sx={{ ml: "auto", flexShrink: 0 }}>{action}</Box> : null}
      </Box>
      <Box
        sx={{
          mt: 2,
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
          gap: 2.25,
          ...contentSx,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

/** Bukti visual menampilkan thumbnail privat dan membuka gambar melalui preview reusable. */
function VisualIdentity({
  title,
  file,
  aspectRatio,
  emptyText,
  organizationId,
  onPreview,
  objectFit = "contain",
  frameless = false,
  sx,
}) {
  const theme = useTheme();
  const fileId = file?.id || file?.document_file_id;
  const imageUrl = fileId
    ? `/api/uploads/${fileId}?organizationId=${encodeURIComponent(organizationId)}`
    : null;

  return (
    <Box sx={{ minWidth: 0, ...sx }}>
      <FontStyle fontSize={11.5} fontWeight={700} sx={{ mb: 1 }}>
        {title}
      </FontStyle>
      {imageUrl ? (
        <Box
          component="button"
          type="button"
          onClick={() => onPreview({ title, imageUrl, alt: `${title} pegawai` })}
          aria-label={`Perbesar ${title.toLowerCase()}`}
          sx={{
            width: "100%",
            p: 0,
            display: "block",
            overflow: "hidden",
            cursor: "zoom-in",
            bgcolor: frameless ? "transparent" : theme.ui.panelSubtleBg,
            border: frameless ? "none" : `1px solid ${theme.ui.panelBorder}`,
            borderRadius: "8px",
            transition: frameless ? "opacity 160ms ease" : "border-color 160ms ease",
            "&:hover": frameless ? { opacity: 0.94 } : { borderColor: theme.ui.panelBorder },
            "&:focus-visible": {
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: 3,
            },
            "&:focus:not(:focus-visible)": {
              outline: "none",
            },
          }}
        >
          {/* Endpoint privat tidak kompatibel dengan optimasi next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={title}
            style={{
              width: "100%",
              ...(aspectRatio ? { aspectRatio } : {}),
              display: "block",
              objectFit,
            }}
          />
        </Box>
      ) : (
        <Box
          sx={{
            minHeight: 132,
            display: "grid",
            placeItems: "center",
            px: 2,
            textAlign: "center",
            bgcolor: theme.ui.panelSubtleBg,
            border: `1px dashed ${theme.ui.panelBorder}`,
            borderRadius: "8px",
          }}
        >
          <Box>
            <IdcardOutlined style={{ color: theme.ui.mutedText, fontSize: 24 }} />
            <FontStyle fontSize={11.5} sx={{ mt: 1, color: theme.ui.mutedText }}>
              {emptyText}
            </FontStyle>
          </Box>
        </Box>
      )}
    </Box>
  );
}

/** Ringkasan jaminan menjaga nomor kepesertaan dan bukti visual dalam konteks yang sama. */
function InsuranceItem({ label, identifier, organizationId, onPreview }) {
  return (
    <Box
      component="section"
      sx={{
        minWidth: 0,
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) 220px" },
        gap: { xs: 2.5, sm: 3 },
        alignItems: "start",
      }}
    >
      <Box sx={{ minWidth: 0, display: "grid", gap: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <FontStyle component="h3" fontSize={14} fontWeight={700}>
            {label}
          </FontStyle>
          <CompactInfoChip
            label={identifier ? "Sudah dicatat" : "Belum dilengkapi"}
            tone={identifier ? "success" : "neutral"}
          />
        </Box>
        <InfoField label="Nomor kepesertaan" value={identifier?.identifier_value} />
        <InfoField label="Masa berlaku" value={formatDate(identifier?.expires_at)} />
      </Box>
      <VisualIdentity
        title={`Bukti ${label}`}
        file={identifier?.document_file}
        aspectRatio="1.586 / 1"
        emptyText={`Bukti ${label} belum diunggah.`}
        organizationId={organizationId}
        onPreview={onPreview}
      />
    </Box>
  );
}

/** Kartu kasus memisahkan fakta, tindakan, audit pencabutan, dan aksi pada hierarchy yang jelas. */
function DisciplineCaseCard({
  disciplineCase,
  readOnly,
  onDetail,
  onEditDraft,
  onRevoke,
  onCreateAction,
}) {
  const theme = useTheme();
  const action = disciplineCase.actions?.[0] || null;
  const isRevoked = action?.status === "revoked";
  const severity = SEVERITY[disciplineCase.severity] || [disciplineCase.severity, "neutral"];
  const caseStatus = CASE_STATUS[disciplineCase.status] || [disciplineCase.status, "neutral"];
  const actionStatus = action ? ACTION_STATUS[action.status] || [action.status, "neutral"] : null;

  return (
    <Box
      component="article"
      sx={{
        position: "relative",
        overflow: "hidden",
        bgcolor: theme.palette.background.paper,
        border: `1px solid ${theme.ui.panelBorderSubtle}`,
        borderRadius: "8px",
        boxShadow: theme.ui.panelShadow,
        "&::before": {
          content: '""',
          position: "absolute",
          inset: "0 auto 0 0",
          width: 4,
          bgcolor: isRevoked ? theme.status.warning.main : theme.palette.primary.main,
        },
      }}
    >
      <Box sx={{ p: { xs: 2, sm: 2.5 }, pl: { xs: 2.5, sm: 3 } }}>
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
            <FontStyle fontSize={14} fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
              {disciplineCase.case_no}
            </FontStyle>
            <Box
              sx={{
                mt: 0.75,
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                color: theme.ui.mutedText,
              }}
            >
              <CalendarOutlined />
              <FontStyle fontSize={11.5}>
                Kejadian {formatDate(disciplineCase.incident_date)}
              </FontStyle>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
            <CompactInfoChip label={severity[0]} tone={severity[1]} />
            <CompactInfoChip label={caseStatus[0]} tone={caseStatus[1]} />
          </Box>
        </Box>

        <Box sx={{ mt: 2.25 }}>
          <FontStyle fontSize={11.5} fontWeight={600} sx={{ color: theme.ui.mutedText }}>
            Uraian kejadian
          </FontStyle>
          <FontStyle
            fontSize={12.5}
            sx={{
              mt: 0.65,
              lineHeight: 1.7,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {disciplineCase.description}
          </FontStyle>
        </Box>

        <Divider sx={{ my: 2.25, borderColor: theme.ui.panelBorderSubtle }} />

        {action ? (
          <Box sx={{ display: "grid", gap: 1.5 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: { xs: "flex-start", sm: "center" },
                justifyContent: "space-between",
                flexDirection: { xs: "column", sm: "row" },
                gap: 1.25,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <FontStyle fontSize={11.5} fontWeight={600} sx={{ color: theme.ui.mutedText }}>
                  Tindakan disiplin
                </FontStyle>
                <Box sx={{ mt: 0.75, display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                  <CompactInfoChip
                    label={ACTION_LABELS[action.action_type] || action.action_type}
                    tone="danger"
                  />
                  <CompactInfoChip label={actionStatus[0]} tone={actionStatus[1]} />
                </Box>
              </Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  color: theme.ui.mutedText,
                }}
              >
                <ClockCircleOutlined />
                <FontStyle fontSize={11.5}>Diterbitkan {formatDate(action.issued_date)}</FontStyle>
              </Box>
            </Box>

            {isRevoked ? (
              <Box
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  bgcolor: theme.status.warning.background,
                  border: `1px solid ${theme.status.warning.border}`,
                  borderRadius: "8px",
                }}
              >
                <FontStyle
                  fontSize={12.5}
                  fontWeight={700}
                  sx={{ color: theme.status.warning.text }}
                >
                  Riwayat pencabutan
                </FontStyle>
                <Box
                  sx={{
                    mt: 1.25,
                    display: "grid",
                    gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
                    gap: { xs: 1.25, sm: 2 },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <FontStyle fontSize={11} sx={{ color: theme.status.warning.text }}>
                      Dicabut oleh
                    </FontStyle>
                    <FontStyle fontSize={12.25} fontWeight={600} sx={{ mt: 0.35 }}>
                      {action.revoked_by_name || "Belum diketahui"}
                    </FontStyle>
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <FontStyle fontSize={11} sx={{ color: theme.status.warning.text }}>
                      Waktu pencabutan
                    </FontStyle>
                    <FontStyle fontSize={12.25} fontWeight={600} sx={{ mt: 0.35 }}>
                      {formatDateTime(action.revoked_at)}
                    </FontStyle>
                  </Box>
                </Box>
                <FontStyle fontSize={11} sx={{ mt: 1.25, color: theme.status.warning.text }}>
                  Alasan pencabutan
                </FontStyle>
                <FontStyle
                  fontSize={12.25}
                  fontWeight={600}
                  sx={{
                    mt: 0.35,
                    lineHeight: 1.65,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    overflowWrap: "anywhere",
                  }}
                >
                  {action.revocation_reason || "Alasan pencabutan belum dicatat."}
                </FontStyle>
              </Box>
            ) : null}
          </Box>
        ) : (
          <Box
            sx={{
              p: 1.5,
              bgcolor: theme.ui.panelSubtleBg,
              borderRadius: "8px",
            }}
          >
            <FontStyle fontSize={12} sx={{ color: theme.ui.mutedText }}>
              Belum ada tindakan yang ditetapkan untuk kasus ini.
            </FontStyle>
          </Box>
        )}

        <Box
          sx={{
            mt: 2.25,
            pt: 2,
            display: "flex",
            gap: 1,
            flexWrap: "wrap",
            borderTop: `1px solid ${theme.ui.panelBorderSubtle}`,
            "& .ant-btn": {
              minHeight: 44,
              width: { xs: "100%", sm: "auto" },
            },
          }}
        >
          <ResponsiveActionButton
            label="Lihat detail"
            icon={<EyeOutlined />}
            onClick={() => onDetail(disciplineCase)}
          />
          {!readOnly && action?.status === "draft" ? (
            <ResponsiveActionButton
              label="Edit draft"
              icon={<EditOutlined />}
              onClick={() => onEditDraft(disciplineCase)}
            />
          ) : null}
          {!readOnly && action?.status === "active" ? (
            <ResponsiveActionButton
              danger
              label="Cabut tindakan"
              icon={<CloseCircleOutlined />}
              onClick={() => onRevoke(action)}
            />
          ) : null}
          {!readOnly && !action && disciplineCase.status !== "closed_no_action" ? (
            <ResponsiveActionButton
              type="primary"
              label="Tetapkan tindakan"
              icon={<FileTextOutlined />}
              onClick={() => onCreateAction(disciplineCase)}
            />
          ) : null}
        </Box>
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
  const requestedTab = normalizeDetailTab(searchParams.get("tab"));
  const initialTab =
    VALID_TABS.includes(requestedTab) && !(readOnly && ["account", "bank"].includes(requestedTab))
      ? requestedTab
      : "summary";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [state, setState] = useState({
    employee: null,
    history: { assignments: [], contracts: [] },
    discipline: [],
    leave: { year: new Date().getFullYear(), balances: [], requests: [] },
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
  const [revokeAction, setRevokeAction] = useState(null);
  const [detailCase, setDetailCase] = useState(null);
  const [assignmentDetail, setAssignmentDetail] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);
  const [contractToCancel, setContractToCancel] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [leaveDetail, setLeaveDetail] = useState(null);
  const [leaveToCancel, setLeaveToCancel] = useState(null);
  const [leaveBalance, setLeaveBalance] = useState(null);

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
            fetch(`/api/employees/${employeeId}/leave-summary${query}`),
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
            leave: bodies[5].data || { year: new Date().getFullYear(), balances: [], requests: [] },
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
      const tab = normalizeDetailTab(new URLSearchParams(window.location.search).get("tab"));
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
  // Enum backend diterjemahkan sebelum tab dibentuk agar Ringkasan selalu memakai status berbahasa Indonesia.
  const status = getEmployeeStatusPresentation(employee.employment_status);
  const finalEmploymentStatus = isFinalEmploymentStatus(employee.employment_status);
  const tenure = calculateEmployeeTenure({
    joinedDate: employee.joined_date,
    terminationDate: employee.termination_date,
    employmentStatus: employee.employment_status,
  });
  const tenureText = tenure.valid
    ? `${tenure.duration} (${tenure.throughToday ? "sampai hari ini" : `sampai ${formatDate(tenure.throughDate)}`})`
    : tenure.message;
  const canManageEmployee = !readOnly && !finalEmploymentStatus;
  const canManageLeave =
    canManageEmployee && ["active", "probation"].includes(employee.employment_status);
  // Pegawai berstatus final tidak lagi memiliki kontrak aktif, sehingga ringkasan memakai histori terakhir.
  const latestContract = state.history.contracts?.[0] || null;
  const relationshipContract = employee.contract_id
    ? {
        employment_type_name: employee.employment_type_name,
        contract_no: employee.contract_no,
        start_date: employee.contract_start_date,
        end_date: employee.contract_end_date,
      }
    : finalEmploymentStatus
      ? latestContract
      : null;
  const identifiers = state.profile.identifiers || [];
  const ktpIdentifier = identifiers.find((item) => item.identifier_type === "ktp");
  const familyCardIdentifier = identifiers.find((item) => item.identifier_type === "family_card");
  const bpjsHealth = identifiers.find((item) => item.identifier_type === "bpjs_health");
  const bpjsEmployment = identifiers.find((item) => item.identifier_type === "bpjs_employment");

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
          />
          <Divider sx={{ my: 3, borderColor: theme.ui.panelBorderSubtle }} />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" },
              columnGap: { xs: 4, lg: 5 },
              rowGap: { xs: 5, lg: 6 },
            }}
          >
            <Box sx={{ gridColumn: { xs: "auto", lg: "1 / -1" } }}>
              <SummarySection
                icon={<UserOutlined />}
                title="Identitas dan profil pegawai"
                contentSx={{
                  gridTemplateColumns: "minmax(0, 1fr)",
                  gap: { xs: 3, md: 3.5 },
                  alignItems: "start",
                }}
              >
                <Box
                  sx={{
                    minWidth: 0,
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "minmax(0, 1fr)",
                      sm: "repeat(2, minmax(0, 1fr))",
                    },
                    gap: { xs: 2.25, sm: 2.5 },
                  }}
                >
                  <Box sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}>
                    <FontStyle component="h3" fontSize={18} fontWeight={700}>
                      {employee.full_name}
                    </FontStyle>
                    {employee.preferred_name ? (
                      <FontStyle fontSize={12} sx={{ mt: 0.5, color: theme.ui.mutedText }}>
                        Nama panggilan: {employee.preferred_name}
                      </FontStyle>
                    ) : null}
                    <Box sx={{ mt: 1.25, display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                      <CompactInfoChip label={status[0]} tone={status[1]} />
                      <CompactInfoChip label={`NIP: ${employee.employee_no}`} tone="info" />
                    </Box>
                  </Box>
                  <InfoField label="Organisasi" value={employee.organization_name} />
                  <InfoField label="NIK" value={employee.national_id} />
                  <InfoField label="Tempat lahir" value={employee.birth_place} />
                  <InfoField label="Tanggal lahir" value={formatDate(employee.birth_date)} />
                  <InfoField
                    label="Jenis kelamin"
                    value={GENDER_LABELS[employee.gender] || employee.gender}
                  />
                  <InfoField label="Agama" value={employee.religion} />
                  <InfoField
                    label="Status perkawinan"
                    value={
                      MARITAL_STATUS_LABELS[employee.marital_status] || employee.marital_status
                    }
                  />
                  <InfoField label="Golongan darah" value={employee.blood_type} />
                  <InfoField label="Kewarganegaraan" value={employee.nationality} />
                </Box>
                <Box
                  sx={{
                    minWidth: 0,
                    pt: { xs: 2.5, sm: 3 },
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "minmax(0, 1fr)",
                      sm: "180px minmax(0, 420px)",
                      xl: "180px repeat(2, minmax(0, 420px))",
                    },
                    gap: { xs: 3, sm: 3.5 },
                    alignItems: "start",
                    justifyContent: { xs: "stretch", sm: "start" },
                    borderTop: `1px solid ${theme.ui.panelBorderSubtle}`,
                  }}
                >
                  <VisualIdentity
                    title="Pas foto"
                    file={state.profile.profilePhoto}
                    aspectRatio="3 / 4"
                    emptyText="Pas foto belum diunggah."
                    organizationId={organizationId}
                    onPreview={setImagePreview}
                    objectFit="cover"
                    sx={{ width: "100%", maxWidth: 180, mx: { xs: "auto", sm: 0 } }}
                  />
                  <VisualIdentity
                    title="Foto KTP"
                    file={ktpIdentifier?.document_file}
                    emptyText="Foto KTP belum diunggah."
                    organizationId={organizationId}
                    onPreview={setImagePreview}
                    frameless
                    sx={{ width: "100%", maxWidth: 420, mx: { xs: "auto", sm: 0 } }}
                  />
                  <VisualIdentity
                    title="Foto Kartu Keluarga (KK)"
                    file={familyCardIdentifier?.document_file}
                    emptyText="Foto Kartu Keluarga belum diunggah."
                    organizationId={organizationId}
                    onPreview={setImagePreview}
                    frameless
                    sx={{
                      width: "100%",
                      maxWidth: 420,
                      mx: { xs: "auto", sm: 0 },
                      gridColumn: { sm: 2, xl: "auto" },
                    }}
                  />
                </Box>
              </SummarySection>
            </Box>
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
            <SummarySection
              icon={<FileTextOutlined />}
              title="Hubungan kerja"
              action={
                finalEmploymentStatus ? (
                  <ResponsiveActionButton
                    label="Lihat detail"
                    icon={<EyeOutlined />}
                    onClick={() => setModal("terminationDetail")}
                  />
                ) : null
              }
            >
              <InfoField
                label="Tanggal bergabung di organisasi"
                value={formatDate(employee.joined_date)}
              />
              <InfoField label="Masa kerja" value={tenureText} />
              {finalEmploymentStatus ? (
                <>
                  <InfoField
                    label="Status hubungan kerja"
                    valueContent={<CompactInfoChip label={status[0]} tone={status[1]} />}
                  />
                  <InfoField
                    label="Tanggal berakhir"
                    value={formatDate(employee.termination_date)}
                  />
                </>
              ) : null}
              <InfoField
                label={finalEmploymentStatus ? "Jenis kepegawaian terakhir" : "Jenis kepegawaian"}
                value={relationshipContract?.employment_type_name}
              />
              <InfoField
                label={finalEmploymentStatus ? "Nomor kontrak terakhir" : "Nomor kontrak"}
                value={relationshipContract?.contract_no}
              />
              <InfoField
                label={
                  finalEmploymentStatus ? "Tanggal mulai kontrak terakhir" : "Tanggal mulai kontrak"
                }
                value={formatDate(relationshipContract?.start_date)}
              />
              <InfoField
                label={finalEmploymentStatus ? "Akhir kontrak terakhir" : "Akhir kontrak"}
                value={formatDate(relationshipContract?.end_date, "Tanpa batas akhir")}
              />
            </SummarySection>
            <EmployeeRelatedSummary profile={state.profile} embedded />
          </Box>
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
              canManageEmployee ? (
                <ResponsiveActionButton
                  type="primary"
                  label="Penempatan baru"
                  icon={<SwapOutlined />}
                  onClick={() => {
                    setSelectedAssignment(null);
                    setModal("assignment");
                  }}
                />
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
                    <Box
                      sx={{
                        minWidth: 0,
                        display: "grid",
                        gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) auto" },
                        gap: 2,
                        pb: index === state.history.assignments.length - 1 ? 0 : 2.5,
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}
                        >
                          <FontStyle fontSize={13.5} fontWeight={700}>
                            {item.position_name || "Jabatan belum ditentukan"}
                          </FontStyle>
                          <CompactInfoChip
                            label={
                              active ? "Penempatan aktif" : CHANGE_TYPE_LABELS[item.change_type]
                            }
                            tone={active ? "success" : "info"}
                          />
                        </Box>
                        <Box
                          sx={{
                            mt: 0.75,
                            display: "flex",
                            alignItems: "center",
                            columnGap: 1,
                            rowGap: 0.5,
                            flexWrap: "wrap",
                          }}
                        >
                          <FontStyle fontSize={12.5} fontWeight={600}>
                            {item.unit_name || "Divisi & Unit belum ditentukan"}
                          </FontStyle>
                          <Box
                            component="span"
                            aria-hidden="true"
                            sx={{
                              width: 5,
                              height: 5,
                              flex: "0 0 5px",
                              borderRadius: "50%",
                              bgcolor: theme.ui.mutedText,
                            }}
                          />
                          <FontStyle fontSize={12.5} fontWeight={600}>
                            {item.location_name || "Lokasi belum ditentukan"}
                          </FontStyle>
                        </Box>
                        <FontStyle fontSize={11.5} sx={{ mt: 0.5, color: theme.ui.mutedText }}>
                          TMT {formatDate(item.effective_from)} sampai{" "}
                          {formatDate(item.effective_until, "sekarang")}
                          {item.supervisor_name ? ` · Atasan: ${item.supervisor_name}` : ""}
                        </FontStyle>
                        <FontStyle fontSize={10.5} sx={{ mt: 1, color: theme.ui.mutedText }}>
                          Dicatat oleh {item.created_by_name || "pelaku tidak tersedia"} pada{" "}
                          {formatDateTime(item.created_at)}
                          {item.updated_audit_at
                            ? ` · Dikoreksi oleh ${item.updated_by_name || "pelaku tidak tersedia"} pada ${formatDateTime(item.updated_audit_at)}`
                            : ""}
                        </FontStyle>
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 1,
                          flexWrap: "wrap",
                          width: { xs: "100%", sm: "auto" },
                        }}
                      >
                        <ResponsiveActionButton
                          label="Lihat penempatan"
                          icon={<EyeOutlined />}
                          onClick={() => setAssignmentDetail(item)}
                        />
                        {canManageEmployee && active ? (
                          <ResponsiveActionButton
                            label="Edit penempatan"
                            icon={<EditOutlined />}
                            onClick={() => {
                              setSelectedAssignment(item);
                              setModal("assignmentEdit");
                            }}
                          />
                        ) : null}
                      </Box>
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
              canManageEmployee ? (
                <ResponsiveActionButton
                  type="primary"
                  label="Kontrak baru"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setSelectedContract(null);
                    setModal("contract");
                  }}
                />
              ) : null
            }
          />
          <Divider sx={{ my: 3, borderColor: theme.ui.panelBorderSubtle }} />
          {state.history.contracts.length ? (
            <Box component="ol" sx={{ display: "grid", gap: 1.5, m: 0, p: 0, listStyle: "none" }}>
              {state.history.contracts.map((item) => (
                <Box
                  component="li"
                  key={item.id}
                  sx={{
                    position: "relative",
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "minmax(0, 1fr)",
                      md: "190px minmax(0, 1fr) auto",
                    },
                    alignItems: "start",
                    gap: { xs: 2.25, md: 3.5 },
                    p: { xs: 2, sm: 2.5, md: 3 },
                    border: `1px solid ${
                      item.status === "active"
                        ? theme.status.success.main
                        : item.status === "cancelled"
                          ? theme.status.danger.main
                          : theme.ui.panelBorderSubtle
                    }`,
                    borderLeft: `4px solid ${
                      item.status === "active"
                        ? theme.status.success.main
                        : item.status === "cancelled"
                          ? theme.status.danger.main
                          : theme.ui.panelBorder
                    }`,
                    borderRadius: "8px",
                    bgcolor:
                      item.status === "active"
                        ? alpha(theme.status.success.main, 0.045)
                        : item.status === "cancelled"
                          ? alpha(theme.status.danger.main, 0.035)
                          : theme.ui.panelBg,
                    transition: "border-color 180ms ease, box-shadow 180ms ease",
                    "&:hover": {
                      borderColor:
                        item.status === "active"
                          ? theme.status.success.main
                          : item.status === "cancelled"
                            ? theme.status.danger.main
                            : theme.ui.panelBorder,
                      boxShadow: theme.ui.panelShadow,
                    },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <FontStyle fontSize={11.5} fontWeight={700} sx={{ color: theme.ui.mutedText }}>
                      PERIODE KONTRAK
                    </FontStyle>
                    <Box sx={{ mt: 0.75, display: "flex", gap: 1, alignItems: "flex-start" }}>
                      <CalendarOutlined style={{ marginTop: 3, color: theme.ui.mutedText }} />
                      <Box sx={{ minWidth: 0 }}>
                        <FontStyle fontSize={13.5} fontWeight={700}>
                          {formatDate(item.start_date)}
                        </FontStyle>
                        <FontStyle
                          fontSize={12.5}
                          sx={{ mt: 0.35, color: theme.ui.mutedText, lineHeight: 1.5 }}
                        >
                          sampai {formatDate(item.end_date, "tanpa batas akhir")}
                        </FontStyle>
                      </Box>
                    </Box>
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                      <FontStyle fontSize={15.5} fontWeight={700} sx={{ lineHeight: 1.45 }}>
                        {item.employment_type_name || "Jenis kepegawaian belum ditentukan"}
                      </FontStyle>
                      <CompactInfoChip
                        label={CONTRACT_STATUS[item.status]?.[0] || "Status belum dikenali"}
                        tone={CONTRACT_STATUS[item.status]?.[1] || "neutral"}
                      />
                    </Box>
                    <Box sx={{ mt: 0.9, display: "flex", gap: 0.75, alignItems: "center" }}>
                      <IdcardOutlined style={{ color: theme.ui.mutedText }} />
                      <FontStyle fontSize={13} fontWeight={600}>
                        {item.contract_no || "Nomor kontrak belum dicatat"}
                      </FontStyle>
                    </Box>
                    {item.notes ? (
                      <FontStyle
                        fontSize={12.5}
                        sx={{
                          mt: 1,
                          color: theme.ui.mutedText,
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {item.notes}
                      </FontStyle>
                    ) : null}

                    <Box
                      aria-label="Jejak audit kontrak"
                      sx={{
                        mt: 2,
                        pt: 1.75,
                        borderTop: `1px solid ${theme.ui.panelBorderSubtle}`,
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
                        gap: 1.5,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, minWidth: 0 }}>
                        <UserOutlined style={{ marginTop: 3, color: theme.ui.mutedText }} />
                        <Box sx={{ minWidth: 0 }}>
                          <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
                            Dicatat oleh
                          </FontStyle>
                          <FontStyle fontSize={12.5} fontWeight={600} sx={{ mt: 0.25 }}>
                            {item.created_by_name || "Pelaku tidak tersedia"}
                          </FontStyle>
                          <FontStyle fontSize={11.5} sx={{ mt: 0.25, color: theme.ui.mutedText }}>
                            {formatDateTime(item.created_audit_at || item.created_at)}
                          </FontStyle>
                        </Box>
                      </Box>
                      {item.updated_audit_at ? (
                        <Box
                          sx={{ display: "flex", alignItems: "flex-start", gap: 1, minWidth: 0 }}
                        >
                          <EditOutlined style={{ marginTop: 3, color: theme.ui.mutedText }} />
                          <Box sx={{ minWidth: 0 }}>
                            <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
                              Terakhir dikoreksi oleh
                            </FontStyle>
                            <FontStyle fontSize={12.5} fontWeight={600} sx={{ mt: 0.25 }}>
                              {item.updated_by_name || "Pelaku tidak tersedia"}
                            </FontStyle>
                            <FontStyle fontSize={11.5} sx={{ mt: 0.25, color: theme.ui.mutedText }}>
                              {formatDateTime(item.updated_audit_at)}
                            </FontStyle>
                          </Box>
                        </Box>
                      ) : null}
                    </Box>

                    {item.status === "cancelled" && item.cancellation_reason ? (
                      <Box
                        sx={{
                          mt: 1.75,
                          borderLeft: `3px solid ${theme.status.danger.main}`,
                          bgcolor: theme.status.danger.background,
                          py: 1.25,
                          px: 1.5,
                          borderRadius: "6px",
                        }}
                      >
                        <FontStyle fontSize={12.5} fontWeight={700}>
                          Pembatalan kontrak
                        </FontStyle>
                        <FontStyle
                          fontSize={12.5}
                          sx={{
                            mt: 0.45,
                            color: theme.ui.mutedText,
                            lineHeight: 1.6,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {item.cancellation_reason}
                        </FontStyle>
                        <Box
                          sx={{
                            mt: 0.8,
                            display: "flex",
                            alignItems: "center",
                            gap: 0.75,
                            flexWrap: "wrap",
                          }}
                        >
                          <ClockCircleOutlined style={{ color: theme.ui.mutedText }} />
                          <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
                            Dibatalkan oleh {item.cancelled_by_name || "pelaku tidak tersedia"} pada{" "}
                            {formatDateTime(item.cancelled_at)}
                          </FontStyle>
                        </Box>
                      </Box>
                    ) : null}
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 1,
                      flexWrap: "wrap",
                      width: { xs: "100%", md: "auto" },
                      justifyContent: { md: "flex-end" },
                      flexShrink: 0,
                    }}
                  >
                    {item.document_file_id ? (
                      <ResponsiveActionButton
                        label="Lihat kontrak"
                        icon={<EyeOutlined />}
                        href={`/api/uploads/${item.document_file_id}?organizationId=${organizationId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    ) : null}
                    {canManageEmployee && item.status !== "cancelled" ? (
                      <>
                        <ResponsiveActionButton
                          label="Edit kontrak"
                          icon={<EditOutlined />}
                          onClick={() => {
                            setSelectedContract(item);
                            setModal("contractEdit");
                          }}
                        />
                        <ResponsiveActionButton
                          danger
                          label="Batalkan kontrak"
                          icon={<CloseCircleOutlined />}
                          onClick={() => setContractToCancel(item)}
                        />
                      </>
                    ) : null}
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
      key: "insurance",
      label: <TabLabel icon={<SafetyCertificateOutlined />}>Jaminan</TabLabel>,
      children: (
        <Box sx={contentSx}>
          <TabSectionHeader
            title="Jaminan pegawai"
            description="Lihat nomor kepesertaan dan bukti BPJS tanpa memenuhi ringkasan utama pegawai."
          />
          <Divider sx={{ my: 3, borderColor: theme.ui.panelBorderSubtle }} />
          <Box sx={{ display: "grid", gap: 4 }}>
            <InsuranceItem
              label="BPJS Kesehatan"
              identifier={bpjsHealth}
              organizationId={organizationId}
              onPreview={setImagePreview}
            />
            <Divider sx={{ borderColor: theme.ui.panelBorderSubtle }} />
            <InsuranceItem
              label="BPJS Ketenagakerjaan"
              identifier={bpjsEmployment}
              organizationId={organizationId}
              onPreview={setImagePreview}
            />
          </Box>
        </Box>
      ),
    },
    {
      key: "education",
      label: <TabLabel icon={<BookOutlined />}>Pendidikan</TabLabel>,
      children: (
        <Box sx={contentSx}>
          <TabSectionHeader
            title="Pendidikan dan pengembangan"
            description="Telusuri riwayat pendidikan, tingkat keahlian, serta sertifikasi pegawai secara terstruktur."
          />
          <Divider sx={{ my: 3, borderColor: theme.ui.panelBorderSubtle }} />
          <EmployeeEducationDetails
            profile={state.profile}
            organizationId={organizationId}
            onPreview={setImagePreview}
          />
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
      key: "leave",
      label: <TabLabel icon={<CalendarOutlined />}>Cuti & Izin</TabLabel>,
      children: (
        <Box sx={contentSx}>
          <TabSectionHeader
            title="Cuti, izin, dan saldo"
            description="Lihat saldo tahun berjalan, periode yang sedang berlangsung, serta seluruh histori keputusan pegawai."
            action={
              canManageLeave ? (
                <ResponsiveActionButton
                  type="primary"
                  label="Catat cuti/izin"
                  icon={<PlusOutlined />}
                  onClick={() => setModal("leave")}
                />
              ) : null
            }
          />
          <Divider sx={{ my: 3, borderColor: theme.ui.panelBorderSubtle }} />
          <FontStyle component="h3" fontSize={14} fontWeight={700}>
            Saldo {state.leave.year}
          </FontStyle>
          {state.leave.balances.length ? (
            <Box
              sx={{
                mt: 1.5,
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2,minmax(0,1fr))",
                  xl: "repeat(3,minmax(0,1fr))",
                },
                gap: 1.5,
              }}
            >
              {state.leave.balances.map((balance) => (
                <Box
                  key={balance.id}
                  sx={{
                    p: 2,
                    border: `1px solid ${theme.ui.panelBorderSubtle}`,
                    borderRadius: 2,
                    bgcolor: theme.ui.panelSubtleBg,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 1,
                      alignItems: "flex-start",
                    }}
                  >
                    <Box>
                      <FontStyle fontSize={12.5} fontWeight={700}>
                        {balance.name}
                      </FontStyle>
                      <FontStyle fontSize={22} fontWeight={700} sx={{ mt: 0.75 }}>
                        {formatLeaveUnits(balance.balance)}{" "}
                        <Box component="span" sx={{ fontSize: 12, fontWeight: 600 }}>
                          {LEAVE_UNIT[balance.unit]}
                        </Box>
                      </FontStyle>
                      <FontStyle fontSize={11.5} sx={{ mt: 0.5, color: theme.ui.mutedText }}>
                        Jatah awal {formatLeaveUnits(balance.annual_allowance)}{" "}
                        {LEAVE_UNIT[balance.unit]}
                      </FontStyle>
                      <Box sx={{ mt: 0.75 }}>
                        <CompactInfoChip
                          label={
                            Number(balance.balance) <= 0
                              ? "Saldo habis"
                              : Number(balance.balance) <=
                                  Math.max(1, Number(balance.annual_allowance || 0) * 0.25)
                                ? "Hampir habis"
                                : "Saldo mencukupi"
                          }
                          tone={
                            Number(balance.balance) <= 0
                              ? "danger"
                              : Number(balance.balance) <=
                                  Math.max(1, Number(balance.annual_allowance || 0) * 0.25)
                                ? "warning"
                                : "success"
                          }
                        />
                      </Box>
                    </Box>
                    {canManageLeave ? (
                      <ResponsiveActionButton
                        label="Kelola saldo"
                        icon={<EditOutlined />}
                        onClick={() => setLeaveBalance(balance)}
                      />
                    ) : null}
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ mt: 1.5 }}>
              <EmptyState description="Belum ada saldo yang terbentuk. Saldo dibuat saat aturan yang mengurangi jatah pertama kali digunakan." />
            </Box>
          )}
          <Divider sx={{ my: 3, borderColor: theme.ui.panelBorderSubtle }} />
          <FontStyle component="h3" fontSize={14} fontWeight={700}>
            Histori cuti & izin
          </FontStyle>
          {state.leave.requests.length ? (
            <Box sx={{ mt: 1.5, display: "grid", gap: 1.25 }}>
              {state.leave.requests.map((request) => (
                <Box
                  key={request.id}
                  sx={{
                    p: 2,
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "minmax(180px,.7fr) minmax(220px,1fr) auto",
                    },
                    gap: 2,
                    alignItems: "center",
                    border: `1px solid ${theme.ui.panelBorderSubtle}`,
                    borderLeft: `3px solid ${request.status === "approved" ? theme.status.success.main : theme.ui.border}`,
                    borderRadius: 2,
                    bgcolor:
                      request.status === "approved"
                        ? alpha(theme.status.success.main, 0.035)
                        : theme.ui.panelBg,
                  }}
                >
                  <Box>
                    <FontStyle fontSize={12.5} fontWeight={700}>
                      {formatLeaveDate(request.start_date)} - {formatLeaveDate(request.end_date)}
                    </FontStyle>
                    <FontStyle fontSize={11.5} sx={{ mt: 0.5, color: theme.ui.mutedText }}>
                      {formatLeaveUnits(request.requested_units)} {LEAVE_UNIT[request.unit]} ·{" "}
                      {request.request_no}
                    </FontStyle>
                  </Box>
                  <Box>
                    <FontStyle fontSize={13} fontWeight={700}>
                      {request.leave_type_name}
                    </FontStyle>
                    <FontStyle
                      fontSize={11.5}
                      sx={{
                        mt: 0.5,
                        color: theme.ui.mutedText,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {request.reason}
                    </FontStyle>
                    <Box sx={{ mt: 0.75, display: "flex", gap: 0.75 }}>
                      <CompactInfoChip
                        label={LEAVE_CATEGORY[request.category]?.[0]}
                        tone={LEAVE_CATEGORY[request.category]?.[1]}
                      />
                      <CompactInfoChip
                        label={LEAVE_STATUS[request.status]?.[0]}
                        tone={LEAVE_STATUS[request.status]?.[1]}
                      />
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      gap: 1,
                      justifyContent: { xs: "flex-start", md: "flex-end" },
                    }}
                  >
                    <ResponsiveActionButton
                      label="Lihat"
                      icon={<EyeOutlined />}
                      onClick={() => setLeaveDetail(request)}
                    />
                    {canManageLeave && request.status === "approved" ? (
                      <ResponsiveActionButton
                        danger
                        label="Batalkan"
                        icon={<CloseCircleOutlined />}
                        onClick={() => setLeaveToCancel(request)}
                      />
                    ) : null}
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ mt: 1.5 }}>
              <EmptyState description="Belum ada cuti atau izin yang tercatat untuk pegawai ini." />
            </Box>
          )}
        </Box>
      ),
    },
    {
      key: "discipline",
      label: <TabLabel icon={<SafetyCertificateOutlined />}>Disiplin</TabLabel>,
      children: (
        <Box sx={contentSx}>
          <TabSectionHeader
            title="Disiplin dan sanksi"
            description="Kasus dicatat untuk pemeriksaan HRD. Sistem tidak menerbitkan sanksi secara otomatis."
            action={
              canManageEmployee ? (
                <ResponsiveActionButton
                  type="primary"
                  label="Catat kasus"
                  icon={<PlusOutlined />}
                  onClick={() => setModal("disciplineCase")}
                />
              ) : null
            }
          />
          <Divider sx={{ my: 3, borderColor: theme.ui.panelBorderSubtle }} />
          {state.discipline.length ? (
            <Box sx={{ display: "grid", gap: 2 }}>
              {state.discipline.map((disciplineCase) => (
                <DisciplineCaseCard
                  key={disciplineCase.id}
                  disciplineCase={disciplineCase}
                  readOnly={!canManageEmployee}
                  onDetail={setDetailCase}
                  onEditDraft={setActionCase}
                  onRevoke={setRevokeAction}
                  onCreateAction={setActionCase}
                />
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

  return (
    <Box sx={{ width: "100%", minWidth: 0, maxWidth: "100%", display: "grid", gap: 3 }}>
      <PageHeader
        title="Detail data pegawai"
        description="Lihat dan kelola profil, riwayat penempatan, kontrak, dokumen, kompetensi, serta disiplin pegawai."
        action={
          canManageEmployee ? (
            <Box
              sx={{
                display: "flex",
                gap: 1,
                flexWrap: "wrap",
                width: { xs: "100%", sm: "auto" },
                "& .ant-btn": { minHeight: 44, width: { xs: "100%", sm: "auto" } },
              }}
            >
              <ResponsiveActionButton
                label="Edit profil"
                icon={<EditOutlined />}
                onClick={() => setModal("profile")}
              />
              <ResponsiveActionButton
                type="primary"
                danger
                label="Akhiri Hubungan kerja"
                icon={<UserDeleteOutlined />}
                onClick={() => setModal("termination")}
              />
            </Box>
          ) : null
        }
      />
      <DetailTabs items={tabItems} activeKey={activeTab} onChange={changeTab} />
      {canManageEmployee ? (
        <AssignmentForm
          open={modal === "assignment" || modal === "assignmentEdit"}
          employee={employee}
          assignment={modal === "assignmentEdit" ? selectedAssignment : null}
          onClose={() => {
            setModal(null);
            setSelectedAssignment(null);
          }}
          onSaved={async (message) => {
            setModal(null);
            setSelectedAssignment(null);
            showNotification(message);
            await load();
          }}
          onError={(message) => showNotification(message, "error")}
        />
      ) : null}
      {canManageEmployee ? (
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
      {canManageEmployee && contractToCancel ? (
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
      {canManageEmployee ? (
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
      {canManageEmployee ? (
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
      {canManageEmployee && actionCase ? (
        <DisciplinaryActionForm
          open
          disciplineCase={{
            ...actionCase,
            employee_id: employee.id,
            organization_id: organizationId,
          }}
          action={actionCase.actions?.[0] || null}
          onClose={() => setActionCase(null)}
          onSaved={async (message) => {
            setActionCase(null);
            showNotification(message);
            await load();
          }}
          onError={(message) => showNotification(message, "error")}
        />
      ) : null}
      {canManageEmployee && revokeAction ? (
        <DisciplinaryActionRevokeForm
          open
          action={revokeAction}
          organizationId={organizationId}
          onClose={() => setRevokeAction(null)}
          onSaved={async (message) => {
            setRevokeAction(null);
            showNotification(message);
            await load();
          }}
          onError={(message) => showNotification(message, "error")}
        />
      ) : null}
      {canManageEmployee ? (
        <EmployeeTerminationForm
          open={modal === "termination"}
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
      <AppModal
        open={modal === "terminationDetail"}
        title="Detail akhir hubungan kerja"
        description="Informasi keputusan dan hubungan kerja terakhir pegawai."
        icon={<UserDeleteOutlined />}
        size="md"
        onClose={() => setModal(null)}
        footer={<Button onClick={() => setModal(null)}>Tutup</Button>}
      >
        <Box sx={{ display: "grid", gap: 3 }}>
          <SummarySection icon={<UserOutlined />} title="Pegawai">
            <InfoField label="Nama lengkap" value={employee.full_name} />
            <InfoField label="NIP" value={employee.employee_no} />
            <InfoField label="Organisasi" value={employee.organization_name} />
            <InfoField label="Status akhir" value={status[0]} />
          </SummarySection>
          <SummarySection icon={<UserDeleteOutlined />} title="Keputusan akhir hubungan kerja">
            <InfoField label="Tanggal efektif" value={formatDate(employee.termination_date)} />
            <InfoField label="Dicatat oleh" value={employee.termination_recorded_by_name} />
            <InfoField
              label="Waktu pencatatan"
              value={formatDateTime(employee.termination_recorded_at)}
            />
            <InfoField
              label="Alasan"
              value={employee.termination_reason}
              sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}
            />
          </SummarySection>
          <SummarySection icon={<FileTextOutlined />} title="Kontrak terakhir">
            <InfoField
              label="Jenis kepegawaian"
              value={relationshipContract?.employment_type_name}
            />
            <InfoField label="Nomor kontrak" value={relationshipContract?.contract_no} />
            <InfoField
              label="Tanggal mulai kontrak"
              value={formatDate(relationshipContract?.start_date)}
            />
            <InfoField
              label="Akhir kontrak"
              value={formatDate(relationshipContract?.end_date, "Tanpa batas akhir")}
            />
          </SummarySection>
        </Box>
      </AppModal>
      <AppModal
        open={Boolean(assignmentDetail)}
        title="Detail penempatan"
        description="Informasi organisasi, periode, dokumen, dan jejak pencatatan penempatan."
        icon={<EnvironmentOutlined />}
        size="md"
        onClose={() => setAssignmentDetail(null)}
        footer={
          <Box
            sx={{
              width: "100%",
              display: "flex",
              justifyContent: "flex-end",
              gap: 1,
              flexWrap: "wrap",
              "& .ant-btn": { minHeight: 40 },
            }}
          >
            {assignmentDetail?.document_file_id ? (
              <Button
                icon={<FileTextOutlined />}
                href={`/api/uploads/${assignmentDetail.document_file_id}?organizationId=${organizationId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Lihat dokumen
              </Button>
            ) : null}
            <Button onClick={() => setAssignmentDetail(null)}>Tutup</Button>
          </Box>
        }
      >
        {assignmentDetail ? (
          <Box sx={{ display: "grid", gap: 3 }}>
            <SummarySection icon={<SwapOutlined />} title="Status dan periode">
              <InfoField
                label="Status penempatan"
                valueContent={
                  <CompactInfoChip
                    label={assignmentDetail.effective_until ? "Historis" : "Aktif"}
                    tone={assignmentDetail.effective_until ? "neutral" : "success"}
                  />
                }
              />
              <InfoField
                label="Jenis penugasan"
                value={
                  ASSIGNMENT_TYPE_LABELS[assignmentDetail.assignment_type] ||
                  assignmentDetail.assignment_type
                }
              />
              <InfoField
                label="Jenis perubahan"
                value={
                  CHANGE_TYPE_LABELS[assignmentDetail.change_type] || assignmentDetail.change_type
                }
              />
              <InfoField
                label="TMT jabatan/penempatan"
                value={formatDate(assignmentDetail.effective_from)}
              />
              <InfoField
                label="Berakhir"
                value={formatDate(assignmentDetail.effective_until, "Masih aktif")}
              />
            </SummarySection>
            <SummarySection icon={<EnvironmentOutlined />} title="Unit kerja">
              <InfoField label="Lokasi" value={assignmentDetail.location_name} />
              <InfoField label="Divisi & Unit" value={assignmentDetail.unit_name} />
              <InfoField label="Jabatan" value={assignmentDetail.position_name} />
              <InfoField label="Atasan langsung" value={assignmentDetail.supervisor_name} />
            </SummarySection>
            <SummarySection icon={<FileTextOutlined />} title="Administrasi dan audit">
              <InfoField label="Nomor dokumen penempatan" value={assignmentDetail.decree_no} />
              <InfoField
                label="Dokumen penempatan"
                value={assignmentDetail.document_file_id ? "Tersedia" : "Belum diunggah"}
              />
              <InfoField label="Dicatat oleh" value={assignmentDetail.created_by_name} />
              <InfoField
                label="Waktu pencatatan"
                value={formatDateTime(assignmentDetail.created_at)}
              />
              {assignmentDetail.updated_audit_at ? (
                <>
                  <InfoField label="Dikoreksi oleh" value={assignmentDetail.updated_by_name} />
                  <InfoField
                    label="Waktu koreksi"
                    value={formatDateTime(assignmentDetail.updated_audit_at)}
                  />
                </>
              ) : null}
              <InfoField
                label="Catatan"
                value={assignmentDetail.notes}
                sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}
              />
            </SummarySection>
          </Box>
        ) : null}
      </AppModal>
      <LeaveRequestForm
        open={modal === "leave"}
        organizationId={organizationId}
        presetEmployeeId={employee.id}
        onClose={() => setModal(null)}
        onSaved={async (message) => {
          setModal(null);
          showNotification(message);
          await load();
        }}
        onError={(message) => showNotification(message, "error")}
      />
      <LeaveDetailModal item={leaveDetail} onClose={() => setLeaveDetail(null)} />
      {leaveToCancel ? (
        <LeaveCancelForm
          item={leaveToCancel}
          onClose={() => setLeaveToCancel(null)}
          onSaved={async (message) => {
            setLeaveToCancel(null);
            showNotification(message);
            await load();
          }}
          onError={(message) => showNotification(message, "error")}
        />
      ) : null}
      {leaveBalance ? (
        <LeaveBalanceAdjustmentForm
          employee={employee}
          entitlement={leaveBalance}
          onClose={() => setLeaveBalance(null)}
          onSaved={async (message) => {
            setLeaveBalance(null);
            showNotification(message);
            await load();
          }}
          onError={(message) => showNotification(message, "error")}
        />
      ) : null}
      <DisciplineCaseDetailModal
        open={Boolean(detailCase)}
        disciplineCase={detailCase}
        organizationId={organizationId}
        onClose={() => setDetailCase(null)}
      />
      <ImagePreviewModal
        open={Boolean(imagePreview)}
        onClose={() => setImagePreview(null)}
        imageUrl={imagePreview?.imageUrl}
        title={imagePreview?.title}
        alt={imagePreview?.alt}
      />
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
