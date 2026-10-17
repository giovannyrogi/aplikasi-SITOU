"use client";
import { useState } from "react";
import Link from "next/link";
import { Box, Button, useMediaQuery, useTheme } from "@mui/material";
import AppIcon from "@/app/components/icons/AppIcon";
import PhotoAvatar from "@/app/components/data-display/PhotoAvatar";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import FontStyle from "@/app/components/font-style/FontStyle";
import { EMPLOYEE_STATUS_PRESENTATION } from "@/app/components/employees/employeeStatus";
import { ROLE_LABELS } from "@/app/constants/roles";

/** Header identitas bersama; informasi kepegawaian hanya ditampilkan bila profil tertaut. */
export default function EmployeeProfileBanner({ data, user, accountProfile }) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [preview, setPreview] = useState(null);
  const linked = Boolean(data?.profile || user?.identity_source === "employee" && user?.employee_id);
  const name = data?.profile?.name || accountProfile?.full_name ||
    (user?.identity_source === "employee" ? user?.display_name : null) ||
    accountProfile?.platform_full_name || user?.display_name || user?.username || "Pengguna";
  const nip = data?.profile?.nip || accountProfile?.employee_no;
  const statusKey = data?.employment?.status || accountProfile?.employment_status || user?.employment_status;
  const status = EMPLOYEE_STATUS_PRESENTATION[statusKey]?.[0];
  const photoUrl = data?.profile?.photoUrl || (linked && user?.profile_photo_file_id
    ? user.role_code === "employee"
      ? `/api/uploads/profile_self?photoVersion=${encodeURIComponent(user.profile_photo_file_id)}`
      : `/api/uploads/${encodeURIComponent(user.profile_photo_file_id)}?organizationId=${encodeURIComponent(user.organization_id)}`
    : undefined);
  const badges = linked
    ? [status, data?.employment?.type || accountProfile?.employment_type_name]
    : [ROLE_LABELS[user?.role_code], user?.organization_name];
  return (
    <>
      <Box
        component="section"
        aria-label={linked ? "Profil pegawai" : "Profil akun"}
        sx={{
          position: "relative",
          overflow: "hidden",
          p: { xs: 3, sm: 4 },
          borderRadius: 3,
          background: theme.ui.featurePanelBg,
          color: theme.ui.featureText,
          boxShadow: theme.ui.panelShadow,
          "&:after": {
            content: '\"\"',
            position: "absolute",
            width: 360,
            height: 360,
            borderRadius: "50%",
            border: `48px solid ${theme.ui.featureRingBorder}`,
            right: -80,
            top: -120,
            pointerEvents: "none",
          },
        }}
      >
        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            gap: 3,
            flexWrap: "wrap",
          }}
        >
          <Box
            sx={{
              p: "3px",
              display: "inline-flex",
              borderRadius: "50%",
              bgcolor: theme.ui.featureText,
            }}
          >
            <PhotoAvatar
              name={name}
              photoUrl={photoUrl}
              size={mobile ? 80 : 96}
              photoLabel="Pas foto"
              onPreview={setPreview}
            />
          </Box>
          <Box sx={{ flex: "1 1 220px", minWidth: 0 }}>
            <FontStyle
              fontSize={11}
              fontWeight={600}
              sx={{ mb: 1, color: "inherit", letterSpacing: 1 }}
            >
              {linked ? "PROFIL PEGAWAI" : "PROFIL AKUN"}
            </FontStyle>
            <FontStyle
              fontSize={{ xs: 20, sm: 24 }}
              fontWeight={700}
              sx={{ color: "inherit", overflowWrap: "anywhere" }}
            >
              {name}
            </FontStyle>
            <FontStyle fontSize={15} fontWeight={600} sx={{ mt: 1, color: theme.ui.featureText }}>
              {linked ? `NIP ${nip || "belum tersedia"}` : user?.role_code === "superadmin"
                ? "Administrasi platform SITOU" : "Belum tertaut ke profil pegawai"}
            </FontStyle>
            <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
              {badges.filter(Boolean).map((text, index) => (
                <Box
                  key={index}
                  sx={{
                    py: 0.5,
                    px: 1,
                    borderRadius: 1,
                    bgcolor: theme.ui.featureCardBg,
                    border: `1px solid ${theme.ui.featureBorder}`,
                    maxWidth: "100%",
                  }}
                >
                  <FontStyle fontSize={11} sx={{ color: "inherit", overflowWrap: "anywhere" }}>
                    {text}
                  </FontStyle>
                </Box>
              ))}
            </Box>
          </Box>
          <Button
            component={Link}
            href="/profile"
            variant="outlined"
            endIcon={<AppIcon icon="action:view-all" width={16} />}
            sx={{
              minHeight: 44,
              width: { xs: "100%", sm: "auto" },
              color: "inherit",
              borderColor: theme.ui.featureBorder,
              "&:hover": { borderColor: theme.ui.featureText, bgcolor: theme.ui.featureCardBg },
            }}
          >
            Lihat profil saya
          </Button>
        </Box>
      </Box>
      <ImagePreviewModal
        open={!!preview}
        imageUrl={preview?.imageUrl}
        alt={preview?.alt}
        title="Pas foto saya"
        onClose={() => setPreview(null)}
      />
    </>
  );
}
