"use client";

import { Box, LinearProgress, useTheme } from "@mui/material";
import AppIcon from "../icons/AppIcon";
import FontStyle from "../font-style/FontStyle";

/** Status hitungan mundur bersama untuk pengalihan sesi dan perubahan izin. */
export default function AccessCountdownPanel({
  secondsRemaining,
  destination,
  description,
  actionText,
  label = "Pengalihan otomatis",
  icon,
  totalSeconds = 5,
}) {
  const theme = useTheme();
  const seconds = Math.max(0, Math.min(totalSeconds, Number(secondsRemaining) || 0));
  return (
    <Box
      data-testid="access-countdown-panel"
      sx={{
        display: "grid",
        gap: 2,
        minWidth: 0,
        p: { xs: 2, sm: 2.5 },
        borderRadius: 2,
        border: "1px solid",
        borderColor: theme.ui.panelBorder,
        bgcolor: theme.ui.panelSubtleBg,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {icon ? (
          <Box
            sx={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              bgcolor: theme.status.info.background,
              color: theme.status.info.main,
            }}
          >
            <AppIcon icon={icon} fontSize={17} aria-hidden="true" />
          </Box>
        ) : null}
        <FontStyle fontSize={12} fontWeight={700} sx={{ color: theme.status.info.text }}>
          {label}
        </FontStyle>
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "72px minmax(0,1fr)" },
          alignItems: "center",
          gap: 2,
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            width: 72,
            height: 72,
            mx: { xs: "auto", sm: 0 },
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            color: theme.status.info.text,
            bgcolor: theme.palette.background.paper,
            border: "1px solid",
            borderColor: theme.status.info.border,
          }}
        >
          <Box sx={{ textAlign: "center" }}>
            <FontStyle fontSize={27} fontWeight={700} sx={{ lineHeight: 1 }}>
              {seconds}
            </FontStyle>
            <FontStyle fontSize={10} fontWeight={600} sx={{ mt: 0.5 }}>
              detik
            </FontStyle>
          </Box>
        </Box>
        <Box sx={{ minWidth: 0, textAlign: { xs: "center", sm: "left" } }}>
          <FontStyle fontSize={14} fontWeight={600}>
            {actionText || `Anda akan diarahkan ke ${destination}.`}
          </FontStyle>
          <FontStyle
            fontSize={12.5}
            sx={{ mt: 0.75, color: theme.ui.mutedText, lineHeight: 1.65 }}
          >
            {description}
          </FontStyle>
        </Box>
      </Box>
      <LinearProgress
        variant="determinate"
        value={((totalSeconds - seconds) / totalSeconds) * 100}
        aria-label={`${actionText ? "Pembaruan akses" : "Pengalihan"} dalam ${seconds} detik`}
        sx={{
          height: 6,
          borderRadius: 999,
          bgcolor: theme.status.info.background,
          "& .MuiLinearProgress-bar": {
            bgcolor: theme.status.info.main,
            borderRadius: 999,
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          },
        }}
      />
    </Box>
  );
}
