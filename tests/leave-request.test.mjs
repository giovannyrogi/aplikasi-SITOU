import assert from "node:assert/strict";
import test from "node:test";
import { leaveBeforeJoinedError, leaveAttachmentLimitError } from "../lib/leave/requestRules.mjs";
import { leaveRequestCreateSchema } from "../lib/leave/schemas.js";

test("tanggal cuti setelah atau sama dengan TMT bergabung diterima", () => {
  for (const timezone of ["UTC", "Asia/Makassar", "America/Los_Angeles"]) {
    const previous = process.env.TZ;
    process.env.TZ = timezone;
    try {
      assert.equal(leaveBeforeJoinedError("2026-08-26", "2021-02-01"), null);
      assert.equal(leaveBeforeJoinedError("2021-02-01", "2021-02-01"), null);
      const error = leaveBeforeJoinedError("2021-01-31", "2021-02-01");
      assert.match(error.message, /1 Februari 2021/);
      assert.equal(error.fieldErrors.startDate, error.message);
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  }
});

test("batas satu lampiran mencakup referensi dan upload baru", () => {
  assert.equal(leaveAttachmentLimitError([], [{}]), null);
  assert.equal(leaveAttachmentLimitError([1], []), null);
  assert.equal(leaveAttachmentLimitError(), null);
  for (const [ids, files] of [
    [[1], [{}]],
    [[1, 2], []],
    [[], [{}, {}]],
  ])
    assert.equal(leaveAttachmentLimitError(ids, files).code, "LEAVE_ATTACHMENT_LIMIT");
});

test("schema menerima jumlah HRD berbeda dari hari kalender dan menolak pecahan serta dua file", () => {
  const input = {
    organizationId: 1,
    employeeId: 1,
    leaveTypeId: 1,
    startDate: "2026-08-26",
    endDate: "2026-08-29",
    requestedUnits: 2,
    reason: "Urusan keluarga",
    attachmentFileIds: [1],
  };
  assert.equal(leaveRequestCreateSchema.parse(input).requestedUnits, 2);
  assert.equal(
    leaveRequestCreateSchema.safeParse({ ...input, attachmentFileIds: [1, 2] }).success,
    false,
  );
  assert.equal(
    leaveRequestCreateSchema.safeParse({ ...input, requestedUnits: 1.5 }).success,
    false,
  );
});
import { previewLeaveBalance } from "../lib/leave/balancePreview.mjs";

test("preview saldo mengikuti ledger, pembatalan, penyesuaian, dan hak awal tanpa mutation", () => {
  const type = { id: "8", annual_allowance: "12" };
  assert.deepEqual(previewLeaveBalance(type, [], 2), {
    allowance: 12,
    used: 0,
    adjustments: 0,
    remaining: 12,
    after: 10,
    automatic: true,
  });
  const balances = [
    {
      leave_type_id: "8",
      balance: "8",
      transactions: [
        { type: "grant", units: "12" },
        { type: "usage", units: "-6" },
        { type: "restoration", units: "2" },
        { type: "adjustment", units: "-1" },
        { type: "carryover", units: "1" },
      ],
    },
  ];
  assert.deepEqual(previewLeaveBalance(type, balances, 9), {
    allowance: 12,
    used: 4,
    adjustments: 0,
    remaining: 8,
    after: -1,
    automatic: false,
  });
  assert.equal(previewLeaveBalance(type, [{ leave_type_id: "8", balance: "0" }], 1).remaining, 0);
});
