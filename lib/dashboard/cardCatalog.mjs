/** Metadata publik untuk menyusun kartu HRD tanpa mengirim data fitur yang tidak diizinkan. */
export const ORGANIZATION_METRIC_CARDS = [
  {
    key: "activeEmployees",
    label: "Pegawai aktif",
    icon: "solar:users-group-rounded-bold-duotone",
    section: "employees",
  },
  {
    key: "withoutAssignment",
    label: "Tanpa penempatan",
    icon: "solar:map-point-wave-bold-duotone",
    section: "employees",
  },
  {
    key: "expiringContracts",
    label: "Kontrak segera berakhir",
    icon: "solar:document-text-bold-duotone",
    section: "contracts",
  },
  {
    key: "incompleteProfiles",
    label: "Data belum lengkap",
    icon: "solar:clipboard-list-bold-duotone",
    section: "employees",
  },
  {
    key: "activeActions",
    label: "Tindakan disiplin aktif",
    icon: "solar:shield-warning-bold-duotone",
    section: "discipline",
  },
  {
    key: "currentLeave",
    label: "Sedang cuti/izin",
    icon: "solar:calendar-mark-bold-duotone",
    section: "leave",
  },
];

export const ORGANIZATION_CHART_SECTIONS = Object.freeze({
  growth: "employees",
  locations: "employees",
  units: "employees",
  contracts: "contracts",
  retirement: "retirement",
  discipline: "discipline",
});

/** Jenis siluet publik untuk kartu tanpa izin; bukan data grafik. */
export const ORGANIZATION_CHART_SHAPES = Object.freeze({
  growth: "area",
  locations: "horizontal",
  units: "horizontal",
  contracts: "stacked",
  retirement: "retirement",
  discipline: "list",
});

/** DTO server tetap menjadi satu-satunya sumber izin dan nilai untuk UI. */
export function dashboardMetricCards(data) {
  const sections = new Set(data?.sections || []);
  const metrics = new Map((data?.metrics || []).map((metric) => [metric.key, metric]));
  return ORGANIZATION_METRIC_CARDS.map((card) => ({
    ...card,
    locked: !sections.has(card.section),
    metric: sections.has(card.section) ? metrics.get(card.key) : undefined,
  }));
}
