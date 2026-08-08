"use client";

import React from "react";
import {
  Box,
  Divider,
  IconButton,
  Modal,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Icon } from "@iconify/react";

/**
 * AppModal adalah shell modal umum untuk seluruh aplikasi.
 * Komponen ini hanya mengatur frame, header, backdrop, responsivitas,
 * dan area konten agar modal detail, form, maupun konfirmasi punya fondasi UI
 * yang konsisten tanpa menggandakan styling di banyak file.
 */
export default function AppModal({
  open,
  title,
  titleDescription,
  icon = "solar:document-text-bold-duotone",
  width = 720,
  maxHeight = "92vh",
  contentSx,
  showCloseButton = true,
  onClose,
  children,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery("(max-width:700px)");

  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 1.25, sm: 2 },
        minHeight: "100dvh",
      }}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor:
              theme.palette.mode === "dark"
                ? "rgba(0,0,0,0.56)"
                : "rgba(15,23,42,0.18)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          },
        },
      }}
    >
      <Box
        sx={{
          width: isMobile ? "100%" : width,
          maxWidth: "100%",
          maxHeight,
          overflowY: "auto",
          bgcolor: theme.ui?.menuPaperBg || theme.palette.background.paper,
          color: "text.primary",
          border: `1px solid ${theme.ui?.dashboardCardBorder || theme.palette.divider}`,
          borderRadius: { xs: 2.25, sm: 3 },
          boxShadow: theme.ui?.shellShadow || 24,
          outline: "none",
          scrollbarColor:
            theme.palette.mode === "dark"
              ? "#ff9800 rgba(255, 152, 0, 0.14)"
              : "#d1d5db rgba(17, 24, 39, 0.07)",
          scrollbarWidth: "thin",
          "&::-webkit-scrollbar": {
            width: 9,
            height: 9,
          },
          "&::-webkit-scrollbar-track": {
            bgcolor:
              theme.palette.mode === "dark"
                ? "rgba(255,152,0,0.08)"
                : "rgba(17,24,39,0.06)",
            borderRadius: 999,
          },
          "&::-webkit-scrollbar-thumb": {
            borderRadius: 999,
            border:
              theme.palette.mode === "dark"
                ? "2px solid rgba(20,20,20,0.85)"
                : "2px solid rgba(255,255,255,0.96)",
            background:
              theme.palette.mode === "dark"
                ? "linear-gradient(180deg, #ffb74d, #ff9800)"
                : "linear-gradient(180deg, #d1d5db, #9ca3af)",
          },
        }}
      >
        <Box sx={{ p: { xs: 2, sm: 2.5 }, pb: 1.5 }}>
          <Stack direction="row" alignItems="flex-start" spacing={1.5}>
            <Box
              sx={{
                width: 42,
                height: 42,
                flex: "0 0 auto",
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                color: theme.palette.primary.main,
                bgcolor:
                  theme.palette.mode === "dark"
                    ? "rgba(255,152,0,0.14)"
                    : "rgba(230,9,9,0.10)",
              }}
            >
              <Icon icon={icon} fontSize={23} />
            </Box>

            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                sx={{
                  fontFamily: "Poppins",
                  fontWeight: 700,
                  fontSize: { xs: 18, sm: 21 },
                  lineHeight: 1.25,
                }}
              >
                {title}
              </Typography>
              {titleDescription && (
                <Typography
                  sx={{
                    color: theme.ui?.mutedText || "text.secondary",
                    fontFamily: "Poppins",
                    fontWeight: 600,
                    fontSize: 12,
                    lineHeight: 1.6,
                    mt: 0.35,
                  }}
                >
                  {titleDescription}
                </Typography>
              )}
            </Box>

            {showCloseButton && (
              <IconButton onClick={onClose} sx={{ color: theme.ui?.mutedText }}>
                <Icon icon="line-md:close" fontSize={22} />
              </IconButton>
            )}
          </Stack>
        </Box>

        <Divider sx={{ borderColor: theme.ui?.dashboardCardBorder }} />

        <Box sx={{ p: { xs: 2, sm: 2.5 }, ...contentSx }}>{children}</Box>
      </Box>
    </Modal>
  );
}
