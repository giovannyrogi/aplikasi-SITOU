"use client";

import { useMediaQuery, useTheme } from "@mui/material";
import ApexChartClient from "./ApexChartClient";
import { normalizeChartCategories } from "./chartAdapter";

/** Grafik donut untuk komposisi kelengkapan data dengan label Bahasa Indonesia. */
export default function DonutChart({ data, colors, totalLabel = "Total pegawai" }) {
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
    ],
    legend: { position: "bottom", fontSize: "11px", fontWeight: 500, markers: { size: 5 } },
    stroke: { width: 3, colors: [theme.ui.panelBg] },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: {
          size: "68%",
          labels: {
            show: true,
            total: {
              show: true,
              label: totalLabel,
              formatter: (context) =>
                new Intl.NumberFormat("id-ID").format(
                  context.globals.seriesTotals.reduce((sum, value) => sum + value, 0),
                ),
            },
          },
        },
      },
    },
    tooltip: {
      y: { formatter: (value) => `${new Intl.NumberFormat("id-ID").format(value)} pegawai` },
    },
    noData: { text: "Belum ada data untuk ditampilkan." },
  };
  return <ApexChartClient type="donut" series={normalizedSeries} options={options} />;
}
