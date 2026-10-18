"use client";

import { keyframes } from "@emotion/react";
import AppIconTile from "@/app/components/icons/AppIconTile";
import { Box, Paper, Skeleton, LinearProgress, useTheme } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";
import MetricSparkline from "./MetricSparkline";

const slideInNext = keyframes`from { opacity: 0.35; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); }`;
const slideInPrevious = keyframes`from { opacity: 0.35; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); }`;

function MetricValue({ metric, refined, balanced = false }) {
  return (
    <>
      {metric.valueText ? (
        <FontStyle
          fontSize={{ xs: 17, sm: 19 }}
          fontWeight={700}
          sx={{ mt: balanced ? 0 : 1.5, overflowWrap: "anywhere" }}
        >
          {metric.valueText}
        </FontStyle>
      ) : (
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            flexWrap: "wrap",
            columnGap: { xs: 1.25, md: 1.5 },
            rowGap: 1,
            mt: balanced ? 0 : 1,
          }}
        >
          {(metric.parts || [{ value: metric.value, unit: metric.unit }]).map((part, index) => (
            <Box key={index} sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
              <FontStyle
                component="span"
                fontSize={
                  balanced ? { xs: 26, sm: 28, lg: 30, xl: 34 } : refined ? { xs: 26, sm: 30 } : 28
                }
                fontWeight={700}
              >
                {part.value == null ? "—" : new Intl.NumberFormat("id-ID").format(part.value)}
              </FontStyle>
              {part.unit ? (
                <FontStyle component="span" fontSize={12} sx={{ color: "text.secondary" }}>
                  {part.unit}
                </FontStyle>
              ) : null}
            </Box>
          ))}
        </Box>
      )}
    </>
  );
}

/** Menampilkan KPI dashboard dengan aksen semantik yang tidak mendominasi panel. */
export default function DashboardMetric({
  metric,
  loading,
  refined = false,
  selection,
  balanced = false,
  slide,
  navigation,
  surfaceRef,
  surfaceProps,
}) {
  const theme = useTheme();
  const tone = theme.status[metric?.tone] || theme.status.info;
  return (
    <Paper
      ref={surfaceRef}
      {...surfaceProps}
      component="div"
      elevation={0}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 132,
        overflow: "hidden",
        p: refined ? 3 : 2,
        border: `1px solid ${theme.ui.dashboardCardBorder}`,
        borderTop: refined ? undefined : `3px solid ${tone.main}`,
        borderRadius: "8px",
        bgcolor: theme.ui.dashboardCardBg,
        boxShadow: refined ? "none" : theme.ui.dashboardCardShadow,
        color: "inherit",
        textDecoration: "none",
        cursor: "default",
        transition: "transform 160ms ease, box-shadow 160ms ease",
        "&:hover": !loading
          ? { transform: "translateY(-2px)", boxShadow: theme.ui.panelShadow }
          : undefined,
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
          "&:hover": { transform: "none" },
        },
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
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <FontStyle
                fontSize={refined ? 13 : 11.5}
                aria-live={slide ? (slide.autoplaying ? "off" : "polite") : undefined}
                aria-atomic={slide ? "true" : undefined}
                sx={{ color: theme.ui.mutedText, lineHeight: 1.5 }}
              >
                {metric.label}
              </FontStyle>
            </Box>
            <AppIconTile icon={metric.icon} tone={metric.tone || "info"} size={40} iconSize={20} />
          </Box>
          <Box
            {...slide?.interactionProps}
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              touchAction: slide ? "pan-y" : undefined,
              userSelect: slide ? "none" : undefined,
              "&:focus-visible": slide
                ? {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: 3,
                    borderRadius: 1,
                  }
                : undefined,
            }}
          >
            <Box
              key={slide?.key || "metric"}
              aria-live={slide ? (slide.autoplaying ? "off" : "polite") : undefined}
              aria-atomic={slide ? "true" : undefined}
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                animation: slide?.animate
                  ? `${slide.direction === -1 ? slideInPrevious : slideInNext} 220ms ease-out both`
                  : undefined,
                "@media (prefers-reduced-motion: reduce)": { animation: "none" },
              }}
            >
              {selection ? <Box sx={{ mt: 1.5, minWidth: 0 }}>{selection}</Box> : null}
              {!balanced ? <MetricValue metric={metric} refined={refined} /> : null}
              {balanced ? (
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", minHeight: 88, py: 2 }}>
                  <MetricValue metric={metric} refined={refined} balanced />
                </Box>
              ) : null}
              {metric.trendData?.length ? (
                <Box sx={{ mt: "auto", pt: 0.5 }}>
                  <MetricSparkline data={metric.trendData} color={tone.main} />
                </Box>
              ) : metric.description !== "" ? (
                <FontStyle
                  fontSize={refined ? 12 : 10.5}
                  sx={{
                    mt: Number.isFinite(metric.progress) ? 1.2 : "auto",
                    pt: balanced ? 1.5 : Number.isFinite(metric.progress) ? 0 : 1.2,
                    borderTop: balanced ? `1px solid ${theme.ui.panelBorderSubtle}` : undefined,
                    color: theme.ui.mutedText,
                  }}
                >
                  {metric.description ?? "Data diperbarui dari kondisi operasional terkini."}
                </FontStyle>
              ) : null}
              {Number.isFinite(metric.progress) ? (
                <Box
                  sx={{
                    mt: metric.description === "" ? "auto" : 1.5,
                    pt: metric.description === "" ? 1.5 : 0,
                  }}
                >
                  {metric.progressStatus ? (
                    <FontStyle
                      fontSize={11}
                      fontWeight={600}
                      sx={{ mb: 0.75, color: (theme.status[metric.progressTone] || tone).text }}
                    >
                      {metric.progressStatus}
                    </FontStyle>
                  ) : null}
                  <LinearProgress
                    variant="determinate"
                    value={Math.max(0, Math.min(100, metric.progress))}
                    aria-label={metric.progressAriaLabel || `Kemajuan ${metric.label}`}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: (theme.status[metric.progressTone] || theme.status.neutral)
                        .background,
                      "& .MuiLinearProgress-bar": {
                        bgcolor: (theme.status[metric.progressTone] || tone).main,
                      },
                    }}
                  />
                </Box>
              ) : null}
            </Box>
          </Box>
          {navigation ? (
            <Box sx={{ mt: 0.25, display: "flex", justifyContent: "center" }}>{navigation}</Box>
          ) : null}
        </>
      )}
    </Paper>
  );
}
