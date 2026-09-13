import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  addMonths,
  normalizeReportFilters,
  organizationToday,
  changeReportFilters,
  deadlineLabel,
  validDate,
} from "../lib/reports/policy.mjs";
import { buildReportWorkbook } from "../lib/reports/workbook.mjs";

test("pensiun memakai kalender 58 tahun dan akhir bulan kabisat", () => {
  assert.equal(addMonths("1968-02-29", 58 * 12), "2026-02-28");
  assert.equal(addMonths("2024-02-29", 12), "2025-02-28");
  assert.equal(validDate("2026-02-31"), false);
  assert.equal(organizationToday("Asia/Makassar", new Date("2026-12-31T18:00:00Z")), "2027-01-01");
});
test("default, tahun ini, periode lampau dan rentang invalid", () => {
  const today = "2026-09-11";
  for (const kind of ["retirements", "expiring-contracts"]) {
    assert.equal(normalizeReportFilters(kind, {}, today).pageSize, 10);
    assert.equal(normalizeReportFilters(kind, { pageSize: 20 }, today).pageSize, 20);
    assert.equal(normalizeReportFilters(kind, { pageSize: 50 }, today).pageSize, 50);
  }
  assert.equal(normalizeReportFilters("retirements", {}, today).endDate, "2027-09-11");
  assert.equal(normalizeReportFilters("expiring-contracts", {}, today).endDate, "2026-10-11");
  assert.equal(
    normalizeReportFilters("retirements", { group: "overdue" }, today).startDate,
    undefined,
  );
  const year = normalizeReportFilters("retirements", { period: "year", group: "all" }, today);
  assert.equal(year.startDate, "2026-01-01");
  assert.equal(year.endDate, "2026-12-31");
  assert.throws(() =>
    normalizeReportFilters(
      "retirements",
      { period: "custom", startDate: "2026-12-01", endDate: "2026-01-01" },
      today,
    ),
  );
  assert.equal(
    normalizeReportFilters("retirements", { group: "invalid", period: "year" }, today).endDate,
    undefined,
  );
  assert.throws(() =>
    normalizeReportFilters("retirements", { locationId: "999999999999999999999999" }, today),
  );
});
test("perubahan kelompok dan periode tidak membawa batas yang bertentangan", () => {
  const previous = {
    period: "custom",
    startDate: "2026-09-11",
    endDate: "2027-09-11",
    cursor: "old",
  };
  const next = changeReportFilters(previous, "group", "overdue", "retirements");
  assert.equal(next.period, "none");
  assert.equal(next.startDate, undefined);
  assert.equal(next.cursor, undefined);
  assert.equal(changeReportFilters(next, "period", "year", "retirements").group, "all");
  assert.equal(
    changeReportFilters(previous, "group", "upcoming", "retirements").startDate,
    previous.startDate,
  );
  assert.equal(deadlineLabel(0, "retirements"), "Mencapai usia pensiun hari ini");
  assert.equal(deadlineLabel(-3, "expiring-contracts"), "Lewat 3 hari");
});
test("Excel menjaga nol awal, string formula, metadata dan hasil kosong", async () => {
  const report = {
    organization: { name: "Organisasi Uji" },
    asOf: "2026-09-11",
    generatedAt: "2026-09-11T00:00:00Z",
    filters: { group: "upcoming", search: "", successor: "all" },
    total: 1,
    employeeCount: 1,
    rows: [
      {
        employee_no: "000123",
        full_name: '=HYPERLINK("bad")',
        contract_no: "001/TEST",
        deadline: "1 hari lagi",
      },
    ],
  };
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildReportWorkbook("expiring-contracts", report));
  const sheet = workbook.worksheets[0];
  const row = sheet.lastRow;
  assert.equal(row.getCell(1).value, "000123");
  assert.equal(typeof row.getCell(2).value, "string");
  assert.equal(row.getCell(2).formula, undefined);
  await workbook.xlsx.load(
    await buildReportWorkbook("retirements", { ...report, rows: [], total: 0, employeeCount: 0 }),
  );
  assert.ok(workbook.worksheets[0].rowCount > 0);
});
