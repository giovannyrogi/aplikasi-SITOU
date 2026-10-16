"use client";

import { useMediaQuery, useTheme } from "@mui/material";
import ApexChartClient from "./ApexChartClient";
import { normalizeChartCategories } from "./chartAdapter";

/** Pie/donut bersama dengan satuan hitung sesuai domain dan label Bahasa Indonesia. */
export default function DonutChart({ data, colors, totalLabel = "Total pegawai", unit = "pegawai", type = "donut", legend = true, height = 300 }) {
  const theme = useTheme();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const normalizedSeries = (data?.series || []).map((value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
  });
  const options = {
    chart: {
      fontFamily: theme.typography.fontFamily,
      toolbar: { show: false },
      animations: { enabled: !reducedMotion, speed: 240 },
    },
    labels: normalizeChartCategories(data?.labels),
    colors: colors || [
      theme.status.success.main,
      theme.status.warning.main,
      theme.status.danger.main,
      theme.status.info.main,
      theme.palette.secondary.main,
      theme.palette.primary.main,
    ],
    legend: { show: legend, position: "bottom", fontSize: "11px", fontWeight: 500, markers: { size: 5 } },
    stroke: { width: 3, colors: [theme.ui.panelBg] },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: {
          size: "72%",
          labels: {
            show: type === "donut",
            name: { show: true, fontSize: "12px", fontWeight: 600, color: theme.palette.text.secondary, offsetY: -8 },
            value: { show: true, fontSize: "30px", fontWeight: 700, color: theme.palette.text.primary, offsetY: 6 },
            total: {
              show: true,
              showAlways: true,
              fontSize: "12px",
              fontWeight: 600,
              color: theme.palette.text.secondary,
              label: totalLabel,
              formatter: () => new Intl.NumberFormat("id-ID").format(normalizedSeries.reduce((sum, value) => sum + value, 0)),
            },
          },
        },
      },
    },
    tooltip: {
      y: { formatter: (value) => `${new Intl.NumberFormat("id-ID").format(value)} ${unit}` },
    },
    noData: { text: "Belum ada data untuk ditampilkan." },
  };
  return <ApexChartClient height={height} type={type} series={normalizedSeries} options={options} />;
}
