const numberFormatter = new Intl.NumberFormat("id-ID");
const monthFormatter = new Intl.DateTimeFormat("id-ID", { month: "short", year: "numeric" });

/** Memformat kategori bulan ISO tanpa bergantung pada locale browser pengguna. */
export function formatChartCategory(value) {
  if (!/^\d{4}-\d{2}$/.test(String(value))) return String(value || "");
  return monthFormatter.format(new Date(`${value}-01T00:00:00`));
}

/** Memformat nilai numerik tanpa menghasilkan label NaN ketika Apex mengirim nilai kosong. */
function formatChartNumber(value, percent = false) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "";
  return percent ? `${numberFormatter.format(numericValue)}%` : numberFormatter.format(numericValue);
}

/** Membuat konfigurasi ApexCharts terpusat yang konsisten dengan theme SITOU. */
export function createChartOptions({
  theme,
  categories = [],
  colors,
  stacked = false,
  horizontal = false,
  reducedMotion = false,
  percent = false,
  legend = true,
}) {
  const palette = colors || [
    theme.palette.primary.main,
    theme.status.info.main,
    theme.status.success.main,
    theme.status.warning.main,
    theme.status.danger.main,
  ];
  return {
    chart: {
      fontFamily: theme.typography.fontFamily,
      foreColor: theme.ui.mutedText,
      toolbar: { show: false },
      zoom: { enabled: false },
      stacked,
      animations: { enabled: !reducedMotion, speed: 240, animateGradually: { enabled: false } },
      parentHeightOffset: 0,
    },
    colors: palette,
    dataLabels: { enabled: false },
    stroke: { width: 2.5, curve: "smooth" },
    fill: { opacity: 0.14, type: "solid" },
    grid: {
      borderColor: theme.ui.panelBorderSubtle,
      strokeDashArray: 4,
      padding: { left: 4, right: 10, top: 2, bottom: 0 },
    },
    plotOptions: {
      bar: {
        horizontal,
        borderRadius: 4,
        borderRadiusApplication: "end",
        columnWidth: "54%",
        barHeight: "58%",
      },
    },
    xaxis: {
      categories,
      labels: {
        rotate: 0,
        trim: true,
        formatter: horizontal
          ? (value) => formatChartNumber(value, percent)
          : formatChartCategory,
        style: { fontSize: "11px", fontWeight: 500 },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      min: horizontal ? undefined : 0,
      max: !horizontal && percent ? 100 : undefined,
      labels: {
        formatter: horizontal
          ? (value) => String(value ?? "")
          : (value) => formatChartNumber(value, percent),
        style: { fontSize: "11px", fontWeight: 500 },
        maxWidth: horizontal ? 150 : 80,
      },
    },
    legend: {
      show: legend,
      position: "top",
      horizontalAlign: "left",
      fontSize: "11px",
      fontWeight: 500,
      markers: { size: 5, shape: "circle" },
      itemMargin: { horizontal: 10, vertical: 4 },
    },
    tooltip: {
      shared: true,
      intersect: false,
      theme: "light",
      x: { formatter: formatChartCategory },
      y: {
        formatter: (value) => formatChartNumber(value, percent),
      },
    },
    noData: { text: "Belum ada data untuk periode ini.", align: "center", verticalAlign: "middle" },
    responsive: [
      {
        breakpoint: 600,
        options: {
          chart: { height: 280 },
          legend: { position: "bottom", horizontalAlign: "center" },
          xaxis: { labels: { rotate: -35, hideOverlappingLabels: true } },
        },
      },
    ],
  };
}
