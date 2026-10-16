/** Indikator tampilan; bukan aturan persetujuan atau pengubah saldo. */
export function leaveBalanceCondition(row) {
  if (!row.uses_balance || row.balance == null) return null;
  const balance = Number(row.balance),
    allocated = Number(row.allocated);
  if (balance < 0) return { tone: "danger", label: "Saldo negatif" };
  if (balance === 0) return { tone: "danger", label: "Habis" };
  if (allocated > 0 && balance / allocated <= 0.25) return { tone: "warning", label: "Menipis" };
  return { tone: "success", label: "Tersedia" };
}
