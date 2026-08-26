"use client";

import { Icon } from "@iconify/react";
import { Box, Paper, Skeleton, useTheme } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";

/** Shell grafik dashboard dengan tinggi stabil serta state loading dan kosong yang seragam. */
export default function DashboardChart({ title, description, icon, loading, empty, children }) {
  const theme = useTheme();
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{
        minWidth: 0,
        height: "100%",
        p: { xs: 2, sm: 2.5 },
        border: `1px solid ${theme.ui.dashboardCardBorder}`,
        borderRadius: "8px",
        bgcolor: theme.ui.dashboardCardBg,
        boxShadow: theme.ui.dashboardCardShadow,
        transition: "border-color 180ms ease, box-shadow 180ms ease",
        "&:hover": {
          borderColor: theme.palette.primary.light,
          boxShadow: theme.ui.dashboardCardHoverShadow,
        },
      }}
    >
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start", minHeight: 54 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "8px",
            display: "grid",
            placeItems: "center",
            bgcolor: theme.ui.panelAccentBg,
            color: theme.palette.primary.main,
            flexShrink: 0,
          }}
        >
          <Icon icon={icon} width={20} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <FontStyle component="h2" fontSize={15} fontWeight={700}>
            {title}
          </FontStyle>
          <FontStyle fontSize={11.5} sx={{ mt: 0.35, color: theme.ui.mutedText, lineHeight: 1.5 }}>
            {description}
          </FontStyle>
        </Box>
      </Box>
      <Box sx={{ mt: 1.5, minHeight: 300, minWidth: 0 }}>
        {loading ? (
          <Skeleton variant="rounded" height={300} />
        ) : empty ? (
          <Box
            sx={{ height: 300, display: "grid", placeItems: "center", textAlign: "center", px: 2 }}
          >
            <FontStyle fontSize={12} sx={{ color: theme.ui.mutedText }}>
              Belum ada data untuk ditampilkan pada periode ini.
            </FontStyle>
          </Box>
        ) : (
          children
        )}
      </Box>
    </Paper>
  );
}
