"use client";

import { useMediaQuery, useTheme } from "@mui/material";
import ApexChartClient from "./ApexChartClient";

/** Sparkline opsional untuk KPI yang benar-benar memiliki dataset tren. */
export default function MetricSparkline({ data, color }) {
  const theme = useTheme();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  return (
    <ApexChartClient
      type="area"
      height={48}
      series={[{ name: "Tren", data }]}
      options={{
        chart: { sparkline: { enabled: true }, animations: { enabled: !reducedMotion } },
        colors: [color || theme.palette.primary.main],
        stroke: { width: 2, curve: "smooth" },
        fill: { opacity: 0.12, type: "solid" },
        tooltip: { enabled: false },
      }}
    />
  );
}
