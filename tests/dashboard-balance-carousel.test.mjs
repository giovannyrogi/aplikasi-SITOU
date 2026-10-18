import test from "node:test";
import assert from "node:assert/strict";
import {
  adjacentBalance,
  leaveBalanceCardMetric,
  selectableBalances,
  selectedBalance,
  shouldAutoRotateBalance,
} from "../lib/dashboard/personalPresentation.mjs";

const balance = (id, name, value, unit = "day") => ({
  id,
  name,
  unit,
  is_active: true,
  uses_balance: true,
  balance: value,
  allocated: 12,
  used: 12 - value,
});

test("pergantian jenis memakai data dan indikator milik jenis yang sama", () => {
  const cases = [
    [
      balance("full", "Cuti penuh", 12),
      12,
      "hari",
      100,
      "success",
      "Saldo tahun ini belum digunakan",
    ],
    [
      balance("partial", "Cuti terpakai", 9),
      9,
      "hari",
      75,
      "warning",
      "Sebagian jatah sudah digunakan",
    ],
    [balance("low", "Cuti hampir habis", 3), 3, "hari", 25, "danger", "Jatah hampir habis"],
    [balance("empty", "Cuti habis", 0), 0, "hari", 0, "danger", "Jatah habis"],
    [balance("negative", "Cuti terlampaui", -1), -1, "hari", 0, "danger", "Jatah tidak mencukupi"],
    [
      balance("hour", "Izin per jam", 6, "hour"),
      6,
      "jam",
      50,
      "warning",
      "Sebagian jatah sudah digunakan",
    ],
  ];

  for (const [row, value, unit, percent, tone, status] of cases) {
    const metric = leaveBalanceCardMetric(row);
    assert.equal(metric.label, row.name);
    assert.equal(metric.value, value);
    assert.equal(metric.unit, unit);
    assert.equal(metric.progress, percent);
    assert.equal(metric.progressTone, tone);
    assert.equal(metric.progressStatus, status);
    if (row.used > 0) assert.equal(metric.description, `Terpakai ${row.used} dari 12 ${unit}`);
    else assert.equal(metric.description, "");
    assert.match(metric.progressAriaLabel, new RegExp(`${value} dari 12 ${unit}$`));
  }
});

test("tanpa saldo dan satu jenis tidak membuat pilihan lain", () => {
  assert.equal(selectedBalance([], null), null);
  assert.equal(adjacentBalance([], null, 1), null);
  const empty = leaveBalanceCardMetric(null);
  assert.equal(empty.valueText, "Belum tersedia");
  assert.equal(empty.progress, undefined);

  const only = balance("only", "Nama cuti yang sangat panjang untuk kartu kecil", 12);
  assert.equal(adjacentBalance([only], "only", 1), only);
});

test("pilihan yang tersimpan divalidasi ulang dan navigasi melingkar", () => {
  const rows = selectableBalances([
    balance("b", "Cuti B", 8),
    balance("a", "Cuti A", 12),
    { ...balance("inactive", "Cuti lama", 5), is_active: false },
  ]);
  assert.deepEqual(
    rows.map((row) => row.id),
    ["a", "b"],
  );
  assert.equal(selectedBalance(rows, "hilang").id, "a");
  assert.equal(adjacentBalance(rows, "a", 1).id, "b");
  assert.equal(adjacentBalance(rows, "b", 1).id, "a");
  assert.equal(adjacentBalance(rows, "a", -1).id, "b");
});

test("jatah dari aturan tetap dibedakan dari saldo resmi", () => {
  const metric = leaveBalanceCardMetric({
    id: "planned",
    name: "Izin tahunan",
    unit: "hour",
    balance: null,
    annual_allowance: 10,
  });
  assert.equal(metric.label, "Izin tahunan");
  assert.equal(metric.value, 10);
  assert.equal(metric.unit, "jam");
  assert.equal(metric.description, "");
  assert.equal(metric.progressTone, "success");
  assert.equal(metric.progressStatus, "Jatah tahun ini belum digunakan");
  assert.equal(metric.progressAriaLabel, "Jatah tahun ini 10 jam, belum digunakan");
});

test("jatah kembali penuh setelah koreksi tidak disebut belum digunakan", () => {
  const metric = leaveBalanceCardMetric({ ...balance("adjusted", "Cuti tambahan", 12), used: 2 });
  assert.equal(metric.progressTone, "success");
  assert.equal(metric.progressStatus, "Sisa jatah masih penuh");
  assert.equal(metric.description, "Terpakai 2 dari 12 hari");
});

test("jatah turun karena koreksi tidak disebut telah digunakan", () => {
  const metric = leaveBalanceCardMetric({ ...balance("corrected", "Cuti koreksi", 8), used: 0 });
  assert.equal(metric.progressTone, "warning");
  assert.equal(metric.progressStatus, "Jatah berkurang");
  assert.equal(metric.description, "");
});

test("pergantian otomatis berhenti saat kartu dibaca atau tidak terlihat", () => {
  const ready = {
    count: 2,
    hovering: false,
    focusWithin: false,
    reducedMotion: false,
    pageVisible: true,
    cardVisible: true,
  };
  assert.equal(shouldAutoRotateBalance(ready), true);
  for (const override of [
    { count: 1 },
    { hovering: true },
    { focusWithin: true },
    { reducedMotion: true },
    { pageVisible: false },
    { cardVisible: false },
  ]) {
    assert.equal(shouldAutoRotateBalance({ ...ready, ...override }), false);
  }
  assert.equal(shouldAutoRotateBalance({ ...ready, hovering: false }), true);
});
