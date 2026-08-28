"use client";

import { useMediaQuery, useTheme } from "@mui/material";
import ApexChartClient from "./ApexChartClient";
import { createChartOptions, normalizeChartSeries } from "./chartAdapter";

/** Grafik batang bertumpuk untuk membandingkan komposisi dalam satu kategori. */
export default function StackedBarChart({ data, horizontal = false, colors }) {
  const theme = useTheme();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  return (
    <ApexChartClient
      type="bar"
      series={normalizeChartSeries(data?.series)}
      options={createChartOptions({
        theme,
        categories: data?.categories,
        colors,
        stacked: true,
        horizontal,
        reducedMotion,
      })}
    />
  );
}
