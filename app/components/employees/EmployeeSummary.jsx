"use client";

import { Box, useMediaQuery, useTheme } from "@mui/material";
import { Button } from "antd";
import {
  ContactsOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  FileTextOutlined,
  IdcardOutlined,
  UserOutlined,
} from "@ant-design/icons";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import EmployeeAvatar from "./EmployeeAvatar";
import {
  InfoFieldGrid as SummaryFacts,
  SummarySection,
  VisualIdentity,
} from "./EmployeeDetailSections";
import { EmployeeRelatedSummary } from "./EmployeeProfileDetails";

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

/** Ringkasan memakai data berizin dan proyeksi lifecycle dari detail pegawai. */
export default function EmployeeSummary({
  employee,
  profile,
  organizationId,
  status,
  age,
  tenureText,
  finalEmploymentStatus,
  relationshipContract,
  relationshipEnd,
  formatDate,
  onPreview,
  onTerminationDetail,
}) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  const identifiers = profile.identifiers || [];
  const identityFiles = [
    [
      "Foto KTP",
      identifiers.find((item) => item.identifier_type === "ktp")?.document_file,
      "Foto KTP belum diunggah.",
    ],
    [
      "Foto Kartu Keluarga (KK)",
      identifiers.find((item) => item.identifier_type === "family_card")?.document_file,
      "Foto Kartu Keluarga belum diunggah.",
    ],
  ];
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <Box
        component="section"
        aria-label="Identitas pegawai"
        sx={{
          p: { xs: 2, sm: 3 },
          border: `1px solid ${theme.ui.panelBorderSubtle}`,
          borderTop: `3px solid ${theme.brand.primary}`,
          borderRadius: 2,
          background: theme.ui.employeeSummary.identityBackground,
          boxShadow: theme.ui.employeeSummary.identityShadow,
          minWidth: 0,
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1.2fr) minmax(0, 1fr)" },
          gap: 3,
          alignItems: "center",
          "& dt": { color: theme.palette.text.secondary },
        }}
      >
        <Box
          sx={{
            display: "flex",
            gap: { xs: 2, sm: 3 },
            alignItems: { xs: "flex-start", sm: "center" },
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              p: 0.5,
              display: "inline-flex",
              borderRadius: "50%",
              flexShrink: 0,
              bgcolor: theme.ui.employeeSummary.avatarBackground,
              boxShadow: theme.ui.employeeSummary.avatarShadow,
            }}
          >
            <EmployeeAvatar
              employee={{
                ...employee,
                organization_id: organizationId,
                profile_photo_file_id:
                  profile.profilePhoto?.id ||
                  profile.profilePhoto?.document_file_id ||
                  employee.profile_photo_file_id,
              }}
              size={mobile ? 72 : 96}
              onPreview={onPreview}
            />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <FontStyle
              component="h2"
              fontSize={{ xs: 20, sm: 22 }}
              fontWeight={700}
              sx={{ lineHeight: 1.45, color: theme.palette.text.primary }}
            >
              {employee.full_name}
            </FontStyle>
            <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap" }}>
              <CompactInfoChip label={status[0]} tone={status[1]} />
            </Box>
          </Box>
        </Box>
        <Box
          sx={{
            minWidth: 0,
            borderTop: { xs: `1px solid ${theme.ui.panelBorderSubtle}`, lg: "none" },
            borderLeft: { xs: "none", lg: `1px solid ${theme.ui.panelBorderSubtle}` },
            pt: { xs: 3, lg: 0 },
            pl: { lg: 3 },
          }}
        >
          <SummaryFacts
            items={[
              ["NIP", employee.employee_no],
              ["Nama panggilan", employee.preferred_name],
            ]}
          />
        </Box>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" },
          gap: 3,
          alignItems: "stretch",
        }}
      >
        <SummarySection
          icon={<EnvironmentOutlined />}
          title={finalEmploymentStatus ? "Penempatan" : "Penempatan aktif"}
          panel
          contentSx={{ display: "block" }}
        >
          <SummaryFacts
            items={[
              ["Lokasi", employee.location_name],
              ["Divisi & Unit", employee.unit_name],
              ["Jabatan", employee.position_name],
              ["Atasan langsung", employee.supervisor_name],
            ]}
          />
        </SummarySection>
        <SummarySection
          icon={<FileTextOutlined />}
          title="Hubungan kerja"
          panel
          contentSx={{ display: "block" }}
          action={
            finalEmploymentStatus ? (
              <Button
                aria-label="Lihat detail akhir hubungan kerja"
                icon={<EyeOutlined />}
                onClick={onTerminationDetail}
              >
                Lihat detail
              </Button>
            ) : null
          }
        >
          <SummaryFacts
            items={[
              ["Tanggal bergabung", formatDate(employee.joined_date)],
              ["Masa kerja", tenureText],
              ...(finalEmploymentStatus
                ? [
                    ["Status hubungan kerja", status[0]],
                    ["Tanggal berakhir", formatDate(employee.termination_date)],
                  ]
                : []),
              [
                finalEmploymentStatus ? "Jenis kepegawaian terakhir" : "Jenis kepegawaian",
                relationshipContract?.employment_type_name,
              ],
              [
                finalEmploymentStatus ? "Nomor kontrak terakhir" : "Nomor kontrak",
                relationshipContract?.contract_no,
              ],
              [
                finalEmploymentStatus ? "Mulai kontrak terakhir" : "Mulai kontrak",
                formatDate(relationshipContract?.start_date),
              ],
              ...(relationshipEnd
                ? [
                    [
                      relationshipEnd.label,
                      formatDate(relationshipEnd.value, "Tanggal akhir belum diisi"),
                    ],
                  ]
                : []),
            ]}
          />
        </SummarySection>
      </Box>

      <SummarySection
        icon={<UserOutlined />}
        title="Data pribadi"
        panel
        contentSx={{ display: "block" }}
      >
        <SummaryFacts
          columns={3}
          items={[
            ["NIK", employee.national_id],
            ["Tempat lahir", employee.birth_place],
            ["Tanggal lahir", formatDate(employee.birth_date)],
            [age.label, age.valid ? age.duration : age.message],
            ["Jenis kelamin", GENDER_LABELS[employee.gender] || employee.gender],
            [
              "Status perkawinan",
              MARITAL_STATUS_LABELS[employee.marital_status] || employee.marital_status,
            ],
            ["Agama", employee.religion],
            ["Golongan darah", employee.blood_type],
            ["Kewarganegaraan", employee.nationality],
          ]}
        />
      </SummarySection>

      <SummarySection
        icon={<ContactsOutlined />}
        title="Kontak dan alamat"
        panel
        contentSx={{ display: "block" }}
      >
        <SummaryFacts
          items={[
            ["Email pribadi", employee.personal_email],
            ["Nomor WhatsApp", employee.whatsapp],
            ["Alamat sesuai KTP", employee.ktp_address],
            ["Alamat domisili", employee.domicile_address],
          ]}
        />
      </SummarySection>

      <SummarySection
        icon={<IdcardOutlined />}
        title="Dokumen identitas"
        panel
        contentSx={{ display: "block" }}
      >
        <FontStyle fontSize={12} explanation sx={{ mb: 3, color: theme.palette.text.secondary }}>
          Pilih foto dokumen untuk memperbesar tampilannya.
        </FontStyle>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
            gap: 3,
          }}
        >
          {identityFiles.map(([title, file, emptyText]) => (
            <VisualIdentity
              key={title}
              title={title}
              file={file}
              aspectRatio="1.586 / 1"
              emptyText={emptyText}
              organizationId={organizationId}
              onPreview={onPreview}
              objectFit="contain"
              sx={{ maxWidth: 420 }}
            />
          ))}
        </Box>
      </SummarySection>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" },
          gap: 3,
          alignItems: "start",
        }}
      >
        <EmployeeRelatedSummary profile={profile} embedded panel />
      </Box>
    </Box>
  );
}
