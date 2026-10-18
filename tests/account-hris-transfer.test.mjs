import assert from "node:assert/strict";
import test from "node:test";
import { accountUpdateSchema } from "../lib/access/schemas.js";

const account = {
  organizationId: 1,
  employeeId: 10,
  username: "pegawai.contoh",
  roleCode: "employee",
  isActive: true,
  version: "2026-10-18T00:00:00.000Z",
};

test("pengalihan admin diterima saat akun aktif menjadi Pegawai", () => {
  const result = accountUpdateSchema.safeParse({ ...account, hrisSuccessorAccountId: "12" });
  assert.equal(result.success, true);
  assert.equal(result.data.hrisSuccessorAccountId, 12);
});

test("admin pengganti tidak dapat disisipkan pada perubahan lain", () => {
  for (const change of [{ roleCode: "hrd" }, { roleCode: "leader" }, { isActive: false }]) {
    const result = accountUpdateSchema.safeParse({
      ...account,
      ...change,
      hrisSuccessorAccountId: 12,
    });
    assert.equal(result.success, false);
    assert.ok(result.error.issues.some((issue) => issue.path[0] === "hrisSuccessorAccountId"));
  }
});

test("admin pengganti harus berupa ID akun yang valid", () => {
  const result = accountUpdateSchema.safeParse({ ...account, hrisSuccessorAccountId: -1 });
  assert.equal(result.success, false);
});
