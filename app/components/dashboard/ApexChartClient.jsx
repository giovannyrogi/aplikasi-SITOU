"use client";

import dynamic from "next/dynamic";
import { Box, CircularProgress } from "@mui/material";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => (
    <Box sx={{ height: 300, display: "grid", placeItems: "center" }}>
      <CircularProgress size={28} />
    </Box>
  ),
});

/** Menjaga ApexCharts tetap client-only agar dashboard aman saat server rendering. */
export default function ApexChartClient({ type, options, series, height = 300 }) {
  return <ReactApexChart type={type} options={options} series={series} height={height} />;
}
