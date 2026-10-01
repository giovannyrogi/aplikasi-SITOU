/** Pilihan dan penjelasan filter dipakai bersama oleh daftar, API, serta export. */
export const EMPLOYEE_COMPLETENESS_OPTIONS = Object.freeze([
  { value: "all", label: "Semua pegawai" },
  {
    value: "missing_photo",
    label: "Pas foto belum tersedia",
    description: "Pegawai belum memiliki pas foto yang masih tersimpan.",
  },
  {
    value: "missing_ktp",
    label: "KTP belum lengkap",
    description: "NIK atau foto KTP belum tersedia, termasuk jika keduanya belum tersedia.",
  },
  {
    value: "missing_kk",
    label: "KK belum lengkap",
    description: "Nomor KK atau foto KK belum tersedia, termasuk jika keduanya belum tersedia.",
  },
  {
    value: "missing_npwp",
    label: "NPWP belum lengkap",
    description: "Nomor NPWP atau foto NPWP belum tersedia, termasuk jika keduanya belum tersedia.",
  },
  {
    value: "missing_bpjs_health",
    label: "BPJS Kesehatan belum lengkap",
    description:
      "Nomor atau foto BPJS Kesehatan belum tersedia, termasuk jika keduanya belum tersedia.",
  },
  {
    value: "missing_bpjs_employment",
    label: "BPJS Ketenagakerjaan belum lengkap",
    description:
      "Nomor atau foto BPJS Ketenagakerjaan belum tersedia, termasuk jika keduanya belum tersedia.",
  },
  {
    value: "missing_whatsapp",
    label: "Nomor WhatsApp belum tersedia",
    description: "Nomor WhatsApp pegawai belum diisi.",
  },
  {
    value: "missing_address",
    label: "Alamat belum lengkap",
    description: "Alamat KTP atau alamat domisili belum diisi, termasuk jika keduanya belum diisi.",
  },
  {
    value: "missing_bank_account",
    label: "Rekening belum tersedia",
    description: "Pegawai belum memiliki data bank, nomor rekening, dan nama pemilik yang terisi.",
  },
  {
    value: "missing_emergency_contact",
    label: "Kontak darurat belum tersedia",
    description: "Pegawai belum memiliki kontak darurat dengan nama dan nomor telepon yang terisi.",
  },
  {
    value: "missing_education",
    label: "Pendidikan belum tersedia",
    description:
      "Data pendidikan belum dicatat. Pilihan Tidak/Belum Pernah Sekolah dan Tidak/Belum Tamat SD tetap dihitung sebagai data pendidikan.",
  },
  {
    value: "missing_diploma",
    label: "Ijazah pendidikan terakhir belum tersedia",
    description:
      "Pendidikan formal tertinggi sudah dicatat tetapi foto ijazahnya belum tersedia. Tidak berlaku untuk pilihan Tidak/Belum Pernah Sekolah dan Tidak/Belum Tamat SD.",
  },
]);

export const EMPLOYEE_COMPLETENESS_VALUES = Object.freeze(
  EMPLOYEE_COMPLETENESS_OPTIONS.map((option) => option.value),
);

/** Memberi label yang sama pada filter aktif dan petunjuk workbook. */
export function getEmployeeCompletenessOption(value) {
  return EMPLOYEE_COMPLETENESS_OPTIONS.find((option) => option.value === value);
}
