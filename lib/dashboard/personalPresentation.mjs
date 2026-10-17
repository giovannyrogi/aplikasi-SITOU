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
    .filter((row) => row.is_active && row.uses_balance)
    .toSorted(
      (a, b) => a.name.localeCompare(b.name, "id") || String(a.id).localeCompare(String(b.id)),
    );
}

export function selectedBalance(rows, selectedId) {
  return (
    rows.find((row) => String(row.id) === String(selectedId)) ||
    rows.find((row) => row.balance != null) ||
    rows[0] ||
    null
  );
}
