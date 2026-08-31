import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { getUploadRoot } from "@/lib/files/storage";
import { getActorLocationScope } from "@/lib/auth/permissions";
import {
  EMPLOYEE_IMPORT_SHEET_GUIDANCE,
  EMPLOYEE_IMPORT_SHEETS,
  IMPORT_OPTION_GROUPS,
  getImportExample,
  getImportOptionGroup,
  isSupportedImportOption,
  normalizeImportEmployeeNo,
  normalizeImportNationalId,
  normalizeImportOption,
} from "@/lib/employees/importDefinition";
import { MAX_XLSX_BYTES, inspectEmployeeWorkbook } from "@/lib/employees/importPackage";
import {
  isValidIndonesianMobile,
  normalizeIndonesianMobile,
} from "@/lib/validation/indonesianPhone";

const MAX_EMPLOYEES = 5000;
const MAX_DATA_ROWS = 50000;
const DATE_KEYS = new Set([
  "birthDate",
  "joinedDate",
  "terminationDate",
  "issuedAt",
  "expiresAt",
  "startDate",
  "endDate",
  "effectiveFrom",
  "effectiveUntil",
]);
const YEAR_KEYS = new Set(["graduationYear"]);
const BOOLEAN_KEYS = new Set([
  "isVerified",
  "isPrimary",
  "isDependent",
  "isEmergencyContact",
  "isHighest",
]);

/** Menghasilkan teks bersih tanpa menghilangkan nol awal nomor administratif. */
function normalizeText(value) {
  if (value === null || value === undefined) return null;
  const resolved = typeof value === "object" && "text" in value ? value.text : value;
  const text = String(resolved).trim();
  return text || null;
}

/** Mengambil kode di depan label dropdown seperti `PUSAT - Kantor Pusat`. */
function normalizeReferenceSelection(value) {
  const text = normalizeText(value);
  return text?.split(/\s+-\s+/, 1)[0]?.trim() || null;
}

/** Menghasilkan tanggal ISO konsisten dari cell Excel atau teks YYYY-MM-DD. */
function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.valueOf()))
    return value.toISOString().slice(0, 10);
  const text = normalizeText(value);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? text
    : null;
}

/** Menerjemahkan pilihan YA/TIDAK tanpa menerima nilai ambigu. */
function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (["YA", "YES", "TRUE", "1"].includes(text)) return true;
  if (["TIDAK", "NO", "FALSE", "0", ""].includes(text)) return false;
  return null;
}

/** Menormalisasi satu row berdasarkan kontrak kolom sheet. */
function normalizeRow(definition, raw) {
  return Object.fromEntries(
    definition.columns.map(([key]) => {
      if (DATE_KEYS.has(key)) return [key, normalizeDate(raw[key])];
      if (BOOLEAN_KEYS.has(key)) return [key, normalizeBoolean(raw[key])];
      const value = normalizeText(raw[key]);
      if (key === "nationalId") return [key, normalizeImportNationalId(value)];
      if (key === "employeeNo") return [key, normalizeImportEmployeeNo(value)];
      if (key === "supervisorEmployeeNo")
        return [key, normalizeImportEmployeeNo(normalizeReferenceSelection(value))];
      if (key === "whatsapp" || key === "phone") return [key, normalizeIndonesianMobile(value)];
      const optionGroup = getImportOptionGroup(definition.name, key);
      if (optionGroup) return [key, normalizeImportOption(optionGroup, value)];
      const codeLike = key.endsWith("Code") || key.endsWith("Ref") || key === "employeeNo";
      const canonicalValue = key.endsWith("Code") ? normalizeReferenceSelection(value) : value;
      return [key, codeLike ? canonicalValue?.toUpperCase() || null : value];
    }),
  );
}

/** Memuat master organisasi satu kali agar validasi tidak menghasilkan query N+1. */
async function loadImportReferences(database, organizationId) {
  const [types, locations, units, positions, employees, unitLocations] = await Promise.all([
    database.query(
      "SELECT id::text,upper(code) code,name,requires_end_date FROM employment_types WHERE organization_id=$1 AND is_active ORDER BY name",
      [organizationId],
    ),
    database.query(
      `SELECT id::text,upper(code) code,name,operational_from::text,operational_until::text
       FROM locations WHERE organization_id=$1 AND is_active ORDER BY name`,
      [organizationId],
    ),
    database.query(
      "SELECT id::text,upper(code) code,name FROM organization_units WHERE organization_id=$1 AND is_active ORDER BY name",
      [organizationId],
    ),
    database.query(
      "SELECT id::text,upper(code) code,name FROM positions WHERE organization_id=$1 AND is_active ORDER BY name",
      [organizationId],
    ),
    database.query(
      `SELECT id::text,upper(trim(employee_no)) employee_no,full_name,employment_status,deleted_at,
        regexp_replace(coalesce(national_id,''),'[^0-9]','','g') national_id
       FROM employees WHERE organization_id=$1`,
      [organizationId],
    ),
    database.query(
      `SELECT organization_unit_id::text,location_id::text,active_from::text,active_until::text
       FROM organization_unit_locations WHERE organization_id=$1`,
      [organizationId],
    ),
  ]);
  const toMap = (rows, key = "code") => new Map(rows.map((row) => [row[key], row]));
  return {
    types: toMap(types.rows),
    locations: toMap(locations.rows),
    units: toMap(units.rows),
    positions: toMap(positions.rows),
    employees: toMap(employees.rows, "employee_no"),
    nationalIds: new Set(employees.rows.map((row) => row.national_id).filter(Boolean)),
    unitLocations: unitLocations.rows,
    lists: {
      types: types.rows,
      locations: locations.rows,
      units: units.rows,
      positions: positions.rows,
      supervisors: employees.rows.filter(
        (row) =>
          !row.deleted_at && ["active", "probation", "leave"].includes(row.employment_status),
      ),
    },
  };
}

/** Menambahkan petunjuk import Excel dengan bahasa yang dapat dipahami pengguna nonteknis. */
function addInstructionSheet(workbook) {
  const sheet = workbook.addWorksheet("Petunjuk", {
    properties: { tabColor: { argb: "FFE30613" } },
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const border = {
    top: { style: "thin", color: { argb: "FFD8DEE8" } },
    left: { style: "thin", color: { argb: "FFD8DEE8" } },
    bottom: { style: "thin", color: { argb: "FFD8DEE8" } },
    right: { style: "thin", color: { argb: "FFD8DEE8" } },
  };
  const requirementStyle = {
    required: { fill: "FFFFE7E9", color: "FFB42318" },
    conditional: { fill: "FFFFF4E5", color: "FF92400E" },
    optional: { fill: "FFEAF2FF", color: "FF175CD3" },
  };
  sheet.columns = [{ width: 8 }, { width: 24 }, { width: 23 }, { width: 46 }, { width: 58 }];
  sheet.views = [{ state: "frozen", ySplit: 2 }];
  sheet.mergeCells("A1:E1");
  sheet.getCell("A1").value = "PANDUAN IMPORT PEGAWAI SITOU";
  sheet.getCell("A1").font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE30613" } };
  sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 38;

  sheet.mergeCells("A2:E2");
  sheet.getCell("A2").value =
    "Gunakan workbook ini untuk membuat pegawai baru beserta profil, kontrak, dan histori penempatannya. Ikuti urutan di bawah sebelum mengunggah file.";
  sheet.getCell("A2").font = { size: 11, color: { argb: "FF344054" } };
  sheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF4F5" } };
  sheet.getCell("A2").alignment = { vertical: "middle", wrapText: true };
  sheet.getRow(2).height = 34;

  let rowNumber = 4;
  const addSectionTitle = (title) => {
    sheet.mergeCells(`A${rowNumber}:E${rowNumber}`);
    const cell = sheet.getCell(`A${rowNumber}`);
    cell.value = title;
    cell.font = { bold: true, size: 12, color: { argb: "FF101828" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F4F7" } };
    cell.alignment = { vertical: "middle" };
    sheet.getRow(rowNumber).height = 28;
    rowNumber += 1;
  };

  addSectionTitle("LANGKAH PENGISIAN");
  [
    "Isi sheet Pegawai terlebih dahulu. Satu baris mewakili satu pegawai baru.",
    "Gunakan NIP yang sama saat mengisi sheet lain milik pegawai tersebut.",
    "Isi sheet Kontrak dan Penempatan bila status pegawai active, probation, atau leave.",
    "Hapus seluruh baris contoh dengan NIP CONTOH-001 dari semua sheet.",
    "Upload file melalui menu Data Pegawai, periksa hasil validasi, lalu impor pegawai valid.",
  ].forEach((instruction, index) => {
    sheet.getCell(`A${rowNumber}`).value = index + 1;
    sheet.getCell(`A${rowNumber}`).font = { bold: true, color: { argb: "FFE30613" } };
    sheet.getCell(`A${rowNumber}`).alignment = { horizontal: "center", vertical: "middle" };
    sheet.mergeCells(`B${rowNumber}:E${rowNumber}`);
    sheet.getCell(`B${rowNumber}`).value = instruction;
    sheet.getCell(`B${rowNumber}`).alignment = { vertical: "middle", wrapText: true };
    sheet.getRow(rowNumber).height = 26;
    rowNumber += 1;
  });

  rowNumber += 1;
  addSectionTitle("SHEET YANG WAJIB DAN OPSIONAL");
  const guidanceHeaderRow = rowNumber;
  const header = sheet.getRow(rowNumber);
  header.values = [
    "No.",
    "Nama sheet",
    "Status pengisian",
    "Kegunaan dan kapan diisi",
    "Aturan penting",
  ];
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF344054" } };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 30;
  rowNumber += 1;

  EMPLOYEE_IMPORT_SHEET_GUIDANCE.forEach((guidance, index) => {
    const row = sheet.getRow(rowNumber);
    row.values = [
      index + 1,
      guidance.name,
      guidance.requirementLabel,
      `${guidance.purpose}\n${guidance.whenToFill}`,
      guidance.importantRule,
    ];
    row.height = 52;
    row.alignment = { vertical: "top", wrapText: true };
    row.eachCell((cell) => {
      cell.border = border;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: index % 2 ? "FFFFFFFF" : "FFF9FAFB" },
      };
    });
    row.getCell(1).alignment = { horizontal: "center", vertical: "top" };
    row.getCell(2).font = { bold: true, color: { argb: "FF101828" } };
    const statusStyle = requirementStyle[guidance.requirement];
    row.getCell(3).font = { bold: true, color: { argb: statusStyle.color } };
    row.getCell(3).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: statusStyle.fill },
    };
    rowNumber += 1;
  });
  sheet.autoFilter = { from: `A${guidanceHeaderRow}`, to: `E${rowNumber - 1}` };

  rowNumber += 1;
  addSectionTitle("ATURAN PENTING SEBELUM UPLOAD");
  [
    ["NIP", "Harus unik, konsisten di semua sheet, dan tidak boleh sudah terdaftar di SITOU."],
    ["NIK", "Wajib tepat 16 digit dan tidak boleh sama dengan pegawai lain."],
    ["Tanggal", "Gunakan format YYYY-MM-DD, misalnya 2026-08-22."],
    [
      "Kode master",
      "Gunakan kode yang tersedia pada sheet Referensi untuk lokasi, Divisi & Unit, jabatan, dan jenis kepegawaian.",
    ],
    [
      "Pilihan YA/TIDAK",
      "Gunakan YA atau TIDAK pada kolom penanda utama, tanggungan, verifikasi, dan pilihan sejenis.",
    ],
    [
      "Data lama",
      "Import hanya membuat pegawai baru. Data pegawai yang sudah ada tidak diperbarui dan tidak dibuat ulang.",
    ],
    [
      "Foto dan dokumen",
      "Pas foto, scan identitas, sertifikat, kontrak bertanda tangan, dan dokumen lainnya diunggah manual melalui detail pegawai setelah import berhasil.",
    ],
    [
      "Hasil validasi",
      "Pegawai bermasalah akan dilewati. Pegawai valid tetap dapat diimpor tanpa membuat data ganda.",
    ],
  ].forEach(([label, description]) => {
    sheet.mergeCells(`B${rowNumber}:E${rowNumber}`);
    sheet.getCell(`A${rowNumber}`).value = label;
    sheet.getCell(`A${rowNumber}`).font = { bold: true, color: { argb: "FF344054" } };
    sheet.getCell(`B${rowNumber}`).value = description;
    sheet.getCell(`B${rowNumber}`).alignment = { vertical: "middle", wrapText: true };
    sheet.getRow(rowNumber).height = 32;
    sheet.getRow(rowNumber).eachCell((cell) => {
      cell.border = border;
    });
    rowNumber += 1;
  });

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.font = { name: "Aptos", size: 10, ...cell.font };
    });
  });
  sheet.pageMargins = { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };
}

/** Menambahkan master aktif ke sheet tersembunyi agar kode tidak perlu ditebak pengguna. */
function addReferenceSheet(workbook, references) {
  const sheet = workbook.addWorksheet("Referensi");
  const groups = [
    [
      "employmentTypes",
      "Jenis Kepegawaian",
      references.lists.types.map((row) => `${row.code} - ${row.name}`),
    ],
    ["locations", "Lokasi", references.lists.locations.map((row) => `${row.code} - ${row.name}`)],
    ["units", "Divisi & Unit", references.lists.units.map((row) => `${row.code} - ${row.name}`)],
    ["positions", "Jabatan", references.lists.positions.map((row) => `${row.code} - ${row.name}`)],
    [
      "supervisors",
      "Atasan Langsung",
      references.lists.supervisors.map((row) => `${row.employee_no} - ${row.full_name}`),
    ],
    ...Object.entries(IMPORT_OPTION_GROUPS).map(([key, options]) => [
      `option_${key}`,
      `Pilihan ${key}`,
      options.map((option) => option.label),
    ]),
  ];
  sheet.columns = groups.map(([, header]) => ({ header, width: 30 }));
  const ranges = {};
  groups.forEach(([key, , values], index) => {
    const column = sheet.getColumn(index + 1);
    values.forEach((value, rowIndex) => {
      sheet.getCell(rowIndex + 2, index + 1).value = value;
    });
    ranges[key] =
      `'Referensi'!$${column.letter}$2:$${column.letter}$${Math.max(2, values.length + 1)}`;
  });
  sheet.state = "hidden";
  return ranges;
}

/** Menempelkan dropdown Excel pada kolom master dan enum tanpa mengubah parser server. */
function addTemplateValidations(sheet, definition, referenceRanges) {
  const dynamicReferences = {
    employmentTypeCode: referenceRanges.employmentTypes,
    locationCode: referenceRanges.locations,
    unitCode: referenceRanges.units,
    positionCode: referenceRanges.positions,
    supervisorEmployeeNo: referenceRanges.supervisors,
  };
  for (const [key, , required] of definition.columns) {
    const column = sheet.getColumn(key);
    if (DATE_KEYS.has(key)) {
      column.numFmt = "dd mmm yyyy";
      const firstCell = `${column.letter}2`;
      const isoDateCheck = `IFERROR(AND(LEN(${firstCell})=10,TEXT(DATE(VALUE(LEFT(${firstCell},4)),VALUE(MID(${firstCell},6,2)),VALUE(RIGHT(${firstCell},2))),"yyyy-mm-dd")=${firstCell}),FALSE)`;
      const validDateCheck = `OR(ISNUMBER(${firstCell}),${isoDateCheck})`;
      const validation = {
        type: "custom",
        allowBlank: !required,
        formulae: [required ? validDateCheck : `OR(${firstCell}="",${validDateCheck})`],
        showInputMessage: true,
        promptTitle: "Masukkan tanggal valid",
        prompt: "Gunakan format YYYY-MM-DD, misalnya 1994-02-21.",
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Tanggal tidak valid",
        error: "Gunakan format YYYY-MM-DD, misalnya 1994-02-21.",
      };
      for (let row = 2; row <= 5001; row += 1)
        sheet.dataValidations.add(`${column.letter}${row}`, validation);
      continue;
    }
    if (YEAR_KEYS.has(key)) {
      column.numFmt = "0";
      const validation = {
        type: "whole",
        operator: "between",
        allowBlank: !required,
        formulae: [1900, new Date().getFullYear()],
        showInputMessage: true,
        promptTitle: "Masukkan tahun",
        prompt: `Gunakan tahun 1900 sampai ${new Date().getFullYear()}.`,
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Tahun tidak valid",
        error: `Isi dengan tahun 1900 sampai ${new Date().getFullYear()}.`,
      };
      for (let row = 2; row <= 5001; row += 1)
        sheet.dataValidations.add(`${column.letter}${row}`, validation);
      continue;
    }
    const optionGroup = getImportOptionGroup(definition.name, key);
    const formula = dynamicReferences[key] || referenceRanges[`option_${optionGroup}`];
    if (!formula) continue;
    const validation = {
      type: "list",
      allowBlank: true,
      formulae: [formula],
      showInputMessage: true,
      promptTitle: "Gunakan pilihan tersedia",
      prompt:
        key === "supervisorEmployeeNo"
          ? "Pilih atasan yang sudah tercatat, atau ketik NIP pegawai baru pada workbook ini."
          : "Pilih nilai dari daftar agar data sesuai dengan sistem.",
      showErrorMessage: true,
      errorStyle: key === "supervisorEmployeeNo" ? "warning" : "stop",
      errorTitle: "Pilihan tidak valid",
      error:
        key === "supervisorEmployeeNo"
          ? "NIP di luar daftar hanya boleh digunakan bila pegawainya ada pada sheet Pegawai."
          : "Pilih nilai yang tersedia pada daftar.",
    };
    // Range validation memicu bug optimizer ExcelJS pada bundle server Linux tertentu.
    // Alamat tunggal tetap dikompresi menjadi range saat workbook ditulis.
    for (let row = 2; row <= 5001; row += 1)
      sheet.dataValidations.add(`${column.letter}${row}`, validation);
  }
}

/** Mengisi baris contoh dengan label master nyata agar contoh juga valid terhadap dropdown Excel. */
function resolveTemplateExample(sheetName, references) {
  const example = getImportExample(sheetName);
  if (sheetName === "Kontrak") {
    const type = references.lists.types[0];
    example.employmentTypeCode = type ? `${type.code} - ${type.name}` : null;
  }
  if (sheetName === "Penempatan") {
    const mapping = references.unitLocations[0];
    const location = references.lists.locations.find(
      (row) => String(row.id) === String(mapping?.location_id),
    );
    const unit = references.lists.units.find(
      (row) => String(row.id) === String(mapping?.organization_unit_id),
    );
    const position = references.lists.positions[0];
    example.locationCode = location ? `${location.code} - ${location.name}` : null;
    example.unitCode = unit ? `${unit.code} - ${unit.name}` : null;
    example.positionCode = position ? `${position.code} - ${position.name}` : null;
  }
  return example;
}

/** Menyimpan contoh tanggal sebagai nilai tanggal Excel, bukan teks yang hanya menyerupai tanggal. */
function normalizeTemplateExampleDates(row, definition) {
  for (const [key] of definition.columns) {
    const value = row[key];
    if (DATE_KEYS.has(key) && /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")))
      row[key] = new Date(`${value}T00:00:00.000Z`);
  }
  return row;
}

/** Membuat workbook multi-sheet yang selalu selaras dengan parser server. */
export async function createEmployeeImportTemplate(organizationId, database = pool) {
  const references = await loadImportReferences(database, organizationId);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SITOU";
  addInstructionSheet(workbook);
  const dataSheets = [];
  for (const definition of EMPLOYEE_IMPORT_SHEETS) {
    const sheet = workbook.addWorksheet(definition.name);
    sheet.columns = definition.columns.map(([key, header, required]) => ({
      key,
      header: `${required ? "* " : ""}${header}`,
      width: Math.min(42, Math.max(18, header.length + 6)),
    }));
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: "A1", to: `${sheet.getColumn(definition.columns.length).letter}1` };
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE30613" } };
    sheet.addRow(
      normalizeTemplateExampleDates(
        resolveTemplateExample(definition.name, references),
        definition,
      ),
    );
    sheet.getRow(2).font = { italic: true, color: { argb: "FF6B7280" } };
    dataSheets.push([sheet, definition]);
  }
  const referenceRanges = addReferenceSheet(workbook, references);
  dataSheets.forEach(([sheet, definition]) =>
    addTemplateValidations(sheet, definition, referenceRanges),
  );
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Membaca seluruh sheet dan menolak formula agar hasil import deterministik. */
async function parseEmployeeWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new ServiceError("IMPORT_WORKBOOK_INVALID", "Workbook Excel tidak dapat dibaca.", 415);
  }
  const expectedSheets = new Set([
    "Petunjuk",
    ...EMPLOYEE_IMPORT_SHEETS.map((item) => item.name),
    "Referensi",
  ]);
  const unexpectedSheets = workbook.worksheets
    .map((sheet) => sheet.name)
    .filter((name) => !expectedSheets.has(name));
  if (unexpectedSheets.length)
    throw new ServiceError(
      "IMPORT_SHEET_INVALID",
      `Workbook memiliki sheet yang tidak dikenali: ${unexpectedSheets.join(", ")}.`,
      400,
    );
  for (const required of expectedSheets)
    if (!workbook.getWorksheet(required))
      throw new ServiceError("IMPORT_SHEET_MISSING", `Sheet ${required} tidak ditemukan.`, 400);
  for (const sheet of workbook.worksheets)
    sheet.eachRow((row, rowNumber) =>
      row.eachCell((cell) => {
        if (cell.value && typeof cell.value === "object" && "formula" in cell.value)
          throw new ServiceError(
            "IMPORT_FORMULA_NOT_ALLOWED",
            `Formula tidak diizinkan pada ${sheet.name} baris ${rowNumber}.`,
            400,
          );
      }),
    );
  const parsed = [];
  for (const definition of EMPLOYEE_IMPORT_SHEETS) {
    const sheet = workbook.getWorksheet(definition.name);
    if (!sheet)
      throw new ServiceError(
        "IMPORT_SHEET_MISSING",
        `Sheet ${definition.name} tidak ditemukan.`,
        400,
      );
    const headers = new Map();
    sheet.getRow(1).eachCell((cell, columnNumber) =>
      headers.set(
        String(cell.value || "")
          .replace(/^\*\s*/, "")
          .trim(),
        columnNumber,
      ),
    );
    const missing = definition.columns
      .filter(([, header]) => !headers.has(header))
      .map(([, header]) => header);
    if (missing.length)
      throw new ServiceError(
        "IMPORT_HEADER_INVALID",
        `Sheet ${definition.name} tidak memiliki kolom: ${missing.join(", ")}.`,
        400,
      );
    const expectedHeaders = new Set(definition.columns.map(([, header]) => header));
    const unexpected = [...headers.keys()].filter(
      (header) => header && !expectedHeaders.has(header),
    );
    if (unexpected.length)
      throw new ServiceError(
        "IMPORT_HEADER_INVALID",
        `Sheet ${definition.name} memiliki kolom yang tidak dikenali: ${unexpected.join(", ")}.`,
        400,
      );
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const raw = {};
      for (const [key, header] of definition.columns) {
        const cell = row.getCell(headers.get(header));
        if (cell.value && typeof cell.value === "object" && "formula" in cell.value)
          throw new ServiceError(
            "IMPORT_FORMULA_NOT_ALLOWED",
            `Formula tidak diizinkan pada ${definition.name} baris ${rowNumber}.`,
            400,
          );
        raw[key] = cell.value ?? null;
      }
      if (Object.values(raw).every((value) => normalizeText(value) === null)) return;
      parsed.push({
        sheetName: definition.name,
        entityType: definition.entityType,
        entityRef: definition.refKey
          ? normalizeText(raw[definition.refKey])?.toUpperCase() || null
          : null,
        rowNumber,
        raw,
        normalized: normalizeRow(definition, raw),
        errors: [],
      });
    });
  }
  if (!parsed.length)
    throw new ServiceError("IMPORT_EMPTY", "Workbook tidak memiliki data untuk diimpor.", 400);
  if (parsed.length > MAX_DATA_ROWS)
    throw new ServiceError("IMPORT_TOO_MANY_ROWS", "Maksimal 50.000 baris data per import.", 413);
  const employeeCount = new Set(
    parsed
      .filter((row) => row.sheetName === "Pegawai")
      .map((row) => row.normalized.employeeNo)
      .filter(Boolean),
  ).size;
  if (employeeCount > MAX_EMPLOYEES)
    throw new ServiceError("IMPORT_TOO_MANY_EMPLOYEES", "Maksimal 5.000 pegawai per import.", 413);
  return parsed;
}

/** Menambahkan error tanpa menggandakan pesan yang sama pada satu baris. */
function addError(row, message) {
  if (!row.errors.includes(message)) row.errors.push(message);
}

/** Memvalidasi field wajib, tanggal, boolean, dan enum dasar. */
function validateRowShape(row) {
  const definition = EMPLOYEE_IMPORT_SHEETS.find((item) => item.name === row.sheetName);
  for (const [key, header, required] of definition.columns) {
    if (required && row.normalized[key] === null) addError(row, `${header} wajib diisi.`);
    if (DATE_KEYS.has(key) && row.raw[key] && !row.normalized[key])
      addError(row, `${header} wajib memakai format YYYY-MM-DD.`);
    if (BOOLEAN_KEYS.has(key) && row.raw[key] && row.normalized[key] === null)
      addError(row, `${header} hanya menerima YA atau TIDAK.`);
    const optionGroup = getImportOptionGroup(row.sheetName, key);
    if (
      optionGroup &&
      row.normalized[key] &&
      !isSupportedImportOption(optionGroup, row.normalized[key])
    )
      addError(row, `${header} tidak termasuk pilihan yang didukung.`);
  }
  for (const [key, header] of definition.columns) {
    const value = row.normalized[key];
    if (typeof value === "string" && value.length > 5000)
      addError(row, `${header} melebihi batas 5.000 karakter.`);
  }
  if (row.sheetName === "Pegawai" && !/^\d{16}$/.test(row.normalized.nationalId || ""))
    addError(row, "NIK wajib terdiri dari tepat 16 digit.");
  for (const key of ["whatsapp", "phone"])
    if (row.normalized[key] && !isValidIndonesianMobile(row.normalized[key]))
      addError(row, `${key === "whatsapp" ? "Nomor WhatsApp" : "Nomor Kontak"} tidak valid.`);
}

/** Memeriksa periode histori agar tidak saling bertumpuk. */
function validateNoOverlap(rows, startKey, endKey, label, primaryOnly = false) {
  const periods = rows
    .filter((row) => !primaryOnly || row.normalized.assignmentType === "primary")
    .filter((row) => row.normalized[startKey])
    .sort((a, b) => a.normalized[startKey].localeCompare(b.normalized[startKey]));
  for (let index = 1; index < periods.length; index += 1) {
    const previous = periods[index - 1];
    if (
      !previous.normalized[endKey] ||
      previous.normalized[endKey] >= periods[index].normalized[startKey]
    ) {
      addError(previous, `Periode ${label} bertumpuk dengan baris ${periods[index].rowNumber}.`);
      addError(periods[index], `Periode ${label} bertumpuk dengan baris ${previous.rowNumber}.`);
    }
  }
}

/** Menandai seluruh baris yang memakai identitas turunan sama agar tidak dipilih secara acak. */
function validateDuplicateRows(rows, keyResolver, message) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyResolver(row);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  for (const duplicates of grouped.values())
    if (duplicates.length > 1) duplicates.forEach((row) => addError(row, message));
}

/** Memvalidasi master, hubungan antar-sheet, duplikasi, dan periode histori. */
async function validateParsedRows(rows, references, scopedLocationIds) {
  rows.forEach(validateRowShape);
  const employeeRows = rows.filter((row) => row.sheetName === "Pegawai");
  const employeeMap = new Map();
  const nationalIds = new Map();
  for (const row of employeeRows) {
    const number = row.normalized.employeeNo;
    if (number && employeeMap.has(number)) {
      addError(row, "NIP duplikat di dalam workbook.");
      addError(employeeMap.get(number), "NIP duplikat di dalam workbook.");
    } else if (number) employeeMap.set(number, row);
    if (number && references.employees.has(number)) addError(row, "NIP sudah digunakan.");
    if (row.normalized.nationalId) {
      if (references.nationalIds.has(row.normalized.nationalId))
        addError(row, "NIK sudah digunakan.");
      if (nationalIds.has(row.normalized.nationalId)) {
        addError(row, "NIK duplikat di dalam workbook.");
        addError(nationalIds.get(row.normalized.nationalId), "NIK duplikat di dalam workbook.");
      } else nationalIds.set(row.normalized.nationalId, row);
    }
  }
  for (const row of rows) {
    const employeeNo = row.normalized.employeeNo;
    if (row.sheetName !== "Pegawai" && employeeNo && !employeeMap.has(employeeNo))
      addError(row, "NIP tidak ditemukan pada sheet Pegawai.");
  }
  const refRows = new Map();
  for (const row of rows.filter((item) => item.entityRef)) {
    const key = `${row.entityType}:${row.entityRef}`;
    if (refRows.has(key)) {
      addError(row, `Referensi ${row.entityRef} duplikat.`);
      addError(refRows.get(key), `Referensi ${row.entityRef} duplikat.`);
    } else refRows.set(key, row);
  }
  for (const row of rows.filter((item) => item.sheetName === "Kontrak")) {
    const type = references.types.get(row.normalized.employmentTypeCode);
    if (!type) addError(row, "Kode Jenis Kepegawaian tidak ditemukan.");
    else row.normalized.employmentTypeId = type.id;
    if (type?.requires_end_date && !row.normalized.endDate)
      addError(row, "Jenis kepegawaian ini mewajibkan Tanggal Akhir.");
    if (row.normalized.endDate && row.normalized.startDate > row.normalized.endDate)
      addError(row, "Tanggal Akhir tidak boleh sebelum Tanggal Mulai.");
  }
  for (const row of rows.filter((item) => item.sheetName === "Penempatan")) {
    const location = references.locations.get(row.normalized.locationCode);
    const unit = references.units.get(row.normalized.unitCode);
    const position = row.normalized.positionCode
      ? references.positions.get(row.normalized.positionCode)
      : null;
    if (!location) addError(row, "Kode Lokasi tidak ditemukan.");
    if (location && scopedLocationIds && !scopedLocationIds.includes(String(location.id)))
      addError(row, "Lokasi berada di luar cakupan akses akun Anda.");
    if (!unit) addError(row, "Kode Divisi/Unit tidak ditemukan.");
    if (row.normalized.positionCode && !position) addError(row, "Kode Jabatan tidak ditemukan.");
    Object.assign(row.normalized, {
      locationId: location?.id || null,
      organizationUnitId: unit?.id || null,
      positionId: position?.id || null,
    });
    if (
      location &&
      row.normalized.effectiveFrom &&
      (row.normalized.effectiveFrom < location.operational_from ||
        (location.operational_until && row.normalized.effectiveFrom > location.operational_until))
    )
      addError(row, "Lokasi tidak aktif pada Tanggal Mulai penempatan.");
    if (location && unit && row.normalized.effectiveFrom) {
      const available = references.unitLocations.some(
        (mapping) =>
          mapping.organization_unit_id === unit.id &&
          mapping.location_id === location.id &&
          row.normalized.effectiveFrom >= mapping.active_from &&
          (!mapping.active_until || row.normalized.effectiveFrom <= mapping.active_until),
      );
      if (!available) addError(row, "Divisi/Unit tidak tersedia pada lokasi tersebut.");
    }
    if (
      row.normalized.effectiveUntil &&
      row.normalized.effectiveFrom > row.normalized.effectiveUntil
    )
      addError(row, "Tanggal Akhir tidak boleh sebelum Tanggal Mulai.");
    const supervisorNo = row.normalized.supervisorEmployeeNo;
    if (supervisorNo && supervisorNo === row.normalized.employeeNo)
      addError(row, "Pegawai tidak dapat menjadi atasannya sendiri.");
    if (supervisorNo && !references.employees.has(supervisorNo) && !employeeMap.has(supervisorNo))
      addError(row, "NIP Atasan tidak ditemukan.");
  }
  for (const employeeNo of employeeMap.keys()) {
    const group = rows.filter((row) => row.normalized.employeeNo === employeeNo);
    validateNoOverlap(
      group.filter((row) => row.sheetName === "Kontrak"),
      "startDate",
      "endDate",
      "kontrak",
    );
    validateNoOverlap(
      group.filter((row) => row.sheetName === "Penempatan"),
      "effectiveFrom",
      "effectiveUntil",
      "penempatan utama",
      true,
    );
    const singularRules = [
      ["Rekening", "isPrimary", "Hanya satu rekening yang dapat menjadi rekening utama."],
      ["Kontak_Darurat", "isPrimary", "Hanya satu kontak darurat yang dapat menjadi kontak utama."],
      ["Pendidikan", "isHighest", "Hanya satu pendidikan yang dapat ditandai tertinggi."],
    ];
    singularRules.forEach(([sheetName, key, message]) => {
      const matches = group.filter((row) => row.sheetName === sheetName && row.normalized[key]);
      if (matches.length > 1) matches.forEach((row) => addError(row, message));
    });
    const contacts = group.filter((row) => row.sheetName === "Kontak");
    if (contacts.length > 1)
      contacts.forEach((row) =>
        addError(row, "Setiap pegawai hanya boleh memiliki satu baris Kontak."),
      );
    validateDuplicateRows(
      group.filter((row) => row.sheetName === "Identitas"),
      (row) => `${row.normalized.identifierType || ""}:${row.normalized.identifierValue || ""}`,
      "Jenis dan nomor identitas duplikat untuk pegawai yang sama.",
    );
    validateDuplicateRows(
      group.filter((row) => row.sheetName === "Rekening"),
      (row) => `${row.normalized.bankName || ""}:${row.normalized.accountNumber || ""}`,
      "Rekening duplikat untuk pegawai yang sama.",
    );
    validateDuplicateRows(
      group.filter((row) => row.sheetName === "Akun_Sosial"),
      (row) =>
        `${String(row.normalized.platform || "").toLowerCase()}:${String(row.normalized.handleOrUrl || "").toLowerCase()}`,
      "Akun sosial duplikat untuk pegawai yang sama.",
    );
    validateDuplicateRows(
      group.filter((row) => row.sheetName === "Keahlian"),
      (row) => String(row.normalized.skillName || "").toLowerCase(),
      "Keahlian duplikat untuk pegawai yang sama.",
    );
    const core = employeeMap.get(employeeNo)?.normalized;
    if (["active", "probation", "leave"].includes(core?.employmentStatus)) {
      const today = new Date().toISOString().slice(0, 10);
      const currentContract = group.some(
        (row) =>
          row.sheetName === "Kontrak" &&
          row.normalized.startDate <= today &&
          (!row.normalized.endDate || row.normalized.endDate >= today),
      );
      const currentPrimaryAssignment = group.some(
        (row) =>
          row.sheetName === "Penempatan" &&
          row.normalized.assignmentType === "primary" &&
          row.normalized.effectiveFrom <= today &&
          (!row.normalized.effectiveUntil || row.normalized.effectiveUntil >= today),
      );
      if (!currentContract)
        addError(
          employeeMap.get(employeeNo),
          "Status pegawai aktif memerlukan kontrak yang berlaku.",
        );
      if (!currentPrimaryAssignment)
        addError(
          employeeMap.get(employeeNo),
          "Status pegawai aktif memerlukan penempatan utama yang berlaku.",
        );
    }
  }
  // Kesalahan satu row membuat seluruh pegawai invalid agar commit tetap atomik per pegawai.
  for (const employeeNo of employeeMap.keys()) {
    const group = rows.filter((row) => row.normalized.employeeNo === employeeNo);
    if (group.some((row) => row.errors.length))
      group.forEach((row) => {
        if (!row.errors.length)
          addError(row, "Pegawai dilewati karena data terkait pada sheet lain perlu diperbaiki.");
      });
  }
  return rows;
}

/** Menyimpan file sumber privat dengan UUID dan tanpa data pribadi pada path. */
async function saveImportSource(buffer, originalName, organizationId, actor, requestId) {
  const year = String(new Date().getFullYear());
  const extension = "xlsx";
  const objectKey = path.posix.join(
    `org_${organizationId}`,
    "imports",
    "pegawai",
    year,
    `${randomUUID()}.${extension}`,
  );
  const finalPath = path.join(getUploadRoot(), ...objectKey.split("/"));
  const tempPath = `${finalPath}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(finalPath), { recursive: true });
  await writeFile(tempPath, buffer, { flag: "wx" });
  await rename(tempPath, finalPath);
  try {
    return await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO stored_files
          (organization_id,storage_provider,object_key,original_name,mime_type,size_bytes,sha256,category,is_confidential,uploaded_by_user_id)
         VALUES ($1,'local_private',$2,$3,$4,$5,$6,'other',true,$7) RETURNING id`,
        [
          organizationId,
          objectKey,
          String(originalName || `import-pegawai.${extension}`).slice(0, 255),
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer.length,
          createHash("sha256").update(buffer).digest("hex"),
          actor.id,
        ],
      );
      await writeAudit(client, {
        organizationId,
        actorUserId: actor.id,
        action: "employee_import.file_upload",
        entityType: "stored_file",
        entityId: inserted.rows[0].id,
        afterData: { sourceType: "xlsx" },
        requestId,
      });
      return inserted.rows[0].id;
    });
  } catch (error) {
    await unlink(finalPath).catch(() => {});
    throw error;
  }
}

/** Membuat batch preview tanpa menulis data pegawai final. */
export async function createEmployeeImport({ file, organizationId, actor, requestId }) {
  if (!file || typeof file.arrayBuffer !== "function")
    throw new ServiceError("FILE_REQUIRED", "Pilih file Excel.", 400);
  if (file.size <= 0 || file.size > MAX_XLSX_BYTES)
    throw new ServiceError("FILE_SIZE_INVALID", "File Excel maksimal 10 MB.", 413);
  if (
    !String(file.name || "")
      .toLowerCase()
      .endsWith(".xlsx")
  )
    throw new ServiceError(
      "IMPORT_FILE_INVALID",
      "Nama file harus menggunakan ekstensi .xlsx.",
      415,
    );
  const buffer = Buffer.from(await file.arrayBuffer());
  await inspectEmployeeWorkbook(buffer);
  const parsedRows = await parseEmployeeWorkbook(buffer);
  const references = await loadImportReferences(pool, organizationId);
  const scopedLocationIds = await getActorLocationScope(actor);
  await validateParsedRows(parsedRows, references, scopedLocationIds);
  const sourceFileId = await saveImportSource(buffer, file.name, organizationId, actor, requestId);
  return withTransaction(async (client) => {
    const employeeNos = [
      ...new Set(parsedRows.map((row) => row.normalized.employeeNo).filter(Boolean)),
    ];
    const validEmployees = employeeNos.filter(
      (number) =>
        !parsedRows.some((row) => row.normalized.employeeNo === number && row.errors.length),
    );
    const validRows = parsedRows.filter((row) => !row.errors.length).length;
    const batch = await client.query(
      `INSERT INTO employee_import_batches
        (organization_id,source_file_id,status,total_rows,valid_rows,invalid_rows,total_employees,valid_employees,invalid_employees,created_by_user_id,validated_at)
       VALUES ($1,$2,'validated',$3,$4,$5,$6,$7,$8,$9,now()) RETURNING id`,
      [
        organizationId,
        sourceFileId,
        parsedRows.length,
        validRows,
        parsedRows.length - validRows,
        employeeNos.length,
        validEmployees.length,
        employeeNos.length - validEmployees.length,
        actor.id,
      ],
    );
    for (const row of parsedRows)
      await client.query(
        `INSERT INTO employee_import_rows
          (organization_id,batch_id,row_number,sheet_name,entity_type,entity_ref,employee_no,raw_data,normalized_data,validation_errors,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11)`,
        [
          organizationId,
          batch.rows[0].id,
          row.rowNumber,
          row.sheetName,
          row.entityType,
          row.entityRef,
          row.normalized.employeeNo,
          JSON.stringify(row.raw),
          JSON.stringify(row.normalized),
          JSON.stringify(row.errors),
          row.errors.length ? "invalid" : "valid",
        ],
      );
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "employee_import.validate",
      entityType: "employee_import_batch",
      entityId: batch.rows[0].id,
      afterData: {
        sourceType: "xlsx",
        totalEmployees: employeeNos.length,
        validEmployees: validEmployees.length,
        invalidEmployees: employeeNos.length - validEmployees.length,
      },
      requestId,
    });
    return getEmployeeImportBatch(batch.rows[0].id, organizationId, client);
  });
}

/** Mengelompokkan preview per pegawai agar UI tidak menampilkan daftar baris mentah. */
export async function getEmployeeImportBatch(id, organizationId, database = pool) {
  const batchResult = await database.query(
    `SELECT id::text,status,total_rows,valid_rows,invalid_rows,total_employees,valid_employees,
      invalid_employees,committed_employees,created_at,validated_at,committed_at,error_summary
     FROM employee_import_batches WHERE id=$1 AND organization_id=$2`,
    [id, organizationId],
  );
  if (!batchResult.rows[0])
    throw new ServiceError("IMPORT_NOT_FOUND", "Batch import tidak ditemukan.", 404);
  const rowsResult = await database.query(
    `SELECT id::text,row_number,sheet_name,entity_type,entity_ref,employee_no,normalized_data,
      validation_errors,status,employee_id::text
     FROM employee_import_rows WHERE organization_id=$1 AND batch_id=$2
     ORDER BY employee_no NULLS LAST,sheet_name,row_number`,
    [organizationId, id],
  );
  const groups = new Map();
  for (const row of rowsResult.rows) {
    const key = row.employee_no || "TANPA-NOMOR";
    if (!groups.has(key))
      groups.set(key, { employeeNo: key, status: "valid", counts: {}, errors: [] });
    const group = groups.get(key);
    group.counts[row.entity_type] = (group.counts[row.entity_type] || 0) + 1;
    if (["invalid", "skipped"].includes(row.status)) group.status = row.status;
    if (row.status === "committed") group.status = "committed";
    for (const message of row.validation_errors || [])
      group.errors.push({ sheetName: row.sheet_name, rowNumber: row.row_number, message });
  }
  return { ...batchResult.rows[0], groups: [...groups.values()], rows: rowsResult.rows };
}

/** Menulis section profil berulang yang tidak memiliki referensi histori. */
async function insertProfileRows(client, rows, organizationId, employeeId) {
  for (const row of rows) {
    const value = row.normalized_data;
    if (row.sheet_name === "Identitas")
      await client.query(
        "INSERT INTO employee_identifiers(organization_id,employee_id,identifier_type,identifier_value,issued_at,expires_at,is_verified) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [
          organizationId,
          employeeId,
          value.identifierType,
          value.identifierValue,
          value.issuedAt,
          value.expiresAt,
          value.isVerified,
        ],
      );
    if (row.sheet_name === "Rekening")
      await client.query(
        "INSERT INTO employee_bank_accounts(organization_id,employee_id,bank_name,account_number,account_holder,is_primary) VALUES ($1,$2,$3,$4,$5,$6)",
        [
          organizationId,
          employeeId,
          value.bankName,
          value.accountNumber,
          value.accountHolder,
          value.isPrimary,
        ],
      );
    if (row.sheet_name === "Keluarga")
      await client.query(
        "INSERT INTO employee_dependents(organization_id,employee_id,relationship,full_name,birth_date,national_id,phone,is_dependent,is_emergency_contact,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          organizationId,
          employeeId,
          value.relationship,
          value.fullName,
          value.birthDate,
          value.nationalId,
          value.phone,
          value.isDependent,
          value.isEmergencyContact,
          value.notes,
        ],
      );
    if (row.sheet_name === "Kontak_Darurat")
      await client.query(
        "INSERT INTO employee_emergency_contacts(organization_id,employee_id,full_name,relationship,phone,address,is_primary) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [
          organizationId,
          employeeId,
          value.fullName,
          value.relationship,
          value.phone,
          value.address,
          value.isPrimary,
        ],
      );
    if (row.sheet_name === "Akun_Sosial")
      await client.query(
        "INSERT INTO employee_social_accounts(organization_id,employee_id,platform,handle_or_url) VALUES ($1,$2,$3,$4)",
        [organizationId, employeeId, value.platform, value.handleOrUrl],
      );
    if (row.sheet_name === "Keahlian")
      await client.query(
        "INSERT INTO employee_skills(organization_id,employee_id,skill_name,proficiency_level,notes) VALUES ($1,$2,$3,$4,$5)",
        [organizationId, employeeId, value.skillName, value.proficiencyLevel, value.notes],
      );
  }
}

/** Menulis seluruh profil dan histori satu pegawai dalam satu transaksi database. */
async function commitEmployeeGroup({
  batchId,
  organizationId,
  employeeNo,
  rows,
  actor,
  requestId,
}) {
  return withTransaction(async (client) => {
    const core = rows.find((row) => row.sheet_name === "Pegawai")?.normalized_data;
    if (!core) throw new Error("Data inti pegawai tidak ditemukan.");
    // Serialisasi commit import dalam satu organisasi agar dua batch bersamaan tidak lolos precheck.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `employee-import:${organizationId}`,
    ]);
    const duplicate = await client.query(
      `SELECT id FROM employees
         WHERE organization_id=$1
           AND (upper(trim(employee_no))=$2 OR regexp_replace(coalesce(national_id,''),'[^0-9]','','g')=$3)
         LIMIT 1`,
      [organizationId, core.employeeNo, core.nationalId],
    );
    if (duplicate.rows[0])
      throw new ServiceError(
        "EMPLOYEE_DUPLICATE",
        "NIP atau NIK sudah digunakan pada organisasi ini.",
        409,
      );
    const employeeResult = await client.query(
      `INSERT INTO employees
          (organization_id,employee_no,full_name,preferred_name,national_id,birth_place,birth_date,gender,religion,marital_status,blood_type,nationality,joined_date,employment_status,termination_date,termination_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,coalesce($12,'Indonesia'),$13,$14,$15,$16) RETURNING id`,
      [
        organizationId,
        core.employeeNo,
        core.fullName,
        core.preferredName,
        core.nationalId,
        core.birthPlace,
        core.birthDate,
        core.gender,
        core.religion,
        core.maritalStatus,
        core.bloodType,
        core.nationality,
        core.joinedDate,
        core.employmentStatus,
        core.terminationDate,
        core.terminationReason,
      ],
    );
    const employeeId = employeeResult.rows[0].id;
    const contact = rows.find((row) => row.sheet_name === "Kontak")?.normalized_data;
    if (contact)
      await client.query(
        `INSERT INTO employee_contacts
            (organization_id,employee_id,personal_email,whatsapp,ktp_address,domicile_address,village,district,city,province,postal_code)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          organizationId,
          employeeId,
          contact.personalEmail,
          contact.whatsapp,
          contact.ktpAddress,
          contact.domicileAddress,
          contact.village,
          contact.district,
          contact.city,
          contact.province,
          contact.postalCode,
        ],
      );
    await insertProfileRows(client, rows, organizationId, employeeId);
    for (const row of rows.filter((item) => item.sheet_name === "Pendidikan")) {
      const value = row.normalized_data;
      await client.query(
        `INSERT INTO employee_educations
            (organization_id,employee_id,education_level,institution,field_of_study,graduation_year,is_highest,certificate_file_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          organizationId,
          employeeId,
          value.educationLevel,
          value.institution,
          value.fieldOfStudy,
          value.graduationYear ? Number(value.graduationYear) : null,
          value.isHighest,
          null,
        ],
      );
    }
    for (const row of rows.filter((item) => item.sheet_name === "Sertifikasi")) {
      const value = row.normalized_data;
      await client.query(
        `INSERT INTO employee_certifications
            (organization_id,employee_id,certification_name,issuer,credential_no,issued_at,expires_at,certificate_file_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          organizationId,
          employeeId,
          value.certificationName,
          value.issuer,
          value.credentialNo,
          value.issuedAt,
          value.expiresAt,
          null,
        ],
      );
    }
    for (const row of rows.filter((item) => item.sheet_name === "Kontrak")) {
      const value = row.normalized_data;
      await client.query(
        `INSERT INTO employment_contracts
            (organization_id,employee_id,employment_type_id,contract_no,start_date,end_date,status,document_file_id,notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          organizationId,
          employeeId,
          value.employmentTypeId,
          value.contractNo,
          value.startDate,
          value.endDate,
          value.status,
          null,
          value.notes,
        ],
      );
    }
    for (const row of rows
      .filter((item) => item.sheet_name === "Penempatan")
      .sort((a, b) =>
        a.normalized_data.effectiveFrom.localeCompare(b.normalized_data.effectiveFrom),
      )) {
      const value = row.normalized_data;
      let supervisorId = null;
      if (value.supervisorEmployeeNo) {
        const supervisor = await client.query(
          "SELECT id FROM employees WHERE organization_id=$1 AND upper(employee_no)=$2 AND deleted_at IS NULL",
          [organizationId, value.supervisorEmployeeNo],
        );
        supervisorId = supervisor.rows[0]?.id || null;
        if (!supervisorId) throw new Error("Atasan belum berhasil diimpor.");
      }
      await client.query(
        `INSERT INTO employee_assignments
            (organization_id,employee_id,location_id,organization_unit_id,position_id,supervisor_employee_id,assignment_type,change_type,effective_from,effective_until,decree_no,document_file_id,notes,created_by_user_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          organizationId,
          employeeId,
          value.locationId,
          value.organizationUnitId,
          value.positionId,
          supervisorId,
          value.assignmentType,
          value.changeType,
          value.effectiveFrom,
          value.effectiveUntil,
          value.decreeNo,
          null,
          value.notes,
          actor.id,
        ],
      );
    }
    await client.query(
      `UPDATE employee_import_rows SET status='committed',employee_id=$4
         WHERE organization_id=$1 AND batch_id=$2 AND employee_no=$3`,
      [organizationId, batchId, employeeNo, employeeId],
    );
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "employee_import.employee_commit",
      entityType: "employee",
      entityId: employeeId,
      afterData: {
        batchId: String(batchId),
        employeeNo,
        rows: rows.length,
      },
      requestId,
    });
    return employeeId;
  });
}

/** Mengurutkan pegawai agar atasan baru dibuat sebelum bawahan bila keduanya ada di workbook. */
function sortEmployeeGroups(groups) {
  const ordered = [];
  const pending = new Map(groups.map((group) => [group.employeeNo, group]));
  while (pending.size) {
    let progressed = false;
    for (const [employeeNo, group] of pending) {
      const supervisors = new Set(
        group.rows
          .filter((row) => row.sheet_name === "Penempatan")
          .map((row) => row.normalized_data.supervisorEmployeeNo)
          .filter((value) => pending.has(value)),
      );
      if (!supervisors.size) {
        ordered.push(group);
        pending.delete(employeeNo);
        progressed = true;
      }
    }
    if (!progressed) {
      ordered.push(...pending.values());
      break;
    }
  }
  return ordered;
}

/** Commit tiap pegawai secara atomik dan tetap idempotent saat batch diulang. */
export async function commitEmployeeImport(id, organizationId, actor, requestId) {
  const batchResult = await pool.query(
    "SELECT * FROM employee_import_batches WHERE id=$1 AND organization_id=$2",
    [id, organizationId],
  );
  const batch = batchResult.rows[0];
  if (!batch) throw new ServiceError("IMPORT_NOT_FOUND", "Batch import tidak ditemukan.", 404);
  if (batch.status === "committed") return getEmployeeImportBatch(id, organizationId);
  if (!["validated", "partially_committed"].includes(batch.status))
    throw new ServiceError("IMPORT_NOT_READY", "Batch belum siap diimpor.", 409);
  const claimed = await pool.query(
    `UPDATE employee_import_batches SET status='committing'
     WHERE id=$1 AND organization_id=$2 AND status IN ('validated','partially_committed') RETURNING id`,
    [id, organizationId],
  );
  if (!claimed.rows[0])
    throw new ServiceError(
      "IMPORT_IN_PROGRESS",
      "Batch sedang diproses oleh permintaan lain.",
      409,
    );
  const rowsResult = await pool.query(
    `SELECT * FROM employee_import_rows
     WHERE organization_id=$1 AND batch_id=$2 AND status='valid'
     ORDER BY employee_no,sheet_name,row_number`,
    [organizationId, id],
  );
  const grouped = new Map();
  for (const row of rowsResult.rows) {
    if (!grouped.has(row.employee_no)) grouped.set(row.employee_no, []);
    grouped.get(row.employee_no).push(row);
  }
  let committed = Number(batch.committed_employees || 0);
  for (const group of sortEmployeeGroups(
    [...grouped].map(([employeeNo, rows]) => ({ employeeNo, rows })),
  )) {
    try {
      await commitEmployeeGroup({
        batchId: id,
        organizationId,
        employeeNo: group.employeeNo,
        rows: group.rows,
        actor,
        requestId,
      });
      committed += 1;
    } catch (error) {
      const message =
        error.code === "23505" || error.code === "EMPLOYEE_DUPLICATE"
          ? "Commit gagal: NIP atau NIK sudah digunakan."
          : "Commit gagal: data tidak dapat disimpan; periksa kembali referensinya.";
      await pool.query(
        `UPDATE employee_import_rows
         SET status='skipped',validation_errors=validation_errors || $4::jsonb
         WHERE organization_id=$1 AND batch_id=$2 AND employee_no=$3 AND status='valid'`,
        [organizationId, id, group.employeeNo, JSON.stringify([message])],
      );
    }
  }
  const remaining = await pool.query(
    `SELECT count(DISTINCT employee_no)::int count FROM employee_import_rows
     WHERE organization_id=$1 AND batch_id=$2 AND status IN ('valid','invalid','skipped')`,
    [organizationId, id],
  );
  const finalStatus = remaining.rows[0].count ? "partially_committed" : "committed";
  await pool.query(
    `UPDATE employee_import_batches
     SET status=$3,committed_employees=$4,
       committed_at=CASE WHEN $3='committed' THEN now() ELSE committed_at END
     WHERE id=$1 AND organization_id=$2`,
    [id, organizationId, finalStatus, committed],
  );
  await withTransaction((client) =>
    writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "employee_import.commit",
      entityType: "employee_import_batch",
      entityId: id,
      afterData: { committedEmployees: committed, status: finalStatus },
      requestId,
    }),
  );
  return getEmployeeImportBatch(id, organizationId);
}

/** Menghasilkan laporan Excel berisi seluruh error per pegawai dan sheet. */
export async function createEmployeeImportErrorReport(id, organizationId) {
  const batch = await getEmployeeImportBatch(id, organizationId);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Kesalahan Import");
  sheet.columns = [
    { header: "NIP", key: "employeeNo", width: 24 },
    { header: "Sheet", key: "sheetName", width: 24 },
    { header: "Baris", key: "rowNumber", width: 12 },
    { header: "Pesan Perbaikan", key: "message", width: 80 },
  ];
  batch.groups.forEach((group) =>
    group.errors.forEach((error) => sheet.addRow({ employeeNo: group.employeeNo, ...error })),
  );
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getRow(1).font = { bold: true };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
