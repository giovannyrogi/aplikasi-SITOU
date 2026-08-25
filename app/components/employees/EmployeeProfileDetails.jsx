"use client";

import { Button } from "antd";
import {
  BankOutlined,
  BookOutlined,
  CalendarOutlined,
  ContactsOutlined,
  EyeOutlined,
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

/** Membatasi tautan sosial hanya pada URL HTTP(S) agar data profil tidak menjalankan skema berbahaya. */
function getSafeExternalUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
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
export function EmployeeRelatedSummary({ profile, embedded = false }) {
  const theme = useTheme();
  const sections = (
    <>
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
          items={(profile.socialAccounts || []).map((item) => {
            const externalUrl = getSafeExternalUrl(item.handle_or_url);
            return {
              key: item.id,
              title: item.platform,
              description: externalUrl ? (
                <Box
                  component="a"
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    color: theme.palette.primary.main,
                    textDecoration: "underline",
                    overflowWrap: "anywhere",
                    "&:hover": { color: theme.palette.primary.dark },
                  }}
                >
                  {item.handle_or_url}
                </Box>
              ) : (
                item.handle_or_url
              ),
            };
          })}
          emptyText="Belum ada akun sosial yang dicatat."
        />
      </ProfileSection>
    </>
  );

  if (embedded) return sections;

  return (
    <Box
      sx={{
        mt: { xs: 5, lg: 6 },
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" },
        gap: { xs: 4, lg: 5 },
      }}
    >
      {sections}
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

const PROFICIENCY_LABELS = {
  pemula: "Pemula",
  dasar: "Dasar",
  menengah: "Menengah",
  mahir: "Mahir",
  ahli: "Ahli",
};

/** Mengubah tingkat keahlian tersimpan menjadi label Bahasa Indonesia yang konsisten. */
function getProficiencyLabel(value) {
  if (!value) return "Tingkat belum ditentukan";
  return PROFICIENCY_LABELS[String(value).toLowerCase()] || value;
}

/** Empty state ringan menjaga setiap kelompok tetap informatif tanpa menambah card bertumpuk. */
function EducationEmptyState({ icon, title, description }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.5,
        p: { xs: 2, sm: 2.5 },
        bgcolor: theme.ui.panelSubtleBg,
        border: `1px dashed ${theme.ui.panelBorder}`,
        borderRadius: 1,
      }}
    >
      <Box sx={{ color: theme.ui.mutedText, fontSize: 20, lineHeight: 1 }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <FontStyle fontSize={13} fontWeight={700}>
          {title}
        </FontStyle>
        <FontStyle fontSize={11.5} sx={{ mt: 0.5, color: theme.ui.mutedText }}>
          {description}
        </FontStyle>
      </Box>
    </Box>
  );
}

/** Pendidikan menyatukan riwayat sekolah, keahlian, dan sertifikasi secara mudah dipindai. */
export function EmployeeEducationDetails({ profile, organizationId, onPreview }) {
  const theme = useTheme();
  const educations = profile.educations || [];
  const skills = profile.skills || [];
  const certifications = profile.certifications || [];

  /** Bukti visual selalu dibuka melalui ImagePreviewModal terpusat. */
  const previewAction = (file, label) =>
    file?.id ? (
      <Box
        sx={{
          "& .ant-btn": {
            minHeight: 40,
            px: 2,
            color: theme.palette.text.primary,
            borderColor: theme.ui.panelBorder,
            bgcolor: theme.palette.background.paper,
            fontWeight: 600,
          },
          "& .ant-btn:hover": {
            color: theme.palette.primary.main,
            borderColor: theme.palette.primary.main,
            bgcolor: theme.ui.panelAccentBg,
          },
        }}
      >
        <Button
          icon={<EyeOutlined />}
          onClick={() =>
            onPreview?.({
              imageUrl: `/api/uploads/${file.id}?organizationId=${organizationId}`,
              title: label,
              alt: file.original_name || label,
            })
          }
        >
          Lihat {label.toLowerCase()}
        </Button>
      </Box>
    ) : null;

  return (
    <Box sx={{ display: "grid", gap: { xs: 4.5, md: 6 } }}>
      <ProfileSection
        icon={<BookOutlined />}
        title="Riwayat pendidikan"
        description="Urutan pendidikan formal, institusi, program studi, tahun kelulusan, dan ijazah pegawai."
      >
        {educations.length ? (
          <Box
            component="ol"
            aria-label="Riwayat pendidikan pegawai"
            sx={{ m: 0, p: 0, listStyle: "none" }}
          >
            {educations.map((item) => (
              <Box
                component="li"
                key={item.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "minmax(0, 1fr)",
                    sm: "minmax(0, 1fr) auto",
                  },
                  alignItems: "start",
                  columnGap: 3,
                  rowGap: 1,
                  py: { xs: 2, sm: 2.5 },
                  borderBottom: `1px solid ${theme.ui.panelBorderSubtle}`,
                  "&:first-of-type": { pt: 0 },
                  "&:last-of-type": { borderBottom: 0, pb: 0 },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <FontStyle fontSize={14} fontWeight={700}>
                      {item.education_level || "Jenjang belum ditentukan"}
                    </FontStyle>
                    {item.is_highest ? (
                      <CompactInfoChip label="Pendidikan tertinggi" tone="info" />
                    ) : null}
                  </Box>
                  <FontStyle fontSize={12.5} fontWeight={600} sx={{ mt: 0.75 }}>
                    {item.institution || "Nama institusi belum dicatat"}
                  </FontStyle>
                  <Box
                    sx={{
                      mt: 0.75,
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      flexWrap: "wrap",
                    }}
                  >
                    <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
                      {item.field_of_study || "Program studi belum dicatat"}
                    </FontStyle>
                    <CalendarOutlined style={{ color: theme.ui.mutedText }} />
                    <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
                      {item.graduation_year
                        ? `Lulus tahun ${item.graduation_year}`
                        : "Tahun lulus belum dicatat"}
                    </FontStyle>
                  </Box>
                </Box>
                <Box sx={{ justifySelf: { sm: "end" } }}>
                  {previewAction(item.certificate_file, "Ijazah")}
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <EducationEmptyState
            icon={<BookOutlined />}
            title="Riwayat pendidikan belum tersedia"
            description="Tambahkan jenjang pendidikan melalui Kelola profil lengkap."
          />
        )}
      </ProfileSection>

      <ProfileSection
        icon={<ToolOutlined />}
        title="Keahlian"
        description="Kemampuan yang tercatat beserta tingkat penguasaan dan catatan pendukungnya."
      >
        {skills.length ? (
          <Box
            component="ul"
            sx={{
              m: 0,
              p: 0,
              listStyle: "none",
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
              columnGap: { lg: 5 },
            }}
          >
            {skills.map((item) => (
              <Box
                component="li"
                key={item.id}
                sx={{
                  minWidth: 0,
                  py: 1.75,
                  borderBottom: `1px solid ${theme.ui.panelBorderSubtle}`,
                  "&:nth-last-of-type(-n+2)": {
                    borderBottom: { lg: 0 },
                  },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1.5,
                    }}
                  >
                    <FontStyle fontSize={13.5} fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
                      {item.skill_name}
                    </FontStyle>
                    <CompactInfoChip
                      label={getProficiencyLabel(item.proficiency_level)}
                      tone="info"
                    />
                  </Box>
                  <FontStyle fontSize={11.5} sx={{ mt: 0.75, color: theme.ui.mutedText }}>
                    {item.notes || "Belum ada catatan tambahan untuk keahlian ini."}
                  </FontStyle>
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <EducationEmptyState
            icon={<ToolOutlined />}
            title="Keahlian belum tersedia"
            description="Tambahkan kemampuan dan tingkat penguasaan melalui Kelola profil lengkap."
          />
        )}
      </ProfileSection>

      <ProfileSection
        icon={<SafetyCertificateOutlined />}
        title="Sertifikasi"
        description="Kredensial profesional, lembaga penerbit, nomor kredensial, masa berlaku, dan bukti sertifikat."
      >
        {certifications.length ? (
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
            {certifications.map((item) => {
              const expired =
                item.expires_at && item.expires_at < new Date().toISOString().slice(0, 10);
              return (
                <Box
                  component="li"
                  key={item.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "minmax(0, 1fr)",
                      sm: "minmax(0, 1fr) auto",
                    },
                    alignItems: "start",
                    columnGap: 3,
                    rowGap: 1,
                    py: { xs: 2, sm: 2.5 },
                    borderBottom: `1px solid ${theme.ui.panelBorderSubtle}`,
                    "&:first-of-type": { pt: 0 },
                    "&:last-of-type": { borderBottom: 0, pb: 0 },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                      <FontStyle fontSize={13} fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
                        {item.certification_name}
                      </FontStyle>
                      <CompactInfoChip
                        label={expired ? "Kedaluwarsa" : "Berlaku"}
                        tone={expired ? "danger" : "success"}
                      />
                    </Box>
                    <FontStyle fontSize={12} sx={{ mt: 0.75, color: theme.ui.mutedText }}>
                      Penerbit: {item.issuer || "Belum dicatat"}
                    </FontStyle>
                    <FontStyle fontSize={11.5} sx={{ mt: 0.35, color: theme.ui.mutedText }}>
                      Nomor kredensial: {item.credential_no || "Belum dicatat"}
                    </FontStyle>
                    <FontStyle fontSize={11.5} sx={{ mt: 0.65, color: theme.ui.mutedText }}>
                      {item.issued_at
                        ? `Terbit ${formatProfileDate(item.issued_at)}`
                        : "Tanggal terbit belum dicatat"}
                      {item.expires_at
                        ? ` · Berakhir ${formatProfileDate(item.expires_at)}`
                        : " · Tanpa tanggal kedaluwarsa"}
                    </FontStyle>
                  </Box>
                  <Box sx={{ justifySelf: { sm: "end" } }}>
                    {previewAction(item.certificate_file, "Sertifikat")}
                  </Box>
                </Box>
              );
            })}
          </Box>
        ) : (
          <EducationEmptyState
            icon={<SafetyCertificateOutlined />}
            title="Sertifikasi belum tersedia"
            description="Tambahkan kredensial dan bukti sertifikat melalui Kelola profil lengkap."
          />
        )}
      </ProfileSection>
    </Box>
  );
}
