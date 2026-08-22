"use client";

import { Button } from "antd";
import {
  BankOutlined,
  BookOutlined,
  ContactsOutlined,
  FileTextOutlined,
  LinkOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Box, useTheme } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";

const RELATIONSHIP_LABELS = {
  spouse: "Pasangan",
  child: "Anak",
  parent: "Orang tua",
  sibling: "Saudara",
  other: "Lainnya",
};

/** Tanggal profil memakai locale Indonesia dan tetap aman untuk nilai kosong. */
function formatProfileDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Section detail memberi garis pembatas yang jelas tanpa membuat card bertumpuk. */
export function ProfileSection({ icon, title, description, children }) {
  const theme = useTheme();
  return (
    <Box component="section" sx={{ minWidth: 0 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          pb: 1.25,
          mb: 2,
          borderBottom: `1px solid ${theme.ui.panelBorderSubtle}`,
        }}
      >
        <Box sx={{ color: theme.palette.primary.main, fontSize: 17 }}>{icon}</Box>
        <Box sx={{ minWidth: 0 }}>
          <FontStyle component="h3" fontSize={14} fontWeight={700}>
            {title}
          </FontStyle>
          {description ? (
            <FontStyle fontSize={11.5} sx={{ mt: 0.25, color: theme.ui.mutedText }}>
              {description}
            </FontStyle>
          ) : null}
        </Box>
      </Box>
      {children}
    </Box>
  );
}

/** Baris data berulang menjaga label dan nilai tetap mudah dipindai di semua viewport. */
function DetailRows({ items, emptyText }) {
  const theme = useTheme();
  if (!items?.length)
    return (
      <FontStyle fontSize={12.5} sx={{ color: theme.ui.mutedText }}>
        {emptyText}
      </FontStyle>
    );
  return (
    <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
      {items.map((item, index) => (
        <Box
          component="li"
          key={item.key || index}
          sx={{
            display: "flex",
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
            flexDirection: { xs: "column", sm: "row" },
            gap: 1,
            py: 1.25,
            borderTop: index ? `1px solid ${theme.ui.panelBorderSubtle}` : "none",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <FontStyle fontSize={12.5} fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
              {item.title}
            </FontStyle>
            {item.description ? (
              <FontStyle
                fontSize={11.5}
                sx={{ mt: 0.35, color: theme.ui.mutedText, overflowWrap: "anywhere" }}
              >
                {item.description}
              </FontStyle>
            ) : null}
          </Box>
          {item.action || null}
        </Box>
      ))}
    </Box>
  );
}

/** Ringkasan tambahan menampilkan keluarga, kontak darurat, dan akun sosial. */
export function EmployeeRelatedSummary({ profile }) {
  return (
    <Box
      sx={{
        mt: 4,
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" },
        gap: { xs: 3, lg: 4 },
      }}
    >
      <ProfileSection icon={<TeamOutlined />} title="Keluarga dan tanggungan">
        <DetailRows
          items={(profile.dependents || []).map((item) => ({
            key: item.id,
            title: item.full_name,
            description: [
              RELATIONSHIP_LABELS[item.relationship] || item.relationship,
              item.birth_date ? `Lahir ${formatProfileDate(item.birth_date)}` : null,
              item.phone,
              item.is_dependent ? "Tanggungan" : null,
              item.notes,
            ]
              .filter(Boolean)
              .join(" · "),
          }))}
          emptyText="Belum ada data keluarga atau tanggungan."
        />
      </ProfileSection>
      <ProfileSection icon={<ContactsOutlined />} title="Kontak darurat">
        <DetailRows
          items={(profile.emergencyContacts || []).map((item) => ({
            key: item.id,
            title: item.full_name,
            description: [item.relationship || "Hubungan belum dicatat", item.phone, item.address]
              .filter(Boolean)
              .join(" · "),
            action: item.is_primary ? (
              <CompactInfoChip label="Kontak utama" tone="success" />
            ) : null,
          }))}
          emptyText="Belum ada kontak darurat yang dicatat."
        />
      </ProfileSection>
      <ProfileSection icon={<LinkOutlined />} title="Akun sosial">
        <DetailRows
          items={(profile.socialAccounts || []).map((item) => ({
            key: item.id,
            title: item.platform,
            description: item.handle_or_url,
          }))}
          emptyText="Belum ada akun sosial yang dicatat."
        />
      </ProfileSection>
    </Box>
  );
}

/** Tab rekening hanya dirender bagi role administrasi yang berhak. */
export function EmployeeBankDetails({ profile }) {
  return (
    <ProfileSection
      icon={<BankOutlined />}
      title="Rekening pegawai"
      description="Informasi sensitif ini hanya tersedia bagi HRD dan Superadmin."
    >
      <DetailRows
        items={(profile.bankAccounts || []).map((item) => ({
          key: item.id,
          title: `${item.bank_name} · ${item.account_number}`,
          description: `Atas nama ${item.account_holder}`,
          action: item.is_primary ? (
            <CompactInfoChip label="Rekening utama" tone="success" />
          ) : null,
        }))}
        emptyText="Belum ada rekening pegawai yang dicatat."
      />
    </ProfileSection>
  );
}

/** Kompetensi menyatukan pendidikan, keahlian, dan sertifikasi dalam satu konteks. */
export function EmployeeCompetencyDetails({ profile, organizationId }) {
  const fileAction = (fileId, label) =>
    fileId ? (
      <Button
        size="small"
        icon={<FileTextOutlined />}
        href={`/api/uploads/${fileId}?organizationId=${organizationId}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </Button>
    ) : null;
  return (
    <Box sx={{ display: "grid", gap: 3.5 }}>
      <ProfileSection icon={<BookOutlined />} title="Pendidikan">
        <DetailRows
          items={(profile.educations || []).map((item) => ({
            key: item.id,
            title: `${item.education_level}${item.field_of_study ? ` · ${item.field_of_study}` : ""}`,
            description: `${item.institution || "Institusi belum dicatat"}${item.graduation_year ? ` · Lulus ${item.graduation_year}` : ""}`,
            action: fileAction(item.certificate_file_id, "Dokumen ijazah"),
          }))}
          emptyText="Belum ada riwayat pendidikan yang dicatat."
        />
      </ProfileSection>
      <ProfileSection icon={<ToolOutlined />} title="Keahlian">
        <DetailRows
          items={(profile.skills || []).map((item) => ({
            key: item.id,
            title: item.skill_name,
            description: [item.proficiency_level || "Tingkat keahlian belum ditentukan", item.notes]
              .filter(Boolean)
              .join(" · "),
          }))}
          emptyText="Belum ada keahlian yang dicatat."
        />
      </ProfileSection>
      <ProfileSection icon={<SafetyCertificateOutlined />} title="Sertifikasi">
        <DetailRows
          items={(profile.certifications || []).map((item) => ({
            key: item.id,
            title: item.certification_name,
            description: [
              item.issuer || "Penerbit belum dicatat",
              item.credential_no,
              item.issued_at ? `Terbit ${formatProfileDate(item.issued_at)}` : null,
              item.expires_at ? `Berakhir ${formatProfileDate(item.expires_at)}` : null,
            ]
              .filter(Boolean)
              .join(" · "),
            action: fileAction(item.certificate_file_id, "Dokumen sertifikat"),
          }))}
          emptyText="Belum ada sertifikasi yang dicatat."
        />
      </ProfileSection>
    </Box>
  );
}
