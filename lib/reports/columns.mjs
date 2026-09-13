/** Satu definisi kolom menjaga tabel, card, dan Excel memiliki informasi setara. */
export function reportColumns(kind) {
  const common = [
    ["employee_no", "NIP"],
    ["full_name", "Nama pegawai"],
    ["location_name", "Lokasi"],
    ["unit_name", "Divisi & Unit"],
    ["position_name", "Jabatan"],
    ["employment_type_name", "Jenis kepegawaian"],
  ];
  return [
    ...common,
    ...(kind === "retirements"
      ? [
          ["birth_date", "Tanggal lahir"],
          ["age", "Usia (tahun)"],
          ["joined_date", "Tanggal bergabung"],
          ["tenure", "Masa kerja"],
          ["due_date", "Tanggal proyeksi pensiun"],
        ]
      : [
          ["contract_no", "Nomor kontrak"],
          ["start_date", "Tanggal mulai kontrak"],
          ["due_date", "Tanggal akhir kontrak"],
          ["successor_start_date", "Mulai kontrak berikutnya"],
        ]),
    ["deadline", "Sisa waktu"],
  ];
}

/** Nilai kosong diberi konteks tanpa menebak informasi pegawai. */
export function reportValue(row, key) {
  if (row[key] !== null && row[key] !== undefined && row[key] !== "") return row[key];
  if (key === "successor_start_date") return "Belum tercatat";
  if (["location_name", "unit_name", "position_name"].includes(key)) return "Belum ditempatkan";
  if (key === "employment_type_name") return "Belum ditentukan";
  return "—";
}
