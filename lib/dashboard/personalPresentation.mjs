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
    .filter((row) => row.is_active && row.uses_balance &&
      (row.balance != null || Number(row.annual_allowance) > 0))
    .toSorted(
      (a, b) => a.name.localeCompare(b.name, "id") || String(a.id).localeCompare(String(b.id)),
    );
}

/** Jatah aturan hanya pratinjau sampai hak tahunan benar-benar masuk ledger. */
export function displayLeaveBalance(row) {
  if (!row) return null;
  if (row.balance != null)
    return { value: Number(row.balance), allocated: Number(row.allocated), used: Number(row.used), official: true };
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
    label: shown.value < 0 ? "Jatah terlampaui" : percent >= 100 ? "Jatah penuh" :
      percent <= 0 ? "Jatah habis" : percent <= 25 ? "Jatah hampir habis" : "Sebagian terpakai",
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
