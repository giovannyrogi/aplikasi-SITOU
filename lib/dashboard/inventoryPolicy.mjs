export const INVENTORY_DASHBOARD_PERMISSIONS = {
  stock: "inventory.stock.read",
  transactions: "inventory.transactions.read",
  distribution: "inventory.reports.read",
};

export function inventoryDashboardSections(permissions) {
  const allowed = new Set(permissions);
  return Object.entries(INVENTORY_DASHBOARD_PERMISSIONS)
    .filter(([, permission]) => allowed.has(permission)).map(([section]) => section);
}

/** Minggu kalender Senin–Minggu, dipotong pada batas bulan. */
export function inventoryMonthRange(today) {
  const start = `${today.slice(0, 7)}-01`;
  const end = today;
  const weeks = [];
  let day = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  const label = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
  while (day <= last) {
    const first = new Date(day);
    const sunday = new Date(day);
    sunday.setUTCDate(sunday.getUTCDate() + (7 - sunday.getUTCDay()) % 7);
    if (sunday > last) sunday.setTime(last.getTime());
    weeks.push({ start: first.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10), label: `${label.format(first)}–${label.format(sunday)}` });
    day = new Date(sunday);
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return { start, end, weeks };
}

export const INVENTORY_ACTIVITY_KINDS = [
  ["receipt", "Barang masuk"], ["issue", "Barang keluar"],
  ["return", "Pengembalian"], ["stocktake", "Stok opname"],
];

export function inventoryActivityChart(rows, range) {
  return {
    categories: range.weeks.map((week) => week.label),
    series: INVENTORY_ACTIVITY_KINDS.map(([kind, name]) => ({ name, data: range.weeks.map((week) =>
      rows.filter((row) => row.kind === kind && row.occurred_on >= week.start && row.occurred_on <= week.end)
        .reduce((total, row) => total + Number(row.count), 0)) })),
  };
}

/** Kalender organisasi menyediakan seluruh label periode grafik. */
export function inventoryTrendRange(today, period = "year") {
  const current = new Date(`${today}T12:00:00Z`);
  const start = new Date(current);
  if (period === "year") start.setUTCMonth(0, 1);
  else if (period === "month") start.setUTCDate(1);
  else start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const iso = (date) => date.toISOString().slice(0, 10);
  const buckets = [];
  const count = period === "year" ? 12 : period === "month" ? new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0)).getUTCDate() : 7;
  for (let index = 0; index < count; index++) {
    const day = new Date(start);
    if (period === "year") day.setUTCMonth(index); else day.setUTCDate(day.getUTCDate() + index);
    const label = period === "year" ? new Intl.DateTimeFormat("id-ID", { month: "long", timeZone: "UTC" }).format(day)
      : period === "week" ? `${new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" }).format(day)} (${day.getUTCDate()})` : String(day.getUTCDate());
    const tooltipLabel = new Intl.DateTimeFormat("id-ID", { ...(period === "year" ? {} : { day: "numeric" }), month: period === "year" ? "long" : "short", year: "numeric", timeZone: "UTC" }).format(day);
    buckets.push({ tooltipLabel, key: iso(day).slice(0, period === "year" ? 7 : 10), label, future: iso(day) > today });
  }
  return { start: iso(start), end: today, period, buckets };
}

/** Jumlah dokumen per bulan/hari, tanpa mencampur satuan barang. */
export function inventoryTrendChart(rows, range) {
  return { categories: range.buckets.map((bucket) => bucket.label),
    tooltipCategories: range.buckets.map((bucket) => bucket.tooltipLabel),
    shortCategories: range.buckets.map((bucket) => range.period === "year" ? bucket.label.slice(0, 3) : bucket.label),
    series: INVENTORY_ACTIVITY_KINDS.map(([kind, name]) => ({ name, data: range.buckets.map((bucket) => bucket.future ? 0
      : rows.filter((row) => row.kind === kind && row.occurred_on.startsWith(bucket.key)).reduce((sum, row) => sum + Number(row.count), 0)) })) };
}
