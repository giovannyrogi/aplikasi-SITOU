"use client";

import { useMediaQuery, useTheme } from "@mui/material";
import ApexChartClient from "./ApexChartClient";
import { createChartOptions } from "./chartAdapter";

/** Grafik area untuk tren kumulatif berdasarkan periode. */
export default function AreaTrendChart({ data }) {
  const theme = useTheme();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  return (
    <ApexChartClient
      type="area"
      series={data.series}
      options={createChartOptions({
        theme,
        categories: data.categories,
        reducedMotion,
        legend: data.series.length > 1,
      })}
    />
  );
}
