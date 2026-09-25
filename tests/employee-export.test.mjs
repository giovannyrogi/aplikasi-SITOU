import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { buildEmployeeExportWorkbook } from "../lib/employees/exportWorkbook.mjs";

const employees = [
  {
    id: "10", employee_no: "000123", full_name: '=HYPERLINK("https://invalid")',
    preferred_name: "A", national_id: "7171010101010001", birth_place: "Manado",
    birth_date: "1990-01-01", gender: "male", religion: "Kristen", marital_status: "married",
    blood_type: "O", nationality: "Indonesia", joined_date: "2020-01-01",
    employment_status: "active", profile_photo_file_id: "91", has_contact_data: true,
    personal_email: "pegawai@example.test", whatsapp: "+628123456789", ktp_address: "Alamat A",
    domicile_address: "Alamat B", village: "Wenang", district: "Wenang", city: "Manado",
    province: "Sulawesi Utara", postal_code: "95111", assignment_id: "1",
    location_name: "Kantor Pusat", unit_name: "SDM", position_name: "Staff", supervisor_name: "Atasan",
    assignment_effective_from: "2020-01-01", contract_id: "2", employment_type_name: "PKWTT",
    contract_no: "001/HR", contract_start_date: "2020-01-01", contract_end_date: null,
    contract_status: "active", account_status: "active",
  },
  {
    id: "11", employee_no: "000124", full_name: '=HYPERLINK("https://invalid")',
    national_id: "7171010101010002", gender: "female", nationality: "Indonesia",
    employment_status: "active", profile_photo_file_id: null, has_contact_data: false,
    account_status: "not_linked",
  },
];

const report = {
  organization: { name: "Organisasi Uji", timezone: "Asia/Makassar" },
  generatedAt: "2026-09-24T00:00:00.000Z",
  asOf: "2026-09-24",
  filters: { search: "", employmentStatus: "all", completeness: "all", sanction: "all" },
  filterLabels: {}, employees,
  documents: [
    { employee_id: "10", document_kind: "pas_foto", file_count: 1, latest_uploaded_at: "2026-09-20T00:00:00Z" },
    { employee_id: "10", document_kind: "ktp", file_count: 1, latest_uploaded_at: "2026-09-21T00:00:00Z" },
  ],
  sections: {
    identifiers: [{ id: "1", employee_id: "10", identifier_type: "bpjs_health", identifier_value: "0000012345", is_verified: true, has_document: false }],
    bankAccounts: [{ id: "1", employee_id: "10", bank_name: "Bank", account_number: "001234", account_holder: "Pemilik", is_primary: true }],
    dependents: [
      {
        id: "3",
        employee_id: "10",
        relationship: "wife",
        full_name: "Anggota Keluarga Uji",
        birth_date: "1992-02-02",
        is_dependent: true,
      },
    ],
    emergencyContacts: [], socialAccounts: [], educations: [], skills: [], certifications: [],
    contracts: [{ id: "2", employee_id: "10", employment_type_name: "PKWTT", employment_type_code: "PKWTT", contract_no: "001/HR", start_date: "2020-01-01", status: "active", has_document: true }],
    assignments: [{ id: "1", employee_id: "10", location_name: "Kantor Pusat", unit_name: "SDM", position_name: "Staff", assignment_type: "primary", change_type: "initial", effective_from: "2020-01-01", has_document: true }],
  },
  detailRowCount: 4,
  sheetRowCounts: {},
};

const expectedSheets = [
  "Petunjuk",
  "Ringkasan",
  "Kelengkapan Dokumen",
  "Kontak",
  "Rekening",
  "Keluarga",
  "Kontak Darurat",
  "Akun Sosial",
  "Pendidikan",
  "Keahlian",
  "Sertifikasi",
  "Riwayat Kontrak",
  "Riwayat Penempatan",
];

test("workbook pegawai memiliki seluruh sheet dan penghubung NIP serta nama", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildEmployeeExportWorkbook(report));
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), expectedSheets);
  for (const sheet of workbook.worksheets.slice(1))
    assert.deepEqual(sheet.getRow(1).values.slice(1, 4), ["No", "NIP", "Nama Pegawai"]);
  const summary = workbook.getWorksheet("Ringkasan");
  assert.deepEqual([summary.getCell("B2").value, summary.getCell("B3").value], ["000123", "000124"]);
  assert.equal(summary.getCell("C2").value, '=HYPERLINK("https://invalid")');
  assert.equal(summary.getCell("C2").formula, undefined);
  const family = workbook.getWorksheet("Keluarga");
  assert.equal(family.getCell("C2").value, '=HYPERLINK("https://invalid")');
  assert.equal(family.getCell("E2").value, "Anggota Keluarga Uji");
  assert.notEqual(family.getCell("C2").value, family.getCell("E2").value);
  assert.equal(family.getRow(1).values.slice(1).includes("Telepon"), false);
});

test("workbook menjaga nomor sebagai teks, status file, dan placeholder data kosong", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildEmployeeExportWorkbook(report));
  const rekening = workbook.getWorksheet("Rekening");
  assert.equal(rekening.getCell("B2").value, "000123");
  assert.equal(rekening.getCell("B3").value, "000124");
  assert.equal(rekening.getCell("D3").value, "Belum ada data");
  assert.equal(rekening.getColumn(2).numFmt, "@");
  const documents = workbook.getWorksheet("Kelengkapan Dokumen");
  assert.equal(documents.getCell("D2").value, "Ada (1 file)");
  assert.equal(documents.getCell("D3").value, "Belum ada");
  assert.equal(documents.getCell("D2").alignment.vertical, "middle");
  assert.equal(documents.getRow(1).alignment.vertical, "middle");
  const guideText = workbook
    .getWorksheet("Petunjuk")
    .getSheetValues()
    .flatMap((row) => (Array.isArray(row) ? row.slice(1) : []))
    .join(" ");
  assert.match(guideText, /Waktu Pengunduhan 24 September 2026/);
  assert.doesNotMatch(guideText, /Tanggal snapshot|Jumlah baris detail|UTC|2026-09-24T/);
  assert.equal(workbook.getWorksheet("Identitas"), undefined);
  const contactHeaders = workbook.getWorksheet("Kontak").getRow(1).values.slice(1);
  assert.deepEqual(contactHeaders, [
    "No",
    "NIP",
    "Nama Pegawai",
    "Email Pribadi",
    "WhatsApp",
    "Alamat KTP",
    "Alamat Domisili",
  ]);
  for (const sheet of workbook.worksheets.slice(1))
    assert.doesNotMatch(sheet.getRow(1).values.slice(1).join(" "), /Status Data/);
  const summaryHeaders = workbook.getWorksheet("Ringkasan").getRow(1).values.slice(1);
  assert.ok(summaryHeaders.includes("Jumlah Dokumen Tersedia"));
  assert.ok(summaryHeaders.includes("Dokumen yang Belum Tersedia"));
  assert.ok(!summaryHeaders.includes("Email Pribadi"));
  assert.ok(!summaryHeaders.includes("Nomor Kontrak Aktif"));
  const documentHeaders = documents.getRow(1).values.slice(1);
  assert.ok(!documentHeaders.some((header) => /Jumlah Jenis/.test(String(header))));
  const visibleText = workbook.worksheets.flatMap((sheet) =>
    sheet.getSheetValues().flatMap((row) => Array.isArray(row) ? row.slice(1) : []),
  ).join(" ");
  assert.doesNotMatch(visibleText, /object_key|\/api\/uploads|document_file_id|profile_photo_file_id/i);
});

test("route dan migration membatasi export sensitif serta memakai filter bersama", () => {
  const read = (relative) => readFileSync(new URL("../" + relative, import.meta.url), "utf8");
  const route = read("app/api/employees/export/route.js");
  const migration = read("database/migrations/20260924_033_employee_sensitive_export.sql");
  const employeeRoute = read("app/api/employees/route.js");
  const employeeDirectory = read("app/components/employees/EmployeeDirectory.jsx");
  const exportMenu = read("app/components/data-display/TableExportMenu.jsx");
  assert.match(route, /requirePermission\("employees\.export_sensitive"\)/);
  assert.match(route, /maxRequests: 5/);
  assert.match(route, /windowMs: 5 \* 60 \* 1000/);
  assert.match(route, /Cache-Control": "private, no-store"/);
  assert.match(route, /parseEmployeeListFilters/);
  const exportService = read("lib/employees/exportService.js");
  assert.match(exportService, /EMPLOYEE_EXPORT_SCOPE_INVALID/);
  assert.match(exportService, /listEmployees\([\s\S]*?database,[\s\S]*?\);/);
  assert.doesNotMatch(exportService, /Identitas: employees\.length/);
  assert.match(employeeRoute, /parseEmployeeListFilters/);
  assert.match(employeeDirectory, /title="Daftar data pegawai"[\s\S]*exportConfig=/);
  assert.doesNotMatch(employeeDirectory, /import TableExportMenu/);
  assert.match(exportMenu, /label: "Unduh PDF"/);
  assert.doesNotMatch(exportMenu, /Unduh PDF[^"\n]*Segera hadir/);
  assert.match(exportMenu, /Coming soon\. Ekspor PDF belum tersedia\./);
  assert.match(exportMenu, /useLoadingBackdrop/);
  assert.match(exportMenu, /await runWithLoadingBackdrop\(\(\) => handler\(\)/);
  assert.match(exportMenu, /Menyiapkan file \$\{format\}/);
  assert.match(migration, /role\.code IN \('superadmin','hrd'\)/);
  assert.match(migration, /role\.code NOT IN \('superadmin','hrd'\)/);
});