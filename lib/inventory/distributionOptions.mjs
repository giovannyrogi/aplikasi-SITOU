/** Nama, kode, dan satuan ringkas agar pilihan barang mudah dibedakan. */
export function distributionItemOptions(rows) {
  const items = new Map();
  for (const row of rows) {
    if (!row.item_id) continue;
    items.set(row.item_id, {
      value: row.item_id,
      label: [row.item_name || "Nama barang belum tersedia", row.item_code, row.unit_name]
        .filter(Boolean)
        .join(" · "),
    });
  }
  return [...items.values()].sort((a, b) => a.label.localeCompare(b.label, "id-ID"));
}
