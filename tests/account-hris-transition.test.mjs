import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { accountUpdateSchema } from "../lib/access/schemas.js";
import { resolveHrisAdminTransition } from "../lib/access/hrisAdminTransition.mjs";

const account = {
  organizationId: 1,
  employeeId: 10,
  username: "pegawai.contoh",
  roleCode: "employee",
  isActive: true,
  version: "2026-10-18T00:00:00.000Z",
};

test("pencabutan admin penuh tidak memerlukan akun pengganti", () => {
  for (const change of [
    { roleCode: "hrd", isHrisAdmin: false },
    { roleCode: "employee", isHrisAdmin: false },
    { roleCode: "leader" },
    { roleCode: "hrd", isActive: false },
  ]) {
    const result = accountUpdateSchema.safeParse({ ...account, ...change, hrisPolicyVersion: 3 });
    assert.equal(result.success, true);
  }
  assert.equal(
    accountUpdateSchema.safeParse({ ...account, hrisSuccessorAccountId: 12 }).success,
    false,
  );
});

test("admin penuh hanya dapat ditetapkan pada HRD aktif", () => {
  assert.equal(accountUpdateSchema.safeParse({ ...account, isHrisAdmin: true }).success, false);
  assert.equal(
    accountUpdateSchema.safeParse({
      ...account,
      roleCode: "hrd",
      isActive: false,
      isHrisAdmin: true,
    }).success,
    false,
  );
});

test("admin penuh dicabut oleh switch, perubahan role, atau penonaktifan", () => {
  for (const change of [
    { isHrisAdmin: false, roleCode: "hrd", isActive: true },
    { roleCode: "employee", isActive: true },
    { roleCode: "leader", isActive: true },
    { roleCode: "hrd", isActive: false },
  ]) {
    assert.deepEqual(resolveHrisAdminTransition({ primary: true, ...change }), {
      revoke: true,
      promote: false,
    });
  }
});

test("HRD pertama tidak ditetapkan otomatis; akun lama atau baru hanya dipromosikan eksplisit", () => {
  assert.deepEqual(
    resolveHrisAdminTransition({ primary: false, roleCode: "hrd", isActive: true }),
    { revoke: false, promote: false },
  );
  assert.deepEqual(
    resolveHrisAdminTransition({
      primary: false,
      isHrisAdmin: true,
      roleCode: "hrd",
      isActive: true,
    }),
    { revoke: false, promote: true },
  );
});

test("server mengosongkan hak HRIS pada pencabutan dan mempertahankan Inventaris", async () => {
  const service = await readFile(
    new URL("../lib/access/hrisRepository.js", import.meta.url),
    "utf8",
  );
  assert.match(service, /input\.hrisMenuAccess = \[\];\s*input\.hrisAccountAccess = "none"/);
  assert.match(service, /primary_membership_id=NULL,version=version\+1/);
  assert.match(service, /input\.hrisPolicyVersion !== policy\.version/);
  assert.doesNotMatch(service, /replaceAccountPackages|hrisSuccessorAccountId/);
});

test("guard HRD terakhir dikecualikan untuk Superadmin; larangan menonaktifkan diri tetap ada", async () => {
  const service = await readFile(new URL("../lib/access/service.js", import.meta.url), "utf8");
  assert.match(service, /SELF_DEACTIVATION_FORBIDDEN/);
  assert.match(service, /!losesHrdAccess \|\| actor\.role_code === "superadmin"/);
});
