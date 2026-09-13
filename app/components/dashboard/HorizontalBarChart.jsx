"use client";

import { Box, useMediaQuery, useTheme } from "@mui/material";
import ApexChartClient from "./ApexChartClient";
import { createChartOptions, normalizeChartSeries } from "./chartAdapter";

/** Grafik batang horizontal untuk perbandingan kategori dengan label panjang. */
export default function HorizontalBarChart({ data, percent = false, colors, scrollable = false }) {
  const theme = useTheme();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  return (
    <Box
      role={scrollable ? "region" : undefined}
      aria-label={scrollable ? "Grafik batang yang dapat digulir" : undefined}
      tabIndex={scrollable ? 0 : undefined}
      sx={{
        minWidth: 0,
        maxHeight: scrollable ? 420 : undefined,
        overflowY: scrollable ? "auto" : undefined,
        ...(scrollable && {
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          "&::-webkit-scrollbar": { display: "none", width: 0, height: 0 },
          "&:focus-visible": {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: -2,
          },
        }),
      }}
    >
      <ApexChartClient
        height={scrollable ? Math.max(300, (data?.categories?.length || 0) * 42) : 300}
        type="bar"
        series={normalizeChartSeries(data?.series)}
        options={createChartOptions({
          theme,
          categories: data?.categories,
          colors,
          horizontal: true,
          reducedMotion,
          percent,
          legend: (data?.series?.length || 0) > 1,
        })}
      />
    </Box>
  );
}
