"use client";
import { useState } from "react";
import Link from "next/link";
import { Box, Button, useMediaQuery, useTheme } from "@mui/material";
import AppIcon from "@/app/components/icons/AppIcon";
import PhotoAvatar from "@/app/components/data-display/PhotoAvatar";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import FontStyle from "@/app/components/font-style/FontStyle";
import { EMPLOYEE_STATUS_PRESENTATION } from "@/app/components/employees/employeeStatus";

/** Profil pribadi bersama di atas tab Dashboard dan Inventaris. */
export default function EmployeeProfileBanner({ data }) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [preview, setPreview] = useState(null);
  const name = data.profile.name;
  const status = EMPLOYEE_STATUS_PRESENTATION[data.employment.status]?.[0] || "Belum tersedia";
  return (
    <>
      <Box
        component="section"
        aria-label="Profil pegawai"
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
              photoUrl={data.profile.photoUrl}
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
              PROFIL PEGAWAI
            </FontStyle>
            <FontStyle
              fontSize={{ xs: 20, sm: 24 }}
              fontWeight={700}
              sx={{ color: "inherit", overflowWrap: "anywhere" }}
            >
              {name}
            </FontStyle>
            <FontStyle fontSize={15} fontWeight={600} sx={{ mt: 1, color: theme.ui.featureText }}>
              NIP {data.profile.nip || "belum tersedia"}
            </FontStyle>
            <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
              {[status, data.employment.type].filter(Boolean).map((text, index) => (
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
