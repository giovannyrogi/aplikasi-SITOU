"use client";

import React from "react";
import {
  Box,
  LinearProgress,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Icon } from "@iconify/react";
import AppModal from "./AppModal";

const MAX_COUNTER = 10;

export default function ExpiredSessionModal({ open, counter = 0 }) {
  const theme = useTheme();
  const safeCounter = Math.max(0, Number(counter) || 0);
  const progressValue = (safeCounter / MAX_COUNTER) * 100;

  return (
    <AppModal
      open={open}
      title="Sesi Login Berakhir"
      titleDescription="Demi keamanan akun, Anda harus login kembali."
      icon="solar:shield-warning-bold-duotone"
      width={480}
      showCloseButton={false}
      contentSx={{ pt: { xs: 2.25, sm: 2.75 } }}
    >
      <Stack spacing={2.25}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "92px 1fr" },
            gap: { xs: 2, sm: 2.25 },
            alignItems: "center",
            p: { xs: 2, sm: 2.25 },
            borderRadius: 2.5,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.28)}`,
            bgcolor:
              theme.palette.mode === "dark"
                ? alpha(theme.palette.primary.main, 0.1)
                : alpha(theme.palette.primary.main, 0.06),
          }}
        >
          <Box
            sx={{
              width: { xs: 86, sm: 92 },
              height: { xs: 86, sm: 92 },
              mx: { xs: "auto", sm: 0 },
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              color: theme.palette.primary.main,
              bgcolor:
                theme.palette.mode === "dark"
                  ? alpha(theme.palette.primary.main, 0.18)
                  : alpha(theme.palette.primary.main, 0.12),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
            }}
          >
            <Stack alignItems="center" spacing={0.25}>
              <Typography
                sx={{
                  fontFamily: "Poppins",
                  fontWeight: 700,
                  fontSize: { xs: 30, sm: 34 },
                  lineHeight: 1,
                }}
              >
                {safeCounter}
              </Typography>
              <Typography
                sx={{
                  fontFamily: "Poppins",
                  fontWeight: 700,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 0,
                }}
              >
                Detik
              </Typography>
            </Stack>
          </Box>

          <Stack spacing={1}>
            <Typography
              sx={{
                fontFamily: "Poppins",
                fontWeight: 700,
                fontSize: { xs: 14, sm: 15 },
                lineHeight: 1.5,
              }}
            >
              Anda akan diarahkan otomatis ke halaman login.
            </Typography>
            <Typography
              sx={{
                color: theme.ui?.mutedText || "text.secondary",
                fontFamily: "Poppins",
                fontWeight: 600,
                fontSize: 12.5,
                lineHeight: 1.7,
              }}
            >
              Sesi login Anda telah berakhir. Silahkan login kembali untuk dapat
              melanjutkan penggunaan aplikasi.
            </Typography>
          </Stack>
        </Box>

        <Box>
          <LinearProgress
            variant="determinate"
            value={progressValue}
            sx={{
              height: 9,
              borderRadius: 999,
              bgcolor:
                theme.palette.mode === "dark"
                  ? alpha(theme.palette.primary.main, 0.14)
                  : alpha(theme.palette.primary.main, 0.1),
              "& .MuiLinearProgress-bar": {
                borderRadius: 999,
                bgcolor: theme.palette.primary.main,
              },
            }}
          />
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.75}
            sx={{ mt: 1 }}
          >
            <Icon
              icon="solar:lock-keyhole-bold-duotone"
              fontSize={16}
              color={theme.palette.primary.main}
            />
            <Typography
              sx={{
                color: theme.ui?.mutedText || "text.secondary",
                fontFamily: "Poppins",
                fontWeight: 600,
                fontSize: 11.5,
              }}
            >
              Akses data telah dihentikan sampai Anda login kembali.
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </AppModal>
  );
}
