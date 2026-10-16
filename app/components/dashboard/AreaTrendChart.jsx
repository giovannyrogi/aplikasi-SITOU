"use client";

import { useMediaQuery, useTheme } from "@mui/material";
import ApexChartClient from "./ApexChartClient";
import { createChartOptions, normalizeChartSeries } from "./chartAdapter";

/** Grafik area untuk membandingkan arus perubahan berdasarkan periode. */
export default function AreaTrendChart({ data, colors, integer = false, height = 300 }) {
  const theme = useTheme();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const compact = useMediaQuery(theme.breakpoints.down("md"));
  const series = normalizeChartSeries(data?.series).map((entry, index) => ({ ...entry, data: entry.data.map((value, point) => data?.series[index].data[point] === null ? null : value) }));
  return (
    <ApexChartClient
      type="area"
      height={height}
      series={series}
      options={createChartOptions({
        theme,
        categories: compact && data?.shortCategories ? data.shortCategories : data?.categories,
        area: true, tooltipCategories: data?.tooltipCategories,
        colors, integer, countMax: Math.max(1, ...series.flatMap((entry) => entry.data)),
        reducedMotion,
        legend: (data?.series?.length || 0) > 1,
      })}
    />
  );
}
