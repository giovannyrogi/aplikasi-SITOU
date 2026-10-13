export const stockConditions = {
  unrecorded: { label: "Belum ada transaksi", tone: "neutral" },
  empty: { label: "Habis", tone: "danger" },
  low: { label: "Di bawah minimum", tone: "warning" },
  sufficient: { label: "Cukup", tone: "success" },
};

export function stockCondition(hasOpening, quantity, minimum) {
  if (!hasOpening) return "unrecorded";
  if (Number(quantity) === 0) return "empty";
  return Number(quantity) < Number(minimum) ? "low" : "sufficient";
}
