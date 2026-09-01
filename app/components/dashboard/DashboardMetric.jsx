"use client";

import { Icon } from "@iconify/react";
import { Box, Paper, Skeleton, useTheme } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";
import MetricSparkline from "./MetricSparkline";

/** Menampilkan KPI dashboard dengan aksen semantik yang tidak mendominasi panel. */
export default function DashboardMetric({ metric, loading }) {
  const theme = useTheme();
  const tone = theme.status[metric?.tone] || theme.status.info;
  return (
    <Paper
      component={metric?.href ? "a" : "div"}
      href={metric?.href || undefined}
      elevation={0}
      sx={{
        position: "relative",
        minHeight: 132,
        overflow: "hidden",
        p: 2,
        border: `1px solid ${theme.ui.dashboardCardBorder}`,
        borderTop: `3px solid ${tone.main}`,
        borderRadius: "8px",
        bgcolor: theme.ui.dashboardCardBg,
        boxShadow: theme.ui.dashboardCardShadow,
        color: "inherit",
        textDecoration: "none",
        cursor: metric?.href ? "pointer" : "default",
        transition: "transform 160ms ease, box-shadow 160ms ease",
        "&:hover": metric?.href
          ? { transform: "translateY(-2px)", boxShadow: theme.ui.panelShadow }
          : undefined,
      }}
    >
      {loading ? (
        <>
          <Skeleton width="55%" />
          <Skeleton width="35%" height={42} />
        </>
      ) : (
        <>
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText, lineHeight: 1.5 }}>
                {metric.label}
              </FontStyle>
              <FontStyle fontSize={28} fontWeight={700} sx={{ mt: 0.5 }}>
                {new Intl.NumberFormat("id-ID").format(metric.value)}
              </FontStyle>
            </Box>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: "8px",
                display: "grid",
                placeItems: "center",
                bgcolor: tone.background,
                color: tone.main,
                flexShrink: 0,
              }}
            >
              <Icon icon={metric.icon} width={23} />
            </Box>
          </Box>
          {metric.trendData?.length ? (
            <Box sx={{ mt: 0.5 }}>
              <MetricSparkline data={metric.trendData} color={tone.main} />
            </Box>
          ) : (
            <FontStyle fontSize={10.5} sx={{ mt: 1.2, color: theme.ui.mutedText }}>
              Data diperbarui dari kondisi operasional terkini.
            </FontStyle>
          )}
        </>
      )}
    </Paper>
  );
}
