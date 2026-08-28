"use client";

import { useMediaQuery, useTheme } from "@mui/material";
import ApexChartClient from "./ApexChartClient";
import { createChartOptions, normalizeChartSeries } from "./chartAdapter";

/** Grafik area untuk membandingkan arus perubahan berdasarkan periode. */
export default function AreaTrendChart({ data }) {
  const theme = useTheme();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  return (
    <ApexChartClient
      type="area"
      series={normalizeChartSeries(data?.series)}
      options={createChartOptions({
        theme,
        categories: data?.categories,
        reducedMotion,
        legend: (data?.series?.length || 0) > 1,
      })}
    />
  );
}
