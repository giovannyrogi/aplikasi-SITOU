import {
  BLOOD_TYPE_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  MARITAL_STATUS_OPTIONS,
} from "./profileOptions.js";

/** Definisi kolom menjadi kontrak bersama untuk template, parser, preview, dan laporan error. */
export const EMPLOYEE_IMPORT_SHEETS = Object.freeze([
  {
    name: "Pegawai",
    entityType: "employee",
    columns: [
      ["employeeNo", "NIP", true],
      ["fullName", "Nama Lengkap", true],
      ["preferredName", "Nama Panggilan"],
      ["nationalId", "NIK", true],
      ["birthPlace", "Tempat Lahir"],
      ["birthDate", "Tanggal Lahir"],
      ["gender", "Jenis Kelamin"],
      ["religion", "Agama"],
      ["maritalStatus", "Status Perkawinan"],
      ["bloodType", "Golongan Darah"],
      ["nationality", "Kewarganegaraan"],
      ["joinedDate", "Tanggal Bergabung"],
      ["employmentStatus", "Status Pegawai", true],
      ["terminationDate", "Tanggal Berakhir"],
      ["terminationReason", "Alasan Berakhir"],
    ],
  },
  {
    name: "Kontak",
    entityType: "contact",
    columns: [
      ["employeeNo", "NIP", true],
      ["personalEmail", "Email Pribadi"],
      ["whatsapp", "Nomor WhatsApp"],
      ["ktpAddress", "Alamat KTP"],
      ["domicileAddress", "Alamat Domisili"],
      ["village", "Kelurahan/Desa"],
      ["district", "Kecamatan"],
      ["city", "Kota/Kabupaten"],
      ["province", "Provinsi"],
      ["postalCode", "Kode Pos"],
    ],
  },
  {
    name: "Identitas",
    entityType: "identifier",
    columns: [
      ["employeeNo", "NIP", true],
      ["identifierType", "Jenis Identitas", true],
      ["identifierValue", "Nomor Identitas", true],
      ["issuedAt", "Tanggal Terbit"],
      ["expiresAt", "Tanggal Kedaluwarsa"],
      ["isVerified", "Terverifikasi"],
    ],
  },
  {
    name: "Rekening",
    entityType: "bank_account",
    columns: [
      ["employeeNo", "NIP", true],
      ["bankName", "Nama Bank", true],
      ["accountNumber", "Nomor Rekening", true],
      ["accountHolder", "Nama Pemilik Rekening", true],
      ["isPrimary", "Rekening Utama"],
    ],
  },
  {
    name: "Keluarga",
    entityType: "dependent",
    columns: [
      ["employeeNo", "NIP", true],
      ["relationship", "Hubungan", true],
      ["fullName", "Nama Lengkap", true],
      ["birthDate", "Tanggal Lahir"],
      ["nationalId", "NIK Keluarga"],
      ["phone", "Nomor Kontak"],
      ["isDependent", "Tanggungan"],
      ["isEmergencyContact", "Kontak Darurat"],
      ["notes", "Catatan"],
    ],
  },
  {
    name: "Kontak_Darurat",
    entityType: "emergency_contact",
    columns: [
      ["employeeNo", "NIP", true],
      ["fullName", "Nama Lengkap", true],
      ["relationship", "Hubungan"],
      ["phone", "Nomor Kontak", true],
      ["address", "Alamat"],
      ["isPrimary", "Kontak Utama"],
    ],
  },
  {
    name: "Akun_Sosial",
    entityType: "social_account",
    columns: [
      ["employeeNo", "NIP", true],
      ["platform", "Platform", true],
      ["handleOrUrl", "Username atau URL", true],
    ],
  },
  {
    name: "Pendidikan",
    entityType: "education",
    refKey: "educationRef",
    columns: [
      ["employeeNo", "NIP", true],
      ["educationRef", "Referensi Pendidikan", true],
      ["educationLevel", "Jenjang", true],
      ["institution", "Institusi"],
      ["fieldOfStudy", "Bidang Studi"],
      ["graduationYear", "Tahun Lulus"],
      ["isHighest", "Pendidikan Tertinggi"],
    ],
  },
  {
    name: "Keahlian",
    entityType: "skill",
    columns: [
      ["employeeNo", "NIP", true],
      ["skillName", "Nama Keahlian", true],
      ["proficiencyLevel", "Tingkat Kemampuan"],
      ["notes", "Catatan"],
    ],
  },
  {
    name: "Sertifikasi",
    entityType: "certification",
    refKey: "certificationRef",
    columns: [
      ["employeeNo", "NIP", true],
      ["certificationRef", "Referensi Sertifikasi", true],
      ["certificationName", "Nama Sertifikasi", true],
      ["issuer", "Penerbit"],
      ["credentialNo", "Nomor Kredensial"],
      ["issuedAt", "Tanggal Terbit"],
      ["expiresAt", "Tanggal Kedaluwarsa"],
    ],
  },
  {
    name: "Kontrak",
    entityType: "contract",
    refKey: "contractRef",
    columns: [
      ["employeeNo", "NIP", true],
      ["contractRef", "Referensi Kontrak", true],
      ["employmentTypeCode", "Kode Jenis Kepegawaian", true],
      ["contractNo", "Nomor Kontrak"],
      ["startDate", "Tanggal Mulai", true],
      ["endDate", "Tanggal Akhir"],
      ["status", "Status Kontrak", true],
      ["notes", "Catatan"],
    ],
  },
  {
    name: "Penempatan",
    entityType: "assignment",
    refKey: "assignmentRef",
    columns: [
      ["employeeNo", "NIP", true],
      ["assignmentRef", "Referensi Penempatan", true],
      ["locationCode", "Kode Lokasi", true],
      ["unitCode", "Kode Divisi/Unit", true],
      ["positionCode", "Kode Jabatan"],
      ["supervisorEmployeeNo", "NIP Atasan"],
      ["assignmentType", "Jenis Penugasan", true],
      ["changeType", "Jenis Perubahan", true],
      ["effectiveFrom", "Tanggal Mulai", true],
      ["effectiveUntil", "Tanggal Akhir"],
      ["decreeNo", "Nomor SK"],
      ["notes", "Catatan"],
    ],
  },
]);

/** Menjadi sumber tunggal petunjuk sheet untuk workbook, modal import, dan dokumentasi. */
export const EMPLOYEE_IMPORT_SHEET_GUIDANCE = Object.freeze([
  {
    name: "Pegawai",
    requirement: "required",
    requirementLabel: "Wajib",
    purpose: "Menyimpan identitas inti dan status setiap pegawai baru.",
    whenToFill: "Selalu diisi. Satu baris untuk setiap pegawai.",
    importantRule:
      "NIP, Nama Lengkap, NIK 16 digit, dan Status Pegawai wajib diisi. NIP menjadi penghubung seluruh sheet.",
  },
  {
    name: "Kontak",
    requirement: "optional",
    requirementLabel: "Opsional",
    purpose: "Menyimpan email pribadi, nomor WhatsApp, dan alamat pegawai.",
    whenToFill: "Isi jika data kontak tersedia.",
    importantRule:
      "Maksimal satu baris kontak untuk setiap NIP. Nomor WhatsApp memakai format +62821... atau 821... tanpa angka 0 di awal.",
  },
  {
    name: "Identitas",
    requirement: "optional",
    requirementLabel: "Opsional",
    purpose: "Menyimpan nomor BPJS, NPWP, paspor, atau identitas administratif lain.",
    whenToFill: "Isi satu atau beberapa baris sesuai identitas yang dimiliki.",
    importantRule: "Jangan mengulang jenis dan nomor identitas yang sama.",
  },
  {
    name: "Rekening",
    requirement: "optional",
    requirementLabel: "Opsional",
    purpose: "Menyimpan rekening bank pegawai.",
    whenToFill: "Isi jika rekening telah tersedia.",
    importantRule:
      "Boleh lebih dari satu rekening, tetapi hanya satu yang ditandai YA sebagai rekening utama.",
  },
  {
    name: "Keluarga",
    requirement: "optional",
    requirementLabel: "Opsional",
    purpose: "Menyimpan pasangan, anak, orang tua, atau anggota keluarga lain.",
    whenToFill: "Isi satu baris untuk setiap anggota keluarga yang perlu dicatat.",
    importantRule: "Gunakan NIP yang sama dengan sheet Pegawai.",
  },
  {
    name: "Kontak_Darurat",
    requirement: "optional",
    requirementLabel: "Opsional",
    purpose: "Menyimpan pihak yang dapat dihubungi dalam keadaan darurat.",
    whenToFill: "Isi jika kontak darurat tersedia.",
    importantRule:
      "Boleh lebih dari satu, tetapi hanya satu yang ditandai YA sebagai kontak utama.",
  },
  {
    name: "Akun_Sosial",
    requirement: "optional",
    requirementLabel: "Opsional",
    purpose: "Menyimpan akun profesional atau sosial yang relevan.",
    whenToFill: "Isi satu baris untuk setiap platform yang perlu dicatat.",
    importantRule: "Masukkan username atau URL yang dapat dikenali, tanpa password.",
  },
  {
    name: "Pendidikan",
    requirement: "optional",
    requirementLabel: "Opsional",
    purpose: "Menyimpan riwayat pendidikan formal pegawai.",
    whenToFill: "Isi satu baris untuk setiap riwayat pendidikan.",
    importantRule:
      "Referensi Pendidikan harus unik dalam workbook dan hanya satu riwayat yang boleh ditandai sebagai pendidikan tertinggi.",
  },
  {
    name: "Keahlian",
    requirement: "optional",
    requirementLabel: "Opsional",
    purpose: "Menyimpan kemampuan atau kompetensi pegawai.",
    whenToFill: "Isi satu baris untuk setiap keahlian.",
    importantRule: "Jangan mengulang nama keahlian yang sama untuk pegawai yang sama.",
  },
  {
    name: "Sertifikasi",
    requirement: "optional",
    requirementLabel: "Opsional",
    purpose: "Menyimpan informasi sertifikasi dan masa berlakunya.",
    whenToFill: "Isi satu baris untuk setiap sertifikasi.",
    importantRule:
      "Sheet hanya menyimpan data sertifikasi. File sertifikat diunggah manual setelah import berhasil.",
  },
  {
    name: "Kontrak",
    requirement: "conditional",
    requirementLabel: "Wajib bersyarat",
    purpose: "Menyimpan kontrak awal dan histori perpanjangan kontrak.",
    whenToFill:
      "Wajib untuk pegawai berstatus aktif, masa percobaan, atau cuti (active, probation, atau leave).",
    importantRule:
      "Gunakan kode jenis kepegawaian dari Referensi. Periode kontrak untuk pegawai yang sama tidak boleh bertumpuk.",
  },
  {
    name: "Penempatan",
    requirement: "conditional",
    requirementLabel: "Wajib bersyarat",
    purpose: "Menyimpan lokasi, Divisi & Unit, jabatan, atasan, serta histori mutasi.",
    whenToFill:
      "Wajib untuk pegawai berstatus aktif, masa percobaan, atau cuti (active, probation, atau leave).",
    importantRule:
      "Gunakan kode dari Referensi. Periode harus berurutan dan hanya boleh ada satu penempatan utama yang aktif.",
  },
]);

export const IMPORT_SHEET_MAP = new Map(
  EMPLOYEE_IMPORT_SHEETS.map((definition) => [definition.name, definition]),
);

/** Pilihan import memakai label UI, sedangkan value tetap mengikuti kontrak API dan database. */
export const IMPORT_OPTION_GROUPS = Object.freeze({
  gender: Object.freeze([
    { value: "male", label: "Laki-laki" },
    { value: "female", label: "Perempuan" },
    { value: "undisclosed", label: "Tidak disebutkan" },
  ]),
  maritalStatus: MARITAL_STATUS_OPTIONS,
  bloodType: BLOOD_TYPE_OPTIONS,
  employmentStatus: Object.freeze([
    { value: "active", label: "Aktif" },
    { value: "probation", label: "Masa percobaan" },
    { value: "leave", label: "Cuti" },
    { value: "suspended", label: "Ditangguhkan" },
  ]),
  identifierType: Object.freeze([
    { value: "family_card", label: "Kartu Keluarga" },
    { value: "bpjs_health", label: "BPJS Kesehatan" },
    { value: "bpjs_employment", label: "BPJS Ketenagakerjaan" },
    { value: "tax_npwp", label: "NPWP" },
  ]),
  dependentRelationship: Object.freeze([
    { value: "spouse", label: "Pasangan" },
    { value: "child", label: "Anak" },
    { value: "parent", label: "Orang tua" },
    { value: "sibling", label: "Saudara" },
    { value: "other", label: "Lainnya" },
  ]),
  socialPlatform: Object.freeze(
    [
      "Facebook",
      "Instagram",
      "TikTok",
      "LinkedIn",
      "X",
      "YouTube",
      "Telegram",
      "WhatsApp",
      "Threads",
    ].map((value) => Object.freeze({ value, label: value })),
  ),
  educationLevel: EDUCATION_LEVEL_OPTIONS,
  proficiencyLevel: Object.freeze([
    { value: "pemula", label: "Pemula" },
    { value: "dasar", label: "Dasar" },
    { value: "menengah", label: "Menengah" },
    { value: "mahir", label: "Mahir" },
    { value: "ahli", label: "Ahli" },
  ]),
  contractStatus: Object.freeze([
    { value: "draft", label: "Draft" },
    { value: "active", label: "Aktif" },
    { value: "expired", label: "Berakhir" },
    { value: "terminated", label: "Dihentikan" },
    { value: "renewed", label: "Diperpanjang" },
  ]),
  assignmentType: Object.freeze([
    { value: "primary", label: "Utama" },
    { value: "acting", label: "Pelaksana tugas" },
    { value: "temporary", label: "Sementara" },
    { value: "additional", label: "Tambahan" },
  ]),
  changeType: Object.freeze([
    { value: "initial", label: "Penempatan awal" },
    { value: "rotation", label: "Rolling" },
    { value: "transfer", label: "Mutasi" },
    { value: "promotion", label: "Promosi" },
    { value: "demotion", label: "Demosi" },
    { value: "acting", label: "Pelaksana tugas" },
    { value: "correction", label: "Koreksi" },
  ]),
  boolean: Object.freeze([
    { value: "YA", label: "YA" },
    { value: "TIDAK", label: "TIDAK" },
  ]),
});

const IMPORT_OPTION_GROUP_BY_FIELD = Object.freeze({
  "Pegawai.gender": "gender",
  "Pegawai.maritalStatus": "maritalStatus",
  "Pegawai.bloodType": "bloodType",
  "Pegawai.employmentStatus": "employmentStatus",
  "Identitas.identifierType": "identifierType",
  "Identitas.isVerified": "boolean",
  "Rekening.isPrimary": "boolean",
  "Keluarga.relationship": "dependentRelationship",
  "Keluarga.isDependent": "boolean",
  "Keluarga.isEmergencyContact": "boolean",
  "Kontak_Darurat.isPrimary": "boolean",
  "Akun_Sosial.platform": "socialPlatform",
  "Pendidikan.educationLevel": "educationLevel",
  "Pendidikan.isHighest": "boolean",
  "Keahlian.proficiencyLevel": "proficiencyLevel",
  "Kontrak.status": "contractStatus",
  "Penempatan.assignmentType": "assignmentType",
  "Penempatan.changeType": "changeType",
});

/** Menentukan daftar pilihan berdasarkan sheet agar field bernama sama tidak salah divalidasi. */
export function getImportOptionGroup(sheetName, fieldKey) {
  return IMPORT_OPTION_GROUP_BY_FIELD[`${sheetName}.${fieldKey}`] || null;
}

/** Menerima label dropdown baru maupun kode canonical dari template versi lama. */
export function normalizeImportOption(groupName, value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  const normalized = text.toLocaleLowerCase("id-ID");
  const option = IMPORT_OPTION_GROUPS[groupName]?.find(
    (item) =>
      String(item.value).trim().toLocaleLowerCase("id-ID") === normalized ||
      String(item.label).trim().toLocaleLowerCase("id-ID") === normalized,
  );
  return option?.value ?? text;
}

/** Memberikan label contoh yang sama dengan nilai yang terlihat pada dropdown aplikasi. */
function getImportOptionLabel(groupName, value) {
  return IMPORT_OPTION_GROUPS[groupName]?.find((item) => item.value === value)?.label || value;
}

export const IMPORT_ENUMS = Object.freeze(
  Object.fromEntries(
    Object.entries(IMPORT_OPTION_GROUPS).map(([key, options]) => [
      key,
      Object.freeze(options.map((option) => option.value)),
    ]),
  ),
);

/** Memeriksa nilai canonical hasil normalisasi sebelum data masuk ke staging import. */
export function isSupportedImportOption(groupName, value) {
  if (groupName === "boolean") return typeof value === "boolean";
  return IMPORT_ENUMS[groupName]?.includes(value) || false;
}

/** Menyatukan variasi spasi dan kapital NIP sebelum validasi duplikat. */
export function normalizeImportEmployeeNo(value) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  return normalized || null;
}

/** Menyimpan NIK sebagai digit canonical agar pemisah visual tidak melewati deteksi duplikat. */
export function normalizeImportNationalId(value) {
  const normalized = String(value ?? "").replace(/\D/g, "");
  return normalized || null;
}

/** Menyediakan contoh sintetis yang harus dihapus pengguna sebelum import sebenarnya. */
export function getImportExample(sheetName) {
  const common = { employeeNo: "CONTOH-001" };
  const examples = {
    Pegawai: {
      ...common,
      fullName: "Contoh Pegawai",
      nationalId: "7100000000000001",
      nationality: "Indonesia",
      joinedDate: "2026-08-22",
      employmentStatus: getImportOptionLabel("employmentStatus", "active"),
    },
    Kontak: { ...common, personalEmail: "contoh@pribadi.test", whatsapp: "+628123456789" },
    Identitas: {
      ...common,
      identifierType: getImportOptionLabel("identifierType", "tax_npwp"),
      identifierValue: "CONTOH",
    },
    Rekening: {
      ...common,
      bankName: "Bank Contoh",
      accountNumber: "000000",
      accountHolder: "Contoh Pegawai",
      isPrimary: "YA",
    },
    Keluarga: {
      ...common,
      relationship: getImportOptionLabel("dependentRelationship", "spouse"),
      fullName: "Contoh Keluarga",
      isDependent: "YA",
    },
    Kontak_Darurat: {
      ...common,
      fullName: "Contoh Kontak",
      phone: "+628123456789",
      isPrimary: "YA",
    },
    Akun_Sosial: { ...common, platform: "LinkedIn", handleOrUrl: "contoh" },
    Pendidikan: {
      ...common,
      educationRef: "PEND-001",
      educationLevel: getImportOptionLabel("educationLevel", "S1"),
      institution: "Universitas Contoh",
      isHighest: "YA",
    },
    Keahlian: {
      ...common,
      skillName: "Administrasi",
      proficiencyLevel: getImportOptionLabel("proficiencyLevel", "mahir"),
    },
    Sertifikasi: {
      ...common,
      certificationRef: "SERT-001",
      certificationName: "Sertifikasi Contoh",
    },
    Kontrak: {
      ...common,
      contractRef: "KON-001",
      employmentTypeCode: "PKWTT",
      startDate: "2026-08-22",
      status: getImportOptionLabel("contractStatus", "active"),
    },
    Penempatan: {
      ...common,
      assignmentRef: "PEN-001",
      locationCode: "PUSAT",
      unitCode: "DIV_SDM",
      positionCode: "STAF",
      assignmentType: getImportOptionLabel("assignmentType", "primary"),
      changeType: getImportOptionLabel("changeType", "initial"),
      effectiveFrom: "2026-08-22",
    },
  };
  return examples[sheetName] || common;
}
