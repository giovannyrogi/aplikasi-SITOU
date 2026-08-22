import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { inspectEmployeeWorkbook } from "../lib/employees/importPackage.js";

test("pemeriksaan keamanan menerima container XLSX valid", async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Pegawai");
  const workbookBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const inspection = await inspectEmployeeWorkbook(workbookBuffer);
  assert.ok(inspection.entryCount > 0);
  assert.ok(inspection.expandedBytes > 0);
});

test("pemeriksaan keamanan menolak byte yang bukan XLSX", async () => {
  await assert.rejects(
    inspectEmployeeWorkbook(Buffer.from("bukan workbook")),
    (error) => error.code === "IMPORT_FILE_INVALID",
  );
});

test("pemeriksaan keamanan menolak tautan eksternal dalam workbook", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Pegawai");
  sheet.getCell("A1").value = { text: "Tautan", hyperlink: "https://example.com" };
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await assert.rejects(
    inspectEmployeeWorkbook(buffer),
    (error) => error.code === "IMPORT_WORKBOOK_EXTERNAL_LINK",
  );
});
