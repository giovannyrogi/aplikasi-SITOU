/** Istilah produk; kode paket dan modul tetap menjadi kontrak internal/API. */
export function featureLabel(code, fallback = code) {
  return code === "inventory" ? "Fitur Inventaris" : fallback;
}
export function accessFeatureLabel(code, fallback = code) {
  return (
    {
      inventory_reader: "Fitur Inventaris — Lihat Saja",
      inventory_manager: "Fitur Inventaris — Pengelola Gudang",
      inventory_opening_corrector: "Fitur Inventaris — Koreksi Saldo Awal",
      inventory_master: "Fitur Inventaris — Pengelola Master Inventaris",
    }[code] || fallback
  );
}

/** Menjelaskan tindakan yang tersedia tanpa menjanjikan fitur transaksi yang belum dibangun. */
export function accessFeatureDescription(code) {
  return (
    {
      inventory_opening_corrector: "Memperbaiki tanggal dan jumlah saldo awal dengan alasan serta riwayat audit. Memerlukan Pengelola Gudang pada gudang yang sama.",
      inventory_reader:
        "Melihat stok, riwayat transaksi, dan laporan distribusi sesuai cakupan gudang. Tidak dapat mengubah data.",
      inventory_manager:
        "Mengelola transaksi, membaca laporan distribusi, dan mengatur batas minimum di gudang yang ditugaskan. Data master dan koreksi saldo awal memerlukan izin terpisah.",
      inventory_master:
        "Mengelola barang, kategori, satuan, dan gudang organisasi. Akses operasional diatur terpisah.",
    }[code] || ""
  );
}
