export const transactionPresentations = {
  opening: { label: "Saldo awal", icon: "solar:box-bold-duotone", tone: "info", description: "Catat jumlah barang saat gudang mulai memakai pencatatan stok. Isi 0 jika sudah dihitung dan kosong." },
  receipt: { label: "Barang masuk", icon: "solar:inbox-in-bold-duotone", tone: "success", description: "Catat barang yang diterima gudang, misalnya dari pembelian. Stok akan bertambah." },
  issue: { label: "Barang keluar", icon: "solar:inbox-out-bold-duotone", tone: "warning", description: "Catat barang yang diserahkan kepada pegawai atau unit tujuan. Stok gudang akan berkurang." },
  return: { label: "Pengembalian", icon: "solar:restart-bold-duotone", tone: "secondary", description: "Catat barang dari penyaluran sebelumnya yang kembali ke gudang. Stok akan bertambah." },
  stocktake: { label: "Stok opname", icon: "solar:clipboard-check-bold-duotone", tone: "neutral", description: "Masukkan hasil hitung fisik barang. Selisihnya akan menyesuaikan stok yang tercatat." },
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
