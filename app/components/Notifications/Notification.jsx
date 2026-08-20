"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Snackbar from "@mui/material/Snackbar";
import { alpha, useTheme } from "@mui/material/styles";
import { Icon } from "@iconify/react";
import FontStyle from "../font-style/FontStyle";

const DEFAULT_AUTO_HIDE_DURATION = 4000;

const severityConfig = {
  success: {
    title: "Berhasil",
    icon: "solar:check-circle-bold",
  },
  error: {
    title: "Gagal",
    icon: "solar:close-circle-bold",
  },
  warning: {
    title: "Perhatian",
    icon: "solar:danger-triangle-bold",
  },
  info: {
    title: "Informasi",
    icon: "solar:info-circle-bold",
  },
};

/**
 * Picks the visual treatment for each snackbar severity.
 * Palette colors stay sourced from the app theme so every severity keeps the
 * same semantic meaning without hardcoded one-off component colors.
 */
const getSeverityStyle = (theme, severity) => {
  const paletteColor = theme.palette[severity]?.main || theme.palette.info.main;

  return {
    main: paletteColor,
    softBg: alpha(paletteColor, 0.1),
    iconBg: alpha(paletteColor, 0.14),
    border: alpha(paletteColor, 0.24),
  };
};

/**
 * Reusable app snackbar.
 * It keeps the existing API used across pages, while providing a modern custom
 * surface that is responsive and readable for longer messages.
 */
export default function Notification({
  open,
  message,
  severity = "info",
  title,
  onClose,
  autoHideDuration = DEFAULT_AUTO_HIDE_DURATION,
  anchorOrigin = { vertical: "top", horizontal: "center" },
  ...props
}) {
  const theme = useTheme();
  const config = severityConfig[severity] || severityConfig.info;
  const severityStyle = getSeverityStyle(theme, severity);
  const resolvedTitle = title || config.title;

  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={anchorOrigin}
      sx={{
        width: "100%",
        px: { xs: 1.5, sm: 2 },
        top: { xs: 12, sm: 20 },
        zIndex: theme.zIndex.drawer + 1000001,
        pointerEvents: "none",
        "& .MuiSnackbarContent-root": {
          width: "100%",
        },
      }}
      {...props}
    >
      <Alert
        role="status"
        severity={severity}
        icon={false}
        onClose={onClose}
        variant="outlined"
        sx={{
          width: { xs: "calc(100vw - 24px)", sm: "fit-content" },
          minWidth: { xs: 0, sm: 320 },
          maxWidth: { xs: "calc(100vw - 24px)", sm: 520 },
          p: 0,
          color: "text.primary",
          bgcolor: theme.ui.notificationBg,
          border: `1px solid ${severityStyle.border}`,
          borderLeft: `5px solid ${severityStyle.main}`,
          borderRadius: 3,
          boxShadow: theme.ui.notificationShadow,
          overflow: "hidden",
          pointerEvents: "auto",
          backdropFilter: "blur(18px)",
          "& .MuiAlert-message": {
            width: "100%",
            p: 0,
          },
          "& .MuiAlert-action": {
            alignSelf: "stretch",
            alignItems: "center",
            p: 0,
            pr: 1.75,
            pl: 0.5,
            color: theme.palette.text.secondary,
          },
          "& .MuiAlert-action .MuiIconButton-root": {
            width: 34,
            height: 34,
            color: theme.palette.text.secondary,
            border: `1px solid ${alpha(theme.palette.text.primary, 0.12)}`,
            bgcolor: alpha(theme.palette.text.primary, 0.04),
          },
          "& .MuiIconButton-root:hover": {
            bgcolor: alpha(severityStyle.main, 0.1),
            color: severityStyle.main,
            borderColor: alpha(severityStyle.main, 0.24),
          },
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "40px minmax(0, 1fr)",
            gap: 1.25,
            alignItems: "center",
            minWidth: 0,
            px: { xs: 1.25, sm: 1.5 },
            py: { xs: 1.15, sm: 1.25 },
            background: `linear-gradient(90deg, ${severityStyle.softBg}, transparent 72%)`,
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2.25,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: severityStyle.main,
              bgcolor: severityStyle.iconBg,
              flexShrink: 0,
            }}
          >
            <Icon icon={config.icon} fontSize={22} />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <FontStyle
              fontSize={13}
              fontWeight={700}
              sx={{
                lineHeight: 1.25,
                color: severityStyle.main,
              }}
            >
              {resolvedTitle}
            </FontStyle>
            <FontStyle
              fontWeight={500}
              sx={{
                mt: 0.35,
                fontSize: { xs: 12.5, sm: 13 },
                lineHeight: 1.45,
                color: theme.palette.text.primary,
                overflowWrap: "anywhere",
              }}
            >
              {message}
            </FontStyle>
          </Box>
        </Box>
      </Alert>
    </Snackbar>
  );
}
