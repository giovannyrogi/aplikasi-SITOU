import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("daftar akun mengecualikan akun sesi pada data dan total", async () => {
  const service = await readFile(new URL("../lib/access/service.js", import.meta.url), "utf8");
  assert.match(service, /AND user_account\.id<>\$7::bigint/);
  assert.match(service, /scopedLocationIds,\s*actor\.id,\s*pageSize,\s*offset/);
  assert.match(service, /params\.slice\(0, 7\)/);
});

test("detail, edit, dan reset password melalui Akun Organisasi menolak akun sendiri", async () => {
  const service = await readFile(new URL("../lib/access/service.js", import.meta.url), "utf8");
  assert.match(service, /const account = await getOrganizationAccount\(id, organizationId, database\);\s*if \(String\(account\.id\) === String\(actor\.id\)\)/);
  assert.match(service, /SELF_ACCOUNT_MANAGEMENT_FORBIDDEN/);
  assert.match(service, /updateOrganizationAccount[\s\S]*?getOrganizationAccountForActor\(id,/);
  assert.match(service, /resetOrganizationAccountPassword[\s\S]*?getOrganizationAccountForActor\(id,/);
});
