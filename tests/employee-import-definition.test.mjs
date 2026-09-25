import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EMPLOYEE_IMPORT_SHEET_GUIDANCE,
  EMPLOYEE_IMPORT_SHEETS,
  EMPLOYEE_IMPORT_TEMPLATE_OUTDATED_MESSAGE,
  EMPLOYEE_IMPORT_TEMPLATE_SUBJECT,
  EMPLOYEE_IMPORT_TEMPLATE_VERSION,
  IMPORT_ENUMS,
  isCurrentEmployeeImportTemplate,
  IMPORT_OPTION_GROUPS,
  getImportOptionGroup,
  isSupportedImportOption,
  normalizeImportEmployeeNo,
  normalizeImportHeader,
  normalizeImportNationalId,
  normalizeImportOption,
} from "../lib/employees/importDefinition.js";
import {
  DEPENDENT_RELATIONSHIP_LABELS,
  DEPENDENT_RELATIONSHIP_OPTIONS,
  DEPENDENT_RELATIONSHIP_VALUES,
  formatDependentRelationship,
  getLegacyDependentRelationshipMessage,
} from "../lib/employees/dependentRelationships.js";
import { employeeProfileSectionsSchema } from "../lib/employees/profileSchemas.js";

const EXPECTED_DEPENDENT_RELATIONSHIPS = [
  ["wife", "Istri"],
  ["husband", "Suami"],
  ["child", "Anak"],
  ["father", "Ayah"],
  ["mother", "Ibu"],
  ["sibling", "Saudara kandung"],
  ["father_in_law", "Ayah mertua"],
  ["mother_in_law", "Ibu mertua"],
  ["grandfather", "Kakek"],
  ["grandmother", "Nenek"],
  ["grandchild", "Cucu"],
  ["guardian", "Wali"],
  ["other", "Lainnya"],
];

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

test("template import memakai versi baru setelah pemusatan kontak darurat", () => {
  assert.equal(EMPLOYEE_IMPORT_TEMPLATE_VERSION, 2);
  assert.equal(EMPLOYEE_IMPORT_TEMPLATE_SUBJECT, "SITOU_EMPLOYEE_IMPORT_V2");
  assert.equal(isCurrentEmployeeImportTemplate(EMPLOYEE_IMPORT_TEMPLATE_SUBJECT), true);
  assert.equal(isCurrentEmployeeImportTemplate("SITOU_EMPLOYEE_IMPORT_V1"), false);
  assert.match(EMPLOYEE_IMPORT_TEMPLATE_OUTDATED_MESSAGE, /Kontak_Darurat/);
  const family = EMPLOYEE_IMPORT_SHEETS.find((sheet) => sheet.name === "Keluarga");
  const keys = family.columns.map(([key]) => key);
  assert.equal(keys.includes("phone"), false);
  assert.equal(keys.includes("isEmergencyContact"), false);
});

test("commit batch lama ditolak sebelum status batch diklaim", () => {
  const service = readFileSync(
    new URL("../lib/employees/importService.js", import.meta.url),
    "utf8",
  );
  assert.match(
    service,
    /normalized_data \?\| ARRAY\['phone','isEmergencyContact'\][\s\S]*?IMPORT_TEMPLATE_OUTDATED[\s\S]*?const claimed/,
  );
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
    Keluarga: ["relationship", "isDependent"],
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

test("hubungan keluarga mempunyai 13 kode dan label eksplisit dari satu sumber", () => {
  assert.deepEqual(
    DEPENDENT_RELATIONSHIP_OPTIONS.map(({ value, label }) => [value, label]),
    EXPECTED_DEPENDENT_RELATIONSHIPS,
  );
  assert.deepEqual(
    DEPENDENT_RELATIONSHIP_VALUES,
    EXPECTED_DEPENDENT_RELATIONSHIPS.map(([value]) => value),
  );
  assert.equal(IMPORT_OPTION_GROUPS.dependentRelationship, DEPENDENT_RELATIONSHIP_OPTIONS);
  assert.equal(formatDependentRelationship("grandfather"), "Kakek");
  assert.equal(formatDependentRelationship("grandmother"), "Nenek");
  for (const relationship of ["spouse", "parent", "grandparent"])
    assert.equal(Object.hasOwn(DEPENDENT_RELATIONSHIP_LABELS, relationship), false);
});

test("schema profil menerima hubungan baru dan menolak hubungan ambigu lama", () => {
  for (const relationship of DEPENDENT_RELATIONSHIP_VALUES)
    assert.equal(
      employeeProfileSectionsSchema.safeParse({
        dependents: [{ relationship, fullName: "Anggota Keluarga" }],
      }).success,
      true,
      relationship,
    );

  for (const relationship of ["spouse", "parent", "grandparent"])
    assert.equal(
      employeeProfileSectionsSchema.safeParse({
        dependents: [{ relationship, fullName: "Anggota Keluarga" }],
      }).success,
      false,
      relationship,
    );
});

test("schema profil menolak field kontak keluarga lama dengan petunjuk khusus", () => {
  const result = employeeProfileSectionsSchema.safeParse({
    dependents: [
      {
        relationship: "wife",
        fullName: "Anggota Keluarga",
        phone: "+628123456789",
        isEmergencyContact: true,
      },
    ],
  });
  assert.equal(result.success, false);
  assert.equal(
    result.error.issues.some(
      (issue) =>
        issue.path.join(".") === "dependents.0.phone" &&
        /Kontak darurat/.test(issue.message),
    ),
    true,
  );
  assert.equal(
    result.error.issues.some(
      (issue) => issue.path.join(".") === "dependents.0.isEmergencyContact",
    ),
    true,
  );
});

test("import menormalisasi label baru dan menjelaskan koreksi nilai lama", () => {
  assert.equal(normalizeImportOption("dependentRelationship", "Istri"), "wife");
  assert.equal(normalizeImportOption("dependentRelationship", "Nenek"), "grandmother");
  assert.equal(isSupportedImportOption("dependentRelationship", "wife"), true);
  assert.equal(isSupportedImportOption("dependentRelationship", "spouse"), false);
  assert.equal(
    getLegacyDependentRelationshipMessage("PASANGAN"),
    "Hubungan Pasangan sudah tidak digunakan. Pilih Istri atau Suami.",
  );
  assert.equal(
    getLegacyDependentRelationshipMessage("Orang tua"),
    "Hubungan Orang tua sudah tidak digunakan. Pilih Ayah atau Ibu.",
  );
  assert.equal(
    getLegacyDependentRelationshipMessage("grandparent"),
    "Pilih Kakek atau Nenek sebagai hubungan keluarga.",
  );
});
