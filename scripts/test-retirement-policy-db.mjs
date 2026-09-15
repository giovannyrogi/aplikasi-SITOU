import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import pg from "pg";
import { validReportId } from "../lib/reports/policy.mjs";
dotenv.config({ path: ".env.development", quiet: true });
const client = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

// Memuat fungsi produksi dengan dependency database sementara; tidak menulis data organisasi asli.
const helpers = await readFile(new URL("../lib/api/routeHelpers.js", import.meta.url), "utf8");
const ServiceError = new Function(
  helpers
    .slice(
      helpers.indexOf("export class ServiceError"),
      helpers.indexOf("export const handleRouteError"),
    )
    .replace("export class", "class") + "return ServiceError;",
)();
const permissions = (await readFile(new URL("../lib/auth/permissions.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "")
  .replace(/export /g, "");
const resolvePermissionOrganization = new Function(
  "ROLES",
  "ServiceError",
  permissions + "return resolvePermissionOrganization;",
)({ SUPERADMIN: "superadmin" }, ServiceError);
const auditSource = (await readFile(new URL("../lib/audit.js", import.meta.url), "utf8")).replace(
  /export /g,
  "",
);
const writeAudit = new Function(auditSource + "return writeAudit;")();
const source = (
  await readFile(new URL("../lib/retirement-policy/service.js", import.meta.url), "utf8")
)
  .replace(/^import .*;\r?\n/gm, "")
  .replace(/export /g, "");
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(`CREATE TEMP TABLE organizations(id bigint PRIMARY KEY,name text,is_active boolean);
    INSERT INTO organizations VALUES(1,'Organisasi Sintetis A',true),(2,'Organisasi Sintetis B',true);
    CREATE TEMP TABLE users(id bigint PRIMARY KEY,username text);
    INSERT INTO users VALUES(1,'qa_hrd'),(2,'qa_leader'),(3,'qa_admin');
    CREATE TEMP TABLE v_user_identity(user_id bigint,display_name text);
    CREATE TEMP TABLE roles AS SELECT id,code FROM public.roles;
    CREATE TEMP TABLE permissions AS SELECT id,code FROM public.permissions;
    CREATE TEMP TABLE role_permissions AS SELECT role_id,permission_id FROM public.role_permissions;
    CREATE TEMP TABLE organization_retirement_policies(LIKE public.organization_retirement_policies INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
    CREATE TEMP TABLE audit_logs(id bigint GENERATED ALWAYS AS IDENTITY,organization_id bigint,actor_user_id bigint,action text,entity_type text,entity_id text,before_data jsonb,after_data jsonb,request_id uuid,occurred_at timestamptz DEFAULT now());`);
  // Transaksi service menjadi savepoint agar seluruh fixture dapat di-rollback di akhir.
  const tx = {
    release() {},
    query(sql, values) {
      return client.query(
        sql === "BEGIN"
          ? "SAVEPOINT policy_save"
          : sql === "COMMIT"
            ? "RELEASE SAVEPOINT policy_save"
            : sql === "ROLLBACK"
              ? "ROLLBACK TO SAVEPOINT policy_save"
              : sql,
        values,
      );
    },
  };
  const database = { query: client.query.bind(client), connect: async () => tx };
  const { getRetirementPolicy, saveRetirementPolicy } = new Function(
    "pool",
    "resolvePermissionOrganization",
    "ServiceError",
    "writeAudit",
    "validReportId",
    source + "return {getRetirementPolicy,saveRetirementPolicy};",
  )(database, resolvePermissionOrganization, ServiceError, writeAudit, validReportId);
  const hrd = { id: 1, role_code: "hrd", organization_id: "1" };
  const leader = { id: 2, role_code: "leader", organization_id: "1" };
  const admin = { id: 3, role_code: "superadmin" };
  const input = { retirementAge: 60, version: 0, reason: "Kebijakan sintetis pengujian" };
  assert.equal((await getRetirementPolicy(hrd, "1")).policy, null);
  await saveRetirementPolicy(hrd, "1", input, "00000000-0000-4000-8000-000000000001");
  const read = await getRetirementPolicy(leader, "1");
  assert.equal(read.policy.retirement_age, 60);
  assert.equal(read.canManage, false);
  assert.equal(read.history.length, 1);
  assert.equal(read.history[0].after_data.retirement_age, 60);
  assert.equal((await getRetirementPolicy(admin, "2")).policy, null);
  await assert.rejects(getRetirementPolicy(hrd, "2"), (e) => e.code === "ORGANIZATION_FORBIDDEN");
  await assert.rejects(
    saveRetirementPolicy(leader, "1", input),
    (e) => e.code === "RETIREMENT_POLICY_FORBIDDEN",
  );
  await assert.rejects(
    saveRetirementPolicy(hrd, "1", input),
    (e) => e.code === "RETIREMENT_POLICY_CONFLICT",
  );
  await assert.rejects(
    getRetirementPolicy({ ...hrd, role_code: "employee" }, "1"),
    (e) => e.code === "RETIREMENT_POLICY_FORBIDDEN",
  );
  await saveRetirementPolicy(
    admin,
    "2",
    { ...input, retirementAge: 62 },
    "00000000-0000-4000-8000-000000000002",
  );
  await saveRetirementPolicy(
    hrd,
    "1",
    { ...input, version: 1, retirementAge: 61 },
    "00000000-0000-4000-8000-000000000003",
  );
  assert.equal((await getRetirementPolicy(hrd, "1")).policy.retirement_age, 61);
  assert.equal((await getRetirementPolicy(admin, "2")).policy.retirement_age, 62);
  assert.equal((await getRetirementPolicy(hrd, "1")).history.length, 2);
  console.log(
    "PASS kebijakan pensiun: buat, baca, koreksi, audit, konflik versi, permission, isolasi organisasi.",
  );
} finally {
  await client.query("ROLLBACK");
  await client.end();
}
