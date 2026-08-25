import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPLOYEE_IMPORT_SHEET_GUIDANCE,
  EMPLOYEE_IMPORT_SHEETS,
  normalizeImportEmployeeNo,
  normalizeImportNationalId,
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
