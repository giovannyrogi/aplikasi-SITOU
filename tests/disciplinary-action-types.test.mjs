import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("migration menyediakan enam tindakan bawaan dan snapshot non-retroaktif", async () => {
  const migration = await read("../database/migrations/20260920_029_disciplinary_action_types.sql");
  for (const key of ["oral_warning", "sp1", "sp2", "sp3", "suspension", "demotion"])
    assert.match(migration, new RegExp(`'${key}'`));
  assert.match(migration, /action_name_snapshot/);
  assert.match(migration, /requires_document_snapshot/);
  assert.match(migration, /duration_value_snapshot/);
  assert.match(migration, /superseded/);
  assert.match(migration, /ALTER TABLE disciplinary_actions DROP COLUMN action_type/);
});

test("API membatasi pembuatan jenis ke Superadmin dan update tetap terikat organisasi", async () => {
  const [collectionRoute, itemRoute, service] = await Promise.all([
    read("../app/api/discipline/action-types/route.js"),
    read("../app/api/discipline/action-types/[id]/route.js"),
    read("../lib/discipline/actionTypeService.js"),
  ]);
  assert.match(collectionRoute, /requirePermission\("discipline_settings\.manage"\)/);
  assert.match(collectionRoute, /user\.role_code !== "superadmin"/);
  assert.match(collectionRoute, /resolvePermissionOrganization/);
  assert.match(itemRoute, /resolvePermissionOrganization/);
  assert.match(service, /actor\.role_code === "superadmin" \? input\.name/);
  assert.match(service, /date_trunc\('milliseconds',updated_at\)/);
});

test("penerbitan memakai master aktif, menghitung akhir di server dan menggantikan tindakan lama", async () => {
  const service = await read("../lib/discipline/service.js");
  assert.match(service, /FROM disciplinary_action_types/);
  assert.match(service, /ACTION_TYPE_INACTIVE/);
  assert.match(service, /make_interval\(days=>\$2::int\)/);
  assert.match(service, /make_interval\(months=>\$2::int\)/);
  assert.match(service, /SET status='superseded'/);
  assert.match(service, /requires_document_snapshot/);
  assert.doesNotMatch(service, /interval '3 months'/);
});

test("form tindakan mengambil opsi organisasi dan tidak mengirim tanggal akhir dari klien", async () => {
  const form = await read("../app/components/discipline/DisciplineForms.jsx");
  assert.match(form, /\/api\/discipline\/action-types\?options=true/);
  assert.match(form, /name="actionTypeId"/);
  assert.match(form, /Tidak memiliki tanggal akhir/);
  assert.doesNotMatch(form, /effectiveUntil: values\.effectiveUntil/);
});
