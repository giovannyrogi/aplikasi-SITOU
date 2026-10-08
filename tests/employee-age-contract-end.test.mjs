import test from "node:test";
import assert from "node:assert/strict";
import { calculateEmployeeAge } from "../lib/employees/age.mjs";
import {
  contractEndError,
  contractEndPresentation,
  isClosedContract,
} from "../lib/employees/contractEndPolicy.mjs";

test("usia menghitung tahun, bulan dan hari kalender, termasuk akhir bulan dan kabisat", () => {
  const age = (birthDate, today) => calculateEmployeeAge({ birthDate, today });
  assert.equal(age("1968-08-05", "2026-10-08").duration, "58 tahun 2 bulan 3 hari");
  assert.equal(age("1968-10-09", "2026-10-08").years, 57);
  assert.equal(age("1968-10-08", "2026-10-08").duration, "58 tahun 0 bulan 0 hari");
  assert.equal(age("2000-02-29", "2025-02-28").duration, "25 tahun 0 bulan 0 hari");
  assert.equal(age("2000-02-29", "2024-02-28").years, 23);
  assert.equal(age("2000-02-29", "2024-02-28").duration, "23 tahun 11 bulan 31 hari");
  assert.equal(age("2000-02-29", "2024-02-29").years, 24);
  assert.equal(age("2000-01-31", "2026-02-28").duration, "26 tahun 1 bulan 0 hari");
  assert.equal(age("2000-01-31", "2026-03-01").duration, "26 tahun 1 bulan 1 hari");
  for (const birthDate of [null, "2024-02-30", "2027-01-01", "invalid", "0000-01-01"])
    assert.equal(age(birthDate, "2026-10-08").valid, false);
});

test("usia pegawai meninggal berhenti pada tanggal meninggal", () => {
  const age = calculateEmployeeAge({
    birthDate: "1968-08-05",
    today: "2026-10-08",
    employmentStatus: "deceased",
    terminationDate: "2025-08-05",
  });
  assert.equal(age.label, "Usia saat meninggal");
  assert.equal(age.duration, "57 tahun 0 bulan 0 hari");
  assert.equal(
    calculateEmployeeAge({
      birthDate: "1968-08-05",
      today: "2026-10-08",
      employmentStatus: "deceased",
    }).valid,
    false,
  );
});

test("tanggal akhir berlaku menurut flag, dan histori penutupan tidak ditimpa", () => {
  assert.equal(contractEndError(true, null).code, "CONTRACT_END_REQUIRED");
  assert.equal(contractEndError(false, "2026-10-08").code, "CONTRACT_END_NOT_APPLICABLE");
  assert.equal(contractEndError(false, null), null);
  assert.equal(contractEndError(false, null, { historicalEndDate: "2026-10-08" }), null);
  assert.equal(contractEndError(false, "2026-10-08", { historicalEndDate: "2026-10-08" }), null);
  assert.equal(
    contractEndError(false, "2026-11-08", { historicalEndDate: "2026-10-08" }).code,
    "CONTRACT_END_NOT_APPLICABLE",
  );
  assert.equal(
    contractEndPresentation({ requires_end_date: false, end_date: "2026-10-08", status: "active" }),
    null,
  );
  assert.equal(
    contractEndPresentation({ requires_end_date: false, end_date: "2026-10-08", status: "renewed" })
      .label,
    "Tanggal penutupan periode",
  );
  assert.equal(
    contractEndPresentation({ requires_end_date: true, end_date: "2026-10-08", status: "active" })
      .label,
    "Akhir kontrak",
  );
  assert.equal(isClosedContract({ status: "cancelled" }), false);
});
