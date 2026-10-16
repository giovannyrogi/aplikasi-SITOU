"use client";

import dynamic from "next/dynamic";
import { Box, CircularProgress } from "@mui/material";
import { useEffect, useRef, useState } from "react";

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
  const container = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(0, Math.floor(entry.contentRect.width))));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  return <Box ref={container} sx={{ width: "100%", minWidth: 0 }}>
    {width ? <ReactApexChart key={`${type}:${width}`} type={type} options={options} series={series} width={width} height={height} />
      : <Box sx={{ height, display: "grid", placeItems: "center" }}><CircularProgress size={28} /></Box>}
  </Box>;
}
