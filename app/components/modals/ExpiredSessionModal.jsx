"use client";

import { Box, LinearProgress, useTheme } from "@mui/material";
import { Button } from "antd";
import FontStyle from "../font-style/FontStyle";
import AppModal from "./AppModal";

export default function ExpiredSessionModal({ open, secondsRemaining = 5, onLogout }) {
  const theme = useTheme();
  const safeSeconds = Math.max(0, Math.min(5, Number(secondsRemaining) || 0));

  return (
    <AppModal
      open={open}
      title="Sesi login berakhir"
      description="Demi keamanan akun, Anda harus masuk kembali."
      icon="solar:shield-warning-bold-duotone"
      size="sm"
      showCloseButton={false}
      disableClose
      closeOnBackdrop={false}
      closeOnEscape={false}
      footer={
        <Button type="primary" onClick={onLogout}>
          Ke halaman login sekarang
        </Button>
      }
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "88px 1fr" },
          alignItems: "center",
          gap: 2,
          p: 2,
          borderRadius: 2,
          border: `1px solid ${theme.ui.navUserBorder}`,
          bgcolor: theme.ui.navUserBg,
        }}
      >
        <Box
          sx={{
            width: 84,
            height: 84,
            mx: { xs: "auto", sm: 0 },
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            color: theme.palette.primary.main,
            bgcolor: theme.palette.background.paper,
            border: `1px solid ${theme.ui.navUserBorder}`,
          }}
        >
          <Box sx={{ textAlign: "center" }}>
            <FontStyle fontSize={29} fontWeight={700} sx={{ lineHeight: 1 }}>
              {safeSeconds}
            </FontStyle>
            <FontStyle fontSize={10} fontWeight={600} sx={{ mt: 0.5 }}>
              detik
            </FontStyle>
          </Box>
        </Box>
        <Box>
          <FontStyle fontSize={14} fontWeight={600}>
            Anda akan diarahkan ke halaman login.
          </FontStyle>
          <FontStyle fontSize={12.5} sx={{ mt: 0.75, color: theme.ui.mutedText, lineHeight: 1.65 }}>
            Akses data telah dihentikan. Silakan masuk kembali untuk melanjutkan.
          </FontStyle>
        </Box>
      </Box>
      <LinearProgress
        variant="determinate"
        value={((5 - safeSeconds) / 5) * 100}
        sx={{
          mt: 2,
          height: 8,
          borderRadius: 999,
          bgcolor: theme.ui.iconButtonBg,
          "& .MuiLinearProgress-bar": { bgcolor: theme.palette.primary.main, borderRadius: 999 },
        }}
      />
    </AppModal>
  );
}
