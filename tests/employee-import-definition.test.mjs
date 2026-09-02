import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPLOYEE_IMPORT_SHEET_GUIDANCE,
  EMPLOYEE_IMPORT_SHEETS,
  IMPORT_ENUMS,
  IMPORT_OPTION_GROUPS,
  getImportOptionGroup,
  isSupportedImportOption,
  normalizeImportEmployeeNo,
  normalizeImportHeader,
  normalizeImportNationalId,
  normalizeImportOption,
} from "../lib/employees/importDefinition.js";

test("template import mempunyai seluruh sheet domain dengan nama unik", () => {
  const names = EMPLOYEE_IMPORT_SHEETS.map((sheet) => sheet.name);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(names, [
    "Pegawai",
    "Kontak",
    "Identitas",
    "Rekening",
    "Keluarga",
    "Kontak_Darurat",
    "Akun_Sosial",
    "Pendidikan",
    "Keahlian",
    "Sertifikasi",
    "Kontrak",
    "Penempatan",
  ]);
});

test("petunjuk mengklasifikasikan seluruh sheet dari satu sumber yang sama", () => {
  assert.deepEqual(
    EMPLOYEE_IMPORT_SHEET_GUIDANCE.map((item) => item.name),
    EMPLOYEE_IMPORT_SHEETS.map((item) => item.name),
  );
  assert.equal(
    EMPLOYEE_IMPORT_SHEET_GUIDANCE.find((item) => item.name === "Pegawai")?.requirement,
    "required",
  );
  for (const name of ["Kontrak", "Penempatan"])
    assert.equal(
      EMPLOYEE_IMPORT_SHEET_GUIDANCE.find((item) => item.name === name)?.requirement,
      "conditional",
    );
  for (const guidance of EMPLOYEE_IMPORT_SHEET_GUIDANCE.filter(
    (item) => !["Pegawai", "Kontrak", "Penempatan"].includes(item.name),
  ))
    assert.equal(guidance.requirement, "optional");
});

test("setiap sheet data ditautkan menggunakan NIP", () => {
  for (const sheet of EMPLOYEE_IMPORT_SHEETS)
    assert.equal(sheet.columns[0][0], "employeeNo", `${sheet.name} tidak memiliki employeeNo`);
});

test("sheet Kontak hanya memuat email pribadi dan WhatsApp pegawai", () => {
  const contactSheet = EMPLOYEE_IMPORT_SHEETS.find((item) => item.name === "Kontak");
  const contactKeys = contactSheet.columns.map(([key]) => key);
  const contactHeaders = contactSheet.columns.map(([, header]) => header);

  assert.ok(contactKeys.includes("personalEmail"));
  assert.ok(contactKeys.includes("whatsapp"));
  assert.equal(contactKeys.includes("workEmail"), false);
  assert.equal(contactKeys.includes("phone"), false);
  assert.equal(contactHeaders.includes("Email Organisasi"), false);
  assert.equal(contactHeaders.includes("Telepon"), false);
});

test("entitas histori memiliki referensi workbook", () => {
  for (const name of ["Pendidikan", "Sertifikasi", "Kontrak", "Penempatan"]) {
    const sheet = EMPLOYEE_IMPORT_SHEETS.find((item) => item.name === name);
    assert.ok(sheet.refKey, `${name} wajib mempunyai refKey`);
    assert.ok(sheet.columns.some(([key]) => key === sheet.refKey));
  }
});

test("NIK wajib pada sheet Pegawai dan domain non-kepegawaian tidak tersedia", () => {
  const employeeSheet = EMPLOYEE_IMPORT_SHEETS.find((item) => item.name === "Pegawai");
  assert.deepEqual(
    employeeSheet.columns.find(([key]) => key === "nationalId"),
    ["nationalId", "NIK", true],
  );
  for (const removed of ["Dokumen", "Kasus_Disiplin", "Tindakan_Disiplin"])
    assert.equal(
      EMPLOYEE_IMPORT_SHEETS.some((item) => item.name === removed),
      false,
    );
});

test("identitas import dinormalisasi sebelum pemeriksaan duplikat", () => {
  assert.equal(normalizeImportEmployeeNo(" pgw-001 "), "PGW-001");
  assert.equal(normalizeImportNationalId("71 71-0202-0303-0001"), "7171020203030001");
});

test("seluruh field pilihan template dipetakan sesuai kontrol aplikasi", () => {
  const expectedDropdowns = {
    Pegawai: ["gender", "maritalStatus", "bloodType", "employmentStatus"],
    Identitas: ["identifierType", "isVerified"],
    Rekening: ["isPrimary"],
    Keluarga: ["relationship", "isDependent", "isEmergencyContact"],
    Kontak_Darurat: ["isPrimary"],
    Akun_Sosial: ["platform"],
    Pendidikan: ["educationLevel", "isHighest"],
    Keahlian: ["proficiencyLevel"],
    Kontrak: ["status"],
    Penempatan: ["assignmentType", "changeType"],
  };

  for (const [sheetName, keys] of Object.entries(expectedDropdowns))
    for (const key of keys)
      assert.ok(getImportOptionGroup(sheetName, key), `${sheetName}.${key} belum punya pilihan`);

  assert.equal(getImportOptionGroup("Kontak_Darurat", "relationship"), null);
});

test("label dropdown Excel dinormalisasi ke kode sistem tanpa memutus template lama", () => {
  assert.equal(normalizeImportOption("gender", "Laki-laki"), "male");
  assert.equal(normalizeImportOption("maritalStatus", "Belum Menikah"), "single");
  assert.equal(normalizeImportOption("educationLevel", "Sarjana (S1)"), "S1");
  assert.equal(normalizeImportOption("assignmentType", "Utama"), "primary");
  assert.equal(normalizeImportOption("employmentStatus", "active"), "active");
  assert.equal(normalizeImportOption("employmentStatus", "nilai asing"), "nilai asing");
});

test("header tanggal bergabung baru tetap menerima template lama", () => {
  const employeeSheet = EMPLOYEE_IMPORT_SHEETS.find((item) => item.name === "Pegawai");
  assert.deepEqual(
    employeeSheet.columns.find(([key]) => key === "joinedDate"),
    ["joinedDate", "Tanggal Bergabung di Organisasi"],
  );
  assert.equal(
    normalizeImportHeader("Pegawai", "Tanggal Bergabung"),
    "Tanggal Bergabung di Organisasi",
  );
});
test("header dokumen penempatan baru dan template lama dipetakan ke kontrak yang sama", () => {
  const assignmentSheet = EMPLOYEE_IMPORT_SHEETS.find((item) => item.name === "Penempatan");
  assert.deepEqual(
    assignmentSheet.columns.find(([key]) => key === "decreeNo"),
    ["decreeNo", "Nomor Dokumen Penempatan"],
  );
  assert.equal(
    normalizeImportHeader("Penempatan", "Nomor SK"),
    "Nomor Dokumen Penempatan",
  );
  assert.equal(
    normalizeImportHeader("Penempatan", "Nomor Dokumen Penempatan"),
    "Nomor Dokumen Penempatan",
  );
});
test("nilai boolean hasil normalisasi diterima oleh validator pilihan", () => {
  assert.equal(isSupportedImportOption("boolean", true), true);
  assert.equal(isSupportedImportOption("boolean", false), true);
  assert.equal(isSupportedImportOption("boolean", "YA"), false);
  assert.equal(isSupportedImportOption("employmentStatus", "active"), true);
  assert.equal(isSupportedImportOption("employmentStatus", "Aktif"), false);
});

test("pilihan import pegawai baru tidak menawarkan status final atau identitas yang tidak ada di form", () => {
  assert.deepEqual(IMPORT_ENUMS.employmentStatus, ["active", "probation", "suspended"]);
  assert.deepEqual(IMPORT_ENUMS.identifierType, [
    "family_card",
    "bpjs_health",
    "bpjs_employment",
    "tax_npwp",
  ]);
  assert.ok(IMPORT_OPTION_GROUPS.educationLevel.some((option) => option.value === "S3"));
  for (const status of ["terminated", "retired", "deceased"])
    assert.equal(IMPORT_ENUMS.employmentStatus.includes(status), false);
});
