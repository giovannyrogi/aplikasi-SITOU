"use client";

import { useMediaQuery, useTheme } from "@mui/material";
import ApexChartClient from "./ApexChartClient";
import { createChartOptions } from "./chartAdapter";

/** Grafik batang bertumpuk untuk membandingkan komposisi dalam satu kategori. */
export default function StackedBarChart({ data, horizontal = false }) {
  const theme = useTheme();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  return (
    <ApexChartClient
      type="bar"
      series={data.series}
      options={createChartOptions({
        theme,
        categories: data.categories,
        stacked: true,
        horizontal,
        reducedMotion,
      })}
    />
  );
}
