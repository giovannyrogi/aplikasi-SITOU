import { LEAVE_UNIT } from "../leave/labels.mjs";

/** Nilai hilang bukan nol; tanggal organisasi menjadi acuan hari pertama. */
export function serviceMetric(employment, today) {
  const joined = employment?.joinedDate;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(joined || "") ||
    !Number.isFinite(Date.parse(joined)) ||
    new Date(joined).toISOString().slice(0, 10) !== joined ||
    joined > today
  )
    return { valueText: "Belum tersedia" };
  if (joined === today) return { valueText: "Hari pertama" };
  const parts = [
    { value: employment.serviceYears, unit: "tahun" },
    { value: employment.serviceMonths, unit: "bulan" },
    { value: employment.serviceDays, unit: "hari" },
  ];
  if (parts.some(({ value }) => !Number.isInteger(value) || value < 0))
    return { valueText: "Belum tersedia" };
  const positive = parts.filter(({ value }) => value > 0);
  return positive.length ? { parts: positive } : { valueText: "Belum tersedia" };
}

export function selectableBalances(balances = []) {
  return balances
    .filter(
      (row) =>
        row.is_active &&
        row.uses_balance &&
        (row.balance != null || Number(row.annual_allowance) > 0),
    )
    .toSorted(
      (a, b) => a.name.localeCompare(b.name, "id") || String(a.id).localeCompare(String(b.id)),
    );
}

/** Jatah aturan hanya pratinjau sampai hak tahunan benar-benar masuk ledger. */
export function displayLeaveBalance(row) {
  if (!row) return null;
  if (row.balance != null)
    return {
      value: Number(row.balance),
      allocated: Number(row.allocated),
      used: Number(row.used),
      official: true,
    };
  const annual = Number(row.annual_allowance);
  return Number.isFinite(annual) && annual > 0
    ? { value: annual, allocated: annual, used: 0, official: false }
    : null;
}

/** Indikator menunjukkan jatah yang masih tersedia, bukan jumlah yang terpakai. */
export function leaveBalanceIndicator(shown) {
  if (!shown || !Number.isFinite(shown.allocated) || shown.allocated <= 0) return null;
  const percent = Math.max(0, Math.min(100, (shown.value / shown.allocated) * 100));
  return {
    percent,
    tone: percent >= 100 ? "success" : percent <= 25 ? "danger" : "warning",
    label:
      shown.value < 0
        ? "Jatah tidak mencukupi"
        : percent >= 100
          ? !shown.official
            ? "Jatah tahun ini belum digunakan"
            : shown.used === 0
              ? "Saldo tahun ini belum digunakan"
              : "Sisa jatah masih penuh"
          : percent <= 0
            ? "Jatah habis"
            : percent <= 25
              ? "Jatah hampir habis"
              : shown.used > 0
                ? "Sebagian jatah sudah digunakan"
                : "Jatah berkurang",
  };
}

export function selectedBalance(rows, selectedId) {
  return (
    rows.find((row) => String(row.id) === String(selectedId)) ||
    rows.find((row) => row.balance != null) ||
    rows[0] ||
    null
  );
}
export function adjacentBalance(rows, selectedId, direction) {
  if (rows.length < 2) return rows[0] || null;
  const current = selectedBalance(rows, selectedId);
  const index = rows.findIndex((row) => String(row.id) === String(current.id));
  return rows[(index + direction + rows.length) % rows.length];
}

export function shouldAutoRotateBalance({
  count,
  hovering,
  focusWithin,
  reducedMotion,
  pageVisible,
  cardVisible,
}) {
  return count > 1 && !hovering && !focusWithin && !reducedMotion && pageVisible && cardVisible;
}

/** Seluruh isi kartu berasal dari satu jenis saldo yang sedang tampil. */
export function leaveBalanceCardMetric(row) {
  const shown = displayLeaveBalance(row);
  const indicator = leaveBalanceIndicator(shown);
  const unit = row ? LEAVE_UNIT[row.unit] : null;
  return {
    label: row?.name || "Jatah cuti & izin",
    icon: "navigation:leave",
    tone: "brand",
    value: shown?.value,
    unit: shown ? unit : null,
    valueText: shown ? null : "Belum tersedia",
    description: shown
      ? shown.official && shown.used > 0
        ? `Terpakai ${shown.used} dari ${shown.allocated} ${unit}`
        : ""
      : "Belum ada jenis cuti atau izin dengan jatah tahunan.",
    progress: indicator?.percent,
    progressTone: indicator?.tone,
    progressStatus: indicator?.label,
    progressAriaLabel: shown
      ? shown.official
        ? `Sisa jatah ${shown.value} dari ${shown.allocated} ${unit}`
        : `Jatah tahun ini ${shown.value} ${unit}, belum digunakan`
      : undefined,
  };
}
