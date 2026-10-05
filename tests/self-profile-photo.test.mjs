import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../lib/files/selfProfilePhoto.js", import.meta.url), "utf8")
  .replace('import pool from "@/lib/dbConfig";', "const pool = null;")
  .replace(
    'import { ServiceError } from "@/lib/api/routeHelpers";',
    "class ServiceError extends Error { constructor(code, message, status) { super(message); this.code=code; this.status=status; } }",
  )
  .replace(
    'import { getStoredFile } from "@/lib/files/storage";',
    "const getStoredFile = (id, organizationId, database) => database.loadFile(id, organizationId);",
  );
const { getSelfProfilePhoto } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

test("pas foto sendiri memakai identitas server dan referensi aktif, bukan target klien", async () => {
  const database = {
    query: async (sql, values) => {
      assert.deepEqual(values, ["10", "20", "30"]);
      for (const clause of [
        "file.organization_id=employee.organization_id",
        "file.id=employee.profile_photo_file_id",
        "file.employee_id=employee.id",
        "employee.user_id=$3",
        "employee.deleted_at IS NULL",
        "file.category='employee_photo'",
        "file.lifecycle_status='active'",
        "file.deleted_at IS NULL",
        "file.content_purged_at IS NULL",
        "file.onboarding_draft_id IS NULL",
      ])
        assert.ok(sql.includes(clause), clause);
      return { rows: [{ id: "40" }] };
    },
    loadFile: async (id, organizationId) => ({ id, organizationId }),
  };
  assert.deepEqual(
    await getSelfProfilePhoto({ organization_id: "10", employee_id: "20", id: "30" }, database),
    { id: "40", organizationId: "10" },
  );
});

test("akun tanpa profil atau referensi pas foto yang sah ditolak", async () => {
  for (const user of [
    {},
    { organization_id: "10" },
    { organization_id: "10", employee_id: "20", id: "30" },
  ])
    await assert.rejects(getSelfProfilePhoto(user, { query: async () => ({ rows: [] }) }), {
      code: "PROFILE_PHOTO_NOT_FOUND",
      status: 404,
    });
});
