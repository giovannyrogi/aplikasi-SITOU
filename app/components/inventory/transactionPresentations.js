export const transactionPresentations = {
  opening: { label: "Saldo awal", icon: "solar:box-bold-duotone", tone: "info", description: "Masukkan jumlah barang saat gudang mulai menggunakan sistem stok. Isi 0 jika sudah dihitung dan kosong." },
  receipt: { label: "Barang masuk", icon: "solar:inbox-in-bold-duotone", tone: "success", description: "Masukkan barang yang diterima gudang, misalnya dari pembelian. Stok akan bertambah." },
  issue: { label: "Barang keluar", icon: "solar:inbox-out-bold-duotone", tone: "warning", description: "Masukkan barang yang diserahkan kepada pegawai atau unit tujuan. Stok gudang akan berkurang." },
  return: { label: "Pengembalian ke gudang", icon: "solar:restart-bold-duotone", tone: "secondary", description: "Terima kembali barang yang sebelumnya disalurkan. Pilih penyalurannya, lalu isi jumlah barang yang benar-benar kembali." },
  stocktake: { label: "Stok opname", icon: "solar:clipboard-check-bold-duotone", tone: "neutral", description: "Masukkan hasil hitung fisik barang. Selisihnya akan menyesuaikan stok yang tersimpan." },
  reversal: { label: "Pembatalan", icon: "solar:undo-left-bold-duotone", tone: "danger" },
};

export const transactionKinds = Object.entries(transactionPresentations)
  .filter(([value]) => value !== "reversal")
  .map(([value, entry]) => ({ value, ...entry }));

export function transactionTone(theme, tone) {
  return tone === "secondary"
    ? { main: theme.palette.secondary.main, background: "#FDF4FF", border: "#F5D0FE" }
    : theme.status[tone];
}
