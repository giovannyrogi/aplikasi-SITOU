/** Pilihan jenjang pendidikan terpusat untuk seluruh form profil pegawai. */
export const EDUCATION_LEVEL_OPTIONS = Object.freeze([
  { value: "PAUD/TK", label: "PAUD/TK atau sederajat" },
  { value: "SD", label: "SD/MI atau sederajat" },
  { value: "SMP", label: "SMP/MTs atau sederajat" },
  { value: "SMA", label: "Sekolah Menengah Atas (SMA)" },
  { value: "SMK", label: "Sekolah Menengah Kejuruan (SMK)" },
  { value: "MA", label: "Madrasah Aliyah (MA)" },
  { value: "Paket A", label: "Paket A" },
  { value: "Paket B", label: "Paket B" },
  { value: "Paket C", label: "Paket C" },
  { value: "D1", label: "Diploma I (D1)" },
  { value: "D2", label: "Diploma II (D2)" },
  { value: "D3", label: "Diploma III (D3)" },
  { value: "D4", label: "Diploma IV/Sarjana Terapan (D4)" },
  { value: "S1", label: "Sarjana (S1)" },
  { value: "Profesi", label: "Pendidikan Profesi" },
  { value: "Spesialis", label: "Spesialis/Subspesialis" },
  { value: "S2", label: "Magister (S2)" },
  { value: "S3", label: "Doktor (S3)" },
  { value: "Lainnya", label: "Jenjang lainnya" },
]);

/** Golongan darah memakai nilai administratif yang umum dan dapat dikosongkan. */
export const BLOOD_TYPE_OPTIONS = Object.freeze(
  ["A", "B", "AB", "O"].map((value) => ({ value, label: value })),
);
