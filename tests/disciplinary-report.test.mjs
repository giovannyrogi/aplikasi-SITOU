import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import {
  normalizeDisciplinaryReportFilters,
  changeDisciplinaryReportFilters,
} from "../lib/reports/disciplinaryPolicy.mjs";
import { buildDisciplinaryReportQuery } from "../lib/reports/disciplinaryQuery.mjs";
import { buildDisciplinaryReportWorkbook } from "../lib/reports/disciplinaryWorkbook.mjs";
import { formatDisciplinaryValidityPeriod } from "../lib/discipline/presentation.mjs";

test("filter laporan sanksi menolak draft, ID dan rentang tanggal invalid", () => {
  const defaults = normalizeDisciplinaryReportFilters({});
  assert.equal(defaults.actionStatus, "all");
  assert.equal(defaults.actionTypeId, undefined);
  assert.equal(defaults.pageSize, 10);
  assert.throws(() => normalizeDisciplinaryReportFilters({ actionStatus: "draft" }));
  assert.throws(() => normalizeDisciplinaryReportFilters({ locationId: "0" }));
  assert.throws(() => normalizeDisciplinaryReportFilters({ startDate: "2026-01-01" }));
  assert.throws(() =>
    normalizeDisciplinaryReportFilters({ startDate: "2026-12-01", endDate: "2026-01-01" }),
  );
  assert.equal(
    changeDisciplinaryReportFilters({ cursor: "lama" }, "actionTypeId", "7")
      .cursor,
    undefined,
  );
});

test("query laporan mengunci organisasi, scope, official-only dan tindakan cocok terbaru", () => {
  const filters = normalizeDisciplinaryReportFilters({
    actionTypeId: "7",
    actionStatus: "active",
    severity: "moderate",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  });
  const query = buildDisciplinaryReportQuery(filters, "10", ["20"], "2026-09-20", 11, {
    date: "2026-08-01",
    employeeId: "99",
  });
  assert.match(query.text, /action\.organization_id=\$1/);
  assert.match(query.text, /action\.status<>'draft'/);
  assert.match(query.text, /assignment\.location_id=ANY\(\$3::bigint\[\]\)/);
  assert.match(
    query.text,
    /row_number\(\) OVER \(PARTITION BY employee\.id ORDER BY action\.issued_date DESC,action\.id DESC\)/,
  );
  assert.match(query.text, /matched\.match_rank=1/);
  assert.match(query.text, /official\.status<>'draft'/);
  assert.ok(query.values.includes("7"));
  assert.ok(query.values.includes("active"));
  assert.ok(query.values.includes("moderate"));
});

test("Excel laporan menjaga NIP dan tidak mengekspor narasi atau URL dokumen", async () => {
  const report = {
    organization: { name: "Organisasi Uji" },
    asOf: "2026-09-20",
    generatedAt: "2026-09-20T00:00:00Z",
    filters: {
      search: "",
      employmentStatus: "all",
      severity: "all",
      actionTypeId: undefined,
      actionStatus: "all",
    },
    filterLabels: {},
    total: 1,
    totalMatchedActions: 2,
    rows: [
      {
        employee_no: "000123",
        full_name: '=HYPERLINK("https://example.test")',
        employment_status: "active",
        action_type_id: "7",
        action_name_snapshot: "SP1",
        action_status: "active",
        severity: "light",
        case_no: "KASUS-2026-00001",
        letter_no: "001/SP1",
        direct_escalation: false,
        matched_action_count: 2,
        total_official_actions: 2,
        active_or_appealed_count: 1,
        description: "Narasi rahasia tidak boleh diekspor",
        document_file_id: "9",
      },
    ],
  };
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildDisciplinaryReportWorkbook(report));
  const sheet = workbook.worksheets[0];
  const values = sheet.getSheetValues().flat().filter(Boolean).map(String);
  assert.ok(values.includes("000123"));
  assert.equal(
    values.some((value) => value.includes("Narasi rahasia")),
    false,
  );
  assert.equal(
    values.some((value) => value.includes("/api/uploads/9")),
    false,
  );
  const lastRow = sheet.lastRow;
  assert.equal(lastRow.getCell(2).formula, undefined);
});

test("route laporan dan histori menegakkan permission serta official-only di server", async () => {
  const [route, historyRoute, service] = await Promise.all([
    readFile(new URL("../lib/reports/disciplinaryRoute.js", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/employees/[id]/discipline-history/route.js", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../lib/discipline/service.js", import.meta.url), "utf8"),
  ]);
  assert.match(route, /requirePermission\("employees\.read"\)/);
  assert.match(route, /requirePermission\("discipline\.read"\)/);
  assert.match(historyRoute, /officialOnly: searchParams\.get\("officialOnly"\) === "1"/);
  assert.match(service, /official_action\.status<>'draft'/);
  assert.match(service, /officialCaseFilter/);
});

test("masa berlaku menjelaskan tanggal akhir yang tersedia dan yang belum ditetapkan", () => {
  const formatDate = (value) =>
    ({ "2026-09-20": "20 Sep 2026", "2026-12-20": "20 Des 2026" })[value];
  assert.equal(
    formatDisciplinaryValidityPeriod("2026-09-20", "2026-12-20", formatDate),
    "20 Sep 2026 – 20 Des 2026",
  );
  assert.equal(
    formatDisciplinaryValidityPeriod("2026-09-20", null, formatDate),
    "Berlaku sejak 20 Sep 2026 · Tanpa batas waktu",
  );
});

test("header hasil sederhana dan kolom sanksi dipisahkan sesuai konteks", async () => {
  const [disciplinaryReport, employeeReport, historyModal] = await Promise.all([
    readFile(new URL("../app/components/reports/DisciplinaryReport.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/reports/EmployeeReport.jsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/reports/DisciplinaryHistoryModal.jsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(
    disciplinaryReport,
    /Daftar pegawai beserta sanksi terbaru dan ringkasan riwayat sesuai filter\./,
  );
  assert.doesNotMatch(disciplinaryReport, /aktif\/dalam banding|Sanksi terbaru sesuai filter/);
  assert.doesNotMatch(disciplinaryReport, /Diperbarui \{dayjs\(report\.generatedAt\)/);
  assert.match(disciplinaryReport, /Tindakan yang masih aktif atau sedang dalam proses banding\./);
  assert.match(
    employeeReport,
    /Daftar kontrak pegawai yang akan atau telah berakhir sesuai filter\./,
  );
  assert.match(employeeReport, /Daftar pegawai berdasarkan proyeksi usia pensiun sesuai filter\./);
  assert.doesNotMatch(employeeReport, /Diperbarui \{dayjs\(report\.generatedAt\)/);
  const titles = [
    'title: "Sanksi terbaru"',
    'title: "Tingkat"',
    'title: "Nomor kasus"',
    'title: "Tanggal kejadian"',
    'title: "Nomor surat"',
    'title: "Tanggal terbit"',
    'title: "Masa berlaku"',
  ];
  titles.reduce((position, title) => {
    const next = disciplinaryReport.indexOf(title);
    assert.ok(next > position, `${title} harus berada pada urutan kolom yang benar.`);
    return next;
  }, -1);
  assert.match(historyModal, /formatDisciplinaryValidityPeriod/);
});
