/** Istilah produk; kode paket dan modul tetap menjadi kontrak internal/API. */
export function featureLabel(code, fallback = code) {
  return code === "inventory" ? "Fitur Inventaris" : fallback;
}
export function accessFeatureLabel(code, fallback = code) {
  return (
    {
      inventory_reader: "Fitur Inventaris — Lihat Saja",
      inventory_manager: "Fitur Inventaris — Pengelola Gudang",
      inventory_master: "Fitur Inventaris — Pengelola Master Inventaris",
    }[code] || fallback
  );
}

/** Menjelaskan tindakan yang tersedia tanpa menjanjikan fitur transaksi yang belum dibangun. */
export function accessFeatureDescription(code) {
  return (
    {
      inventory_reader:
        "Melihat stok, transaksi, dan distribusi sesuai cakupan gudang. Tidak dapat mengubah data.",
      inventory_manager:
        "Mengakses operasional dan mengatur batas stok minimum di gudang yang ditugaskan. Tidak mengubah data master.",
      inventory_master:
        "Mengelola barang, kategori, satuan, dan gudang organisasi. Akses operasional diatur terpisah.",
    }[code] || ""
  );
}
