"use client";

import { Icon } from "@iconify/react";
import { Box, Paper, Skeleton, useTheme } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Menampilkan jejak aktivitas terbaru tanpa membuka payload audit sensitif. */
export default function DashboardActivityList({ items = [], loading }) {
  const theme = useTheme();
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
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Icon icon="solar:history-bold-duotone" width={22} color={theme.status.info.main} />
        <FontStyle component="h2" fontSize={15} fontWeight={700}>
          Aktivitas terbaru
        </FontStyle>
      </Box>
      <FontStyle fontSize={11.5} sx={{ mt: 0.5, color: theme.ui.mutedText }}>
        Perubahan operasional terkini yang telah tercatat dalam audit sistem.
      </FontStyle>
      <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0, mt: 2 }}>
        {loading ? (
          [1, 2, 3].map((item) => (
            <Box component="li" key={item} sx={{ py: 1.5 }}>
              <Skeleton />
              <Skeleton width="58%" />
            </Box>
          ))
        ) : items.length ? (
          items.map((item) => (
            <Box
              component="li"
              key={item.id}
              sx={{
                py: 1.4,
                borderTop: `1px solid ${theme.ui.panelBorderSubtle}`,
                display: "grid",
                gridTemplateColumns: "28px minmax(0, 1fr)",
                gap: 1.1,
              }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "8px",
                  display: "grid",
                  placeItems: "center",
                  bgcolor: theme.status.info.background,
                  color: theme.status.info.main,
                }}
              >
                <Icon icon="solar:check-read-bold-duotone" width={16} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <FontStyle fontSize={12.5} fontWeight={600}>
                  {item.label}
                </FontStyle>
                <FontStyle
                  fontSize={10.8}
                  sx={{ mt: 0.3, color: theme.ui.mutedText, overflowWrap: "anywhere" }}
                >
                  {item.actor} · {dateTimeFormatter.format(new Date(item.occurredAt))}
                </FontStyle>
              </Box>
            </Box>
          ))
        ) : (
          <Box component="li" sx={{ py: 4, textAlign: "center" }}>
            <FontStyle fontSize={12} sx={{ color: theme.ui.mutedText }}>
              Belum ada aktivitas yang dapat ditampilkan.
            </FontStyle>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
