export const EDUCATION_LEVEL_NEVER_SCHOOL = "Tidak/Belum Pernah Sekolah";
export const EDUCATION_LEVEL_INCOMPLETE_PRIMARY = "Tidak/Belum Tamat SD";

/** Jenjang yang tidak memakai rincian sekolah, kelulusan, atau ijazah. */
export const EDUCATION_LEVELS_WITHOUT_DETAILS = Object.freeze([
  EDUCATION_LEVEL_NEVER_SCHOOL,
  EDUCATION_LEVEL_INCOMPLETE_PRIMARY,
]);

export function isEducationLevelWithoutDetails(value) {
  return EDUCATION_LEVELS_WITHOUT_DETAILS.includes(value);
}

/** Menghapus detail yang tidak berlaku sebelum data pendidikan dikirim atau disimpan. */
export function normalizeEducationWithoutDetails(education) {
  if (!isEducationLevelWithoutDetails(education?.educationLevel)) return education;
  return {
    ...education,
    institution: null,
    fieldOfStudy: null,
    graduationYear: null,
    isHighest: true,
    certificateFileId: null,
    ...(Object.hasOwn(education, "certificateFile") ? { certificateFile: null } : {}),
  };
}

/** Pilihan jenjang pendidikan terpusat untuk seluruh form profil pegawai. */
export const EDUCATION_LEVEL_OPTIONS = Object.freeze([
  { value: EDUCATION_LEVEL_NEVER_SCHOOL, label: EDUCATION_LEVEL_NEVER_SCHOOL },
  { value: EDUCATION_LEVEL_INCOMPLETE_PRIMARY, label: EDUCATION_LEVEL_INCOMPLETE_PRIMARY },
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
/** Status perkawinan memakai kode stabil dan label resmi Bahasa Indonesia. */
export const MARITAL_STATUS_OPTIONS = Object.freeze([
  { value: "single", label: "Belum Menikah" },
  { value: "married", label: "Menikah" },
  { value: "divorced", label: "Cerai Hidup" },
  { value: "widowed", label: "Cerai Mati" },
]);

export const MARITAL_STATUS_VALUES = Object.freeze(
  MARITAL_STATUS_OPTIONS.map((option) => option.value),
);

const MARITAL_STATUS_ALIASES = Object.freeze({
  "belum menikah": "single",
  lajang: "single",
  menikah: "married",
  "cerai hidup": "divorced",
  "cerai mati": "widowed",
});

/** Menormalkan nilai draft lama yang pernah menyimpan label sebagai nilai dropdown. */
export function normalizeMaritalStatus(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (MARITAL_STATUS_VALUES.includes(normalized)) return normalized;
  return MARITAL_STATUS_ALIASES[normalized] || value;
}
