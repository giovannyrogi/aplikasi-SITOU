"use client";

import { useMediaQuery, useTheme } from "@mui/material";
import ApexChartClient from "./ApexChartClient";
import { createChartOptions } from "./chartAdapter";

/** Grafik batang horizontal untuk perbandingan kategori dengan label panjang. */
export default function HorizontalBarChart({ data, percent = false }) {
  const theme = useTheme();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  return (
    <ApexChartClient
      type="bar"
      series={data.series}
      options={createChartOptions({
        theme,
        categories: data.categories,
        horizontal: true,
        reducedMotion,
        percent,
        legend: data.series.length > 1,
      })}
    />
  );
}
