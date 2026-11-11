import assert from "node:assert/strict";
import test from "node:test";
import { hrisLevel, hrisRouteOwner } from "../access/hrisPolicy.mjs";
import { normalizeAttendanceFilters } from "./attendancePolicy.mjs";
import {
  attendanceTime,
  attendanceMinutes,
  attendanceIndicator,
} from "./attendancePresentation.mjs";

const today = "2026-11-11";

test("default follows organization date and shows every indicator", () => {
  const { filters } = normalizeAttendanceFilters({}, today);
  assert.equal(filters.startDate, today);
  assert.equal(filters.endDate, today);
  assert.equal(filters.indicator, undefined);
});

test("invalid range, indicator and IDs return field errors", () => {
  for (const [input, field] of [
    [{ startDate: today }, "startDate"],
    [{ startDate: today, endDate: "2026-02-30" }, "endDate"],
    [{ startDate: today, endDate: "2026-11-10" }, "endDate"],
    [{ startDate: "2026-01-01", endDate: today }, "endDate"],
    [{ indicator: "lembur" }, "indicator"],
    [{ locationId: "9999999999999999999" }, "locationId"],
  ]) {
    assert.ok(normalizeAttendanceFilters(input, today).fieldErrors[field]);
  }
});

test("clock-out across midnight shows its local date and missing duration remains unknown", () => {
  assert.match(attendanceTime("2026-11-11T22:05:00Z", "Asia/Makassar", today), /06[.:]05 · 12 Nov/);
  assert.equal(attendanceMinutes(null), "—");
  assert.equal(attendanceMinutes(65), "1 jam 5 menit");
  assert.equal(attendanceIndicator("on_time_check_out")[0], "Pulang tepat waktu");
});

test("HRD needs the feature and a read grant, including for the photo endpoint", () => {
  const key = "attendance-summary-report";
  const actor = { role_code: "hrd", hrisContext: { attendanceEnabled: true, grants: [] } };
  assert.equal(hrisLevel(actor, key), null);
  actor.hrisContext.grants = [{ key, level: "read" }];
  assert.equal(hrisLevel(actor, key), "read");
  actor.hrisContext.attendanceEnabled = false;
  assert.equal(hrisLevel(actor, key), null);
  assert.deepEqual(hrisRouteOwner("/api/reports/attendance-summary/18/photos/24"), {
    key,
    level: "read",
  });
});
