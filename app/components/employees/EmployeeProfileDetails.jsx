"use client";

import { Button } from "antd";
import {
  BankOutlined,
  ContactsOutlined,
  EyeOutlined,
  LinkOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Box, useTheme } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import { InfoFieldGrid, InfoField } from "./EmployeeDetailSections";
import AppIconTile from "@/app/components/icons/AppIconTile";
import { formatDependentRelationship } from "@/lib/employees/dependentRelationships";
import { isEducationLevelWithoutDetails } from "@/lib/employees/profileOptions";

/** Tanggal profil memakai locale Indonesia dan tetap aman untuk nilai kosong. */
function formatProfileDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
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
export function ProfileSection({
  icon,
  title,
  description,
  children,
  panel = false,
  raisedIcon = false,
}) {
  const theme = useTheme();
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{
        minWidth: 0,
        ...(panel
          ? {
              p: { xs: 2, sm: 3 },
              border: `1px solid ${theme.ui.panelBorderSubtle}`,
              borderRadius: 2,
              background: theme.ui.employeeSummary.panelBackground,
              boxShadow: theme.ui.employeeSummary.panelShadow,
            }
          : {}),
      }}
    >
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
        {icon ? (
          panel || raisedIcon ? (
            <AppIconTile
              icon={icon}
              size={36}
              iconSize={18}
              sx={{
                boxShadow: theme.ui.employeeSummary.iconShadow,
                "& .anticon": { fontSize: 18, lineHeight: 0 },
              }}
            />
          ) : (
            <Box sx={{ color: theme.palette.primary.main, fontSize: 17 }}>{icon}</Box>
          )
        ) : null}
        <Box sx={{ minWidth: 0 }}>
          <FontStyle component="h3" fontSize={14} fontWeight={700}>
            {title}
          </FontStyle>
          {description ? (
            <FontStyle
              fontSize={raisedIcon ? 12.5 : 11.5}
              explanation={raisedIcon}
              sx={{
                mt: raisedIcon ? 0.5 : 0.25,
                color: raisedIcon ? theme.palette.text.secondary : theme.ui.mutedText,
              }}
            >
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
function DetailRows({ items, emptyText, readable = false }) {
  const theme = useTheme();
  if (!items?.length)
    return (
      <FontStyle fontSize={readable ? 13 : 12.5} sx={{ color: theme.ui.mutedText }}>
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
            <FontStyle
              fontSize={readable ? 14 : 12.5}
              fontWeight={700}
              sx={{ overflowWrap: "anywhere" }}
            >
              {item.title}
            </FontStyle>
            {item.description ? (
              <FontStyle
                fontSize={readable ? 12.5 : 11.5}
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
export function EmployeeRelatedSummary({ profile, embedded = false, panel = false }) {
  const theme = useTheme();
  const sections = (
    <>
      <ProfileSection icon={<TeamOutlined />} title="Keluarga dan tanggungan" panel={panel}>
        <DetailRows
          readable={panel}
          items={(profile.dependents || []).map((item) => ({
            key: item.id,
            title: item.full_name,
            description: [
              formatDependentRelationship(item.relationship),
              item.birth_date ? `Lahir ${formatProfileDate(item.birth_date)}` : null,
              item.is_dependent ? "Tanggungan" : null,
              item.notes,
            ]
              .filter(Boolean)
              .join(" · "),
          }))}
          emptyText="Belum ada data keluarga atau tanggungan."
        />
      </ProfileSection>
      <ProfileSection icon={<ContactsOutlined />} title="Kontak darurat" panel={panel}>
        <DetailRows
          readable={panel}
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
      <ProfileSection icon={<LinkOutlined />} title="Akun sosial" panel={panel}>
        <DetailRows
          readable={panel}
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

/** Permukaan kartu memakai kedalaman halus yang sama dengan Ringkasan pegawai. */
function EducationSurface({ children, component = "li", sx }) {
  const theme = useTheme();
  return (
    <Box
      component={component}
      sx={{
        minWidth: 0,
        p: 2,
        borderRadius: 2,
        border: `1px solid ${theme.ui.panelBorderSubtle}`,
        background: theme.ui.employeeSummary.panelBackground,
        display: "grid",
        gap: 2,
        alignContent: "start",
        "& dt": { color: theme.palette.text.secondary },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

function EducationEmptyState({ title, description }) {
  const theme = useTheme();
  return (
    <Box sx={{ py: 1 }}>
      <FontStyle fontSize={13} sx={{ color: theme.palette.text.secondary }}>
        {title}.
      </FontStyle>
      {description ? (
        <FontStyle fontSize={13} explanation sx={{ mt: 0.5, color: theme.palette.text.secondary }}>
          {description}
        </FontStyle>
      ) : null}
    </Box>
  );
}

/** Indikator tampilan memakai tanggal acuan organisasi, bukan tanggal browser. */
function certificationStatus(item, today) {
  if (!today) return null;
  if (item.expires_at && item.expires_at < today) return ["Sudah berakhir", "danger"];
  if (item.issued_at && item.issued_at > today) return ["Belum terbit", "info"];
  if (item.expires_at) return ["Masih berlaku", "success"];
  return null;
}

/** Identitas, fakta berlabel dan bukti dipisahkan agar setiap riwayat mudah dipindai. */
export function EmployeeEducationDetails({
  profile,
  organizationId,
  onPreview,
  canEdit = false,
  today,
}) {
  const theme = useTheme();
  // Urutkan salinan tanpa mengubah profil asal; tahun kosong tetap di akhir.
  const educationYear = (item) =>
    isEducationLevelWithoutDetails(item.education_level) || !item.graduation_year
      ? Infinity
      : Number(item.graduation_year);
  const educations = [...(profile.educations || [])].sort((a, b) => {
    const first = educationYear(a),
      second = educationYear(b);
    return first === second ? 0 : first < second ? -1 : 1;
  });
  const skills = profile.skills || [];
  const certifications = profile.certifications || [];
  const listSx = (count) => ({
    m: 0,
    p: 0,
    listStyle: "none",
    display: "grid",
    gridTemplateColumns: {
      xs: "minmax(0, 1fr)",
      lg: count > 1 ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
    },
    gap: 3,
    alignItems: "start",
  });
  const titleSx = {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 1.5,
    minWidth: 0,
  };
  const documentAction = (file, label) => (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        minWidth: 0,
        "& .ant-btn": { minHeight: 44, width: { xs: "100%", sm: "auto" } },
      }}
    >
      {file?.id ? (
        <Button
          type="primary"
          icon={<EyeOutlined />}
          aria-label={`Lihat ${label.toLowerCase()}`}
          onClick={() =>
            onPreview?.({
              imageUrl: `/api/uploads/${encodeURIComponent(file.id)}?organizationId=${encodeURIComponent(organizationId)}`,
              title: label,
              alt: label,
            })
          }
        >
          Lihat {label.toLowerCase()}
        </Button>
      ) : (
        <FontStyle fontSize={13} sx={{ mr: "auto", color: theme.palette.text.secondary }}>
          {label} belum diunggah.
        </FontStyle>
      )}
    </Box>
  );
  return (
    <Box sx={{ display: "grid", gap: 4 }}>
      <ProfileSection
        title="Riwayat pendidikan"
        description="Dari tahun lulus paling awal. Riwayat tanpa tahun lulus ditampilkan terakhir."
      >
        {educations.length ? (
          <Box
            component="ol"
            aria-label="Riwayat pendidikan pegawai"
            sx={{ m: 0, p: 0, listStyle: "none" }}
          >
            {educations.map((item, index) => {
              const withoutDetails = isEducationLevelWithoutDetails(item.education_level);
              return (
                <Box
                  component="li"
                  key={item.id}
                  sx={{
                    position: "relative",
                    pl: { xs: 3, sm: 4 },
                    pb: index === educations.length - 1 ? 0 : 3,
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      left: 4,
                      top: 8,
                      bottom: 0,
                      width: "1px",
                      bgcolor: theme.ui.panelBorderSubtle,
                      display: index === educations.length - 1 ? "none" : "block",
                    },
                    "&::after": {
                      content: '""',
                      position: "absolute",
                      left: 0,
                      top: 6,
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      bgcolor: theme.palette.primary.main,
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) auto" },
                      gap: 2,
                      alignItems: "center",
                      py: 0.5,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      {!withoutDetails ? (
                        <FontStyle
                          fontSize={12}
                          sx={{ color: theme.palette.text.secondary, mb: 1 }}
                        >
                          {item.graduation_year
                            ? `Lulus ${item.graduation_year}`
                            : "Tahun lulus belum diisi"}
                          {item.education_level ? ` · ${item.education_level}` : ""}
                        </FontStyle>
                      ) : null}
                      <Box sx={titleSx}>
                        <FontStyle
                          component="h4"
                          fontSize={15}
                          fontWeight={700}
                          sx={{ overflowWrap: "anywhere" }}
                        >
                          {withoutDetails
                            ? item.education_level
                            : item.institution || "Sekolah atau perguruan tinggi belum diisi"}
                        </FontStyle>
                        {item.is_highest && !withoutDetails ? (
                          <CompactInfoChip label="Pendidikan tertinggi" tone="success" />
                        ) : null}
                      </Box>
                      {!withoutDetails ? (
                        <Box sx={{ mt: 1.5 }}>
                          <InfoField
                            label="Program studi / jurusan"
                            value={item.field_of_study}
                            readable
                          />
                        </Box>
                      ) : null}
                    </Box>
                    {!withoutDetails ? documentAction(item.certificate_file, "Ijazah") : null}
                  </Box>
                </Box>
              );
            })}
          </Box>
        ) : (
          <EducationEmptyState
            title="Belum ada riwayat pendidikan"
            description={canEdit ? "Lengkapi melalui Edit profil." : null}
          />
        )}
      </ProfileSection>

      <ProfileSection title="Keahlian" description="Kemampuan dan tingkat penguasaan.">
        {skills.length ? (
          <Box component="ul" aria-label="Keahlian pegawai" sx={listSx(skills.length)}>
            {skills.map((item) => (
              <EducationSurface key={item.id}>
                <FontStyle component="h4" fontSize={16} fontWeight={700}>
                  {item.skill_name || "Nama keahlian belum diisi"}
                </FontStyle>
                <InfoField
                  label="Tingkat penguasaan"
                  value={
                    PROFICIENCY_LABELS[String(item.proficiency_level || "").toLowerCase()] ||
                    item.proficiency_level
                  }
                  readable
                />
                {item.notes ? <InfoField label="Catatan" value={item.notes} readable /> : null}
              </EducationSurface>
            ))}
          </Box>
        ) : (
          <EducationEmptyState
            title="Belum ada keahlian yang dicatat"
            description={canEdit ? "Lengkapi melalui Edit profil." : null}
          />
        )}
      </ProfileSection>

      <ProfileSection title="Sertifikasi" description="Data dan masa berlaku sertifikat.">
        {certifications.length ? (
          <Box component="ul" aria-label="Sertifikasi pegawai" sx={listSx(certifications.length)}>
            {certifications.map((item) => {
              const status = certificationStatus(item, today);
              return (
                <EducationSurface key={item.id}>
                  <Box sx={titleSx}>
                    <FontStyle component="h4" fontSize={16} fontWeight={700}>
                      {item.certification_name || "Nama sertifikat belum diisi"}
                    </FontStyle>
                    {status ? <CompactInfoChip label={status[0]} tone={status[1]} /> : null}
                  </Box>
                  <InfoFieldGrid
                    items={[
                      ["Penerbit", item.issuer],
                      ["Nomor sertifikat", item.credential_no],
                      ["Tanggal terbit", formatProfileDate(item.issued_at)],
                      [
                        "Berlaku sampai",
                        formatProfileDate(item.expires_at) || "Tanggal akhir tidak dicatat",
                      ],
                    ]}
                  />
                  {documentAction(item.certificate_file, "Sertifikat")}
                </EducationSurface>
              );
            })}
          </Box>
        ) : (
          <EducationEmptyState
            title="Belum ada sertifikasi yang dicatat"
            description={canEdit ? "Lengkapi melalui Edit profil." : null}
          />
        )}
      </ProfileSection>
    </Box>
  );
}
