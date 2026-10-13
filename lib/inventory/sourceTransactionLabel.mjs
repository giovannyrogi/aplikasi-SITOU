/** Label transaksi asal memakai informasi bisnis, tanpa potongan UUID internal. */
export function sourceTransactionLabel(row, dateLabel) {
  const first = row.lines?.[0];
  const amount = first ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(Number(first.quantity)) : "";
  const items = first ? `${first.name} · ${amount} ${first.unit}${row.lines.length > 1 ? ` · +${row.lines.length - 1} barang lainnya` : ""}` : "Barang keluar";
  return [row.reference_no, dateLabel, row.warehouse_name, items].filter(Boolean).join(" · ");
}
