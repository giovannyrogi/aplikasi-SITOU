"use client";

import AppIcon from "@/app/components/icons/AppIcon";
import { Box, Paper, IconButton, Tooltip, useTheme } from "@mui/material";
import { useState } from "react";
import { alpha } from "@mui/material/styles";
import DashboardActivityRows from "./DashboardActivityRows";
import DashboardActivityHistoryModal from "./DashboardActivityHistoryModal";
import FontStyle from "@/app/components/font-style/FontStyle";

/** Menampilkan jejak aktivitas terbaru tanpa membuka payload audit sensitif. */
export default function DashboardActivityList({ items = [], loading, canViewHistory = false }) {
  const theme = useTheme();
  const [historyOpen, setHistoryOpen] = useState(false);
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{
        height: "100%",
        p: { xs: 2, sm: 2.5 },
        border: `1px solid ${theme.ui.dashboardCardBorder}`,
        borderRadius: "8px",
        bgcolor: theme.ui.dashboardCardBg,
        boxShadow: theme.ui.dashboardCardShadow,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <AppIcon icon="solar:history-bold-duotone" width={22} color={theme.status.info.main} />
            <FontStyle component="h2" fontSize={15} fontWeight={700}>
              Aktivitas terbaru
            </FontStyle>
          </Box>
          <FontStyle fontSize={11.5} sx={{ mt: 0.5, color: theme.ui.mutedText }}>
            Perubahan terbaru yang dicatat oleh pengelola organisasi.
          </FontStyle>
        </Box>
        {canViewHistory ? (
          <Tooltip title="Lihat riwayat aktivitas">
            <span>
              <IconButton
                aria-label="Lihat riwayat aktivitas"
                disabled={loading}
                onClick={() => setHistoryOpen(true)}
                sx={{
                  width: 44,
                  height: 44,
                  flexShrink: 0,
                  color: theme.palette.primary.main,
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                  "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.15) },
                }}
              >
                <AppIcon icon="activity:view-all" width={21} aria-hidden="true" />
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
      </Box>
      <DashboardActivityRows items={items} loading={loading} />
      {historyOpen && canViewHistory ? (
        <DashboardActivityHistoryModal onClose={() => setHistoryOpen(false)} />
      ) : null}
    </Paper>
  );
}
