/** Teks bantuan akses dipakai bersama pada form dan rincian, tanpa janji fitur mendatang. */
export const ACCESS_LEVEL_DESCRIPTIONS = {
  read: "Dapat melihat data. Tidak dapat menambah, mengubah, atau menonaktifkan data.",
  manage: "Dapat melihat dan mengelola data pada menu ini sesuai cakupan akses.",
};
export const ACCOUNT_ACCESS_OPTIONS = [
  { value: "none", label: "Tidak diberikan", description: "Tidak membuka menu Akun Organisasi." },
  {
    value: "manage",
    label: "Kelola akun Pegawai",
    description:
      "Membuat dan mengelola akun Pegawai, termasuk status, profil tertaut, dan reset password. Tidak mengubah akses fitur.",
  },
  {
    value: "manage_and_delegate",
    label: "Kelola akun Pegawai & akses fitur",
    description:
      "Mengelola akun Pegawai serta memberikan atau mencabut fitur selain HRIS sesuai kewenangan Anda.",
  },
];
export const HRIS_MENU_DESCRIPTIONS = {
  dashboard:
    "Mengaktifkan ringkasan dan indikator organisasi. Jika tidak dicentang, login tetap menuju Dashboard tanpa statistik.",
  "master-locations": "Daftar lokasi organisasi untuk penempatan dan cakupan akses Pegawai.",
  "master-organization-unit-types": "Klasifikasi struktur, seperti divisi dan unit organisasi.",
  "master-organization-units": "Divisi, unit, hierarki, dan keterkaitannya dengan lokasi.",
  "master-positions": "Daftar jabatan yang digunakan pada penempatan Pegawai.",
  "master-employment-types": "Jenis kepegawaian dan aturan penggunaan tanggal akhir kontrak.",
  employees:
    "Mencakup profil, KTP, KK, rekening, kontrak, penempatan, dan disiplin. Cuti serta akun diatur terpisah.",
  "leave-requests":
    "Melihat atau mengelola pencatatan, keputusan, dan saldo cuti/izin sesuai tingkat akses.",
  "expiring-contracts-report":
    "Melihat dan mengekspor laporan kontrak yang akan atau sudah berakhir.",
  "retirement-report": "Melihat dan mengekspor proyeksi pensiun berdasarkan kebijakan organisasi.",
  "disciplinary-actions-report":
    "Melihat dan mengekspor laporan sanksi serta membuka histori dan surat berizin.",
  "leave-settings": "Jenis cuti/izin, persyaratan lampiran, dan aturan pencatatannya.",
  "disciplinary-action-settings": "Jenis sanksi, masa berlaku, dan persyaratan surat.",
  "retirement-policy":
    "Usia pensiun organisasi dan riwayat perubahannya. Tidak otomatis mengakhiri hubungan kerja.",
};
export const FEATURE_DESCRIPTIONS = {
  hris: "Atur akses administrasi Pegawai melalui pilihan menu di bawah.",
  inventory:
    "Pilih izin Inventaris dan cakupan gudangnya. Halaman stok, transaksi, dan distribusi masih disiapkan.",
};
/** Satu uraian ringkas menyatukan fungsi menu dan batas level, tanpa mengulang kalimat umum. */
export function hrisMenuAccessDescription(key, level) {
  const read = level === "read";
  if (key === "employees")
    return `${read ? "Melihat" : "Mengelola"} profil, KTP, KK, rekening, kontrak, penempatan, dan disiplin${read ? " tanpa mengubah data" : " sesuai cakupan lokasi"}. Cuti serta akun diatur terpisah.`;
  if (key === "leave-requests")
    return read
      ? "Melihat pencatatan, keputusan, dan saldo cuti/izin tanpa mengubah data."
      : "Mengelola pencatatan, keputusan, dan saldo cuti/izin sesuai cakupan dan aturan organisasi.";
  if (key === "retirement-policy")
    return `${read ? "Melihat" : "Mengatur"} usia pensiun dan riwayat perubahannya. Tidak otomatis mengakhiri hubungan kerja.`;
  const description = HRIS_MENU_DESCRIPTIONS[key];
  if (!description) return ACCESS_LEVEL_DESCRIPTIONS[level];
  if (key.endsWith("-report")) return description;
  return `${read ? "Melihat" : "Mengelola"} ${description[0].toLowerCase()}${description.slice(1).replace(/\.$/, "")}${read ? " tanpa mengubah data" : ""}.`;
}
export const SCOPE_DESCRIPTIONS = {
  selected: "Akses hanya untuk gudang yang dipilih.",
  all: "Mencakup semua gudang sekarang dan gudang baru berikutnya.",
  master: "Data master digunakan bersama dalam organisasi. Akses operasional diberikan terpisah.",
};
/** Ringkasan dihitung per fitur, bukan jumlah submenu atau grant gudang. */
export function accountFeatureGroups(account) {
  const groups = [];
  if (
    account.hrisAccess?.fullAdmin ||
    account.hrisAccess?.grants?.some((grant) => grant.key !== "dashboard") ||
    (account.hrisAccess?.accountAccess && account.hrisAccess.accountAccess !== "none")
  )
    groups.push({ key: "hris", label: "HRIS", icon: "navigation:employees" });
  if (account.packageAccess?.length)
    groups.push({ key: "inventory", label: "Inventaris", icon: "navigation:inventory" });
  return groups;
}
/** Ringkasan cakupan berasal dari DTO berizin, bukan path file privat. */
export function accessScopeSummary(grant) {
  return grant.packageCode === "inventory_master"
    ? "Master bersama organisasi"
    : grant.scopeMode === "all"
      ? "Seluruh gudang organisasi"
      : (grant.warehouses || [])
          .map(
            (warehouse) =>
              `${warehouse.name}${warehouse.location_name ? ` · ${warehouse.location_name}` : ""}`,
          )
          .join(", ") || "Gudang terpilih belum tersedia";
}
