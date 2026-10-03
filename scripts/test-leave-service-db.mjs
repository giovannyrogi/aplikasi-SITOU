import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp, readdir, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import dotenv from "dotenv";
import pg from "pg";
import * as rules from "../lib/leave/requestRules.mjs";
import * as schemas from "../lib/leave/schemas.js";

dotenv.config({ path: ".env.development", quiet: true });
if (
  !process.env.PGDATABASE ||
  /prod/i.test(process.env.PGDATABASE) ||
  !["localhost", "127.0.0.1", "::1"].includes(process.env.PGHOST)
)
  throw new Error("Uji cuti hanya boleh memakai PostgreSQL development lokal.");
if (!vm.SourceTextModule) throw new Error("Jalankan dengan node --experimental-vm-modules.");
const schema = `leave_test_${randomUUID().replaceAll("-", "")}`;
const admin = new pg.Pool();
const pool = new pg.Pool({ options: `-c search_path=${schema}`, max: 4 });
const root = await mkdtemp(path.join(os.tmpdir(), "sitou-leave-test-"));
const previousRoot = process.env.UPLOAD_ROOT;
process.env.UPLOAD_ROOT = root;
const helpers = await import("../lib/api/routeHelpers.js");
const actor = { id: 1, organization_id: 1, role_code: "hrd" };
let failAudit = false;
let server;

/** Service asli dijalankan pada schema terisolasi; integrasi storage diganti adapter metadata uji. */
const transaction = async (operation) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
const guard = async (user, employeeId, organizationId, database = pool) => {
  if (
    Number(user.organization_id) !== Number(organizationId) ||
    user.role_code !== "hrd" ||
    Number(employeeId) === 99
  )
    throw new helpers.ServiceError("FORBIDDEN", "Akses pegawai ditolak.", 403);
  const row = await database.query("SELECT id FROM employees WHERE id=$1 AND organization_id=$2", [
    employeeId,
    organizationId,
  ]);
  if (!row.rowCount) throw new helpers.ServiceError("FORBIDDEN", "Akses pegawai ditolak.", 403);
};
const imports = {
  "@/lib/dbConfig": { default: pool },
  "@/lib/dbTransaction": { withTransaction: transaction },
  "@/lib/audit": {
    writeAudit: async (client, entry) => {
      if (failAudit) throw new Error("failure injection audit");
      await client.query(
        "INSERT INTO audit_logs(organization_id,action,entity_id) VALUES($1,$2,$3)",
        [entry.organizationId, entry.action, entry.entityId],
      );
    },
  },
  "@/lib/api/routeHelpers": helpers,
  "@/lib/auth/permissions": {
    ensureActorEmployeeAccess: guard,
    getActorLocationScope: async () => null,
  },
  "@/lib/files/storage": {
    commitPreparedEmployeeFiles: async (input, operation) =>
      transaction(async (client) => {
        const files = [];
        for (const upload of input.uploads) {
          assert.ok(upload.file.size <= rules.MAX_LEAVE_FILE_BYTES);
          const result = await client.query(
            "INSERT INTO stored_files(organization_id,employee_id,category,lifecycle_status) VALUES($1,$2,'leave_attachment','active') RETURNING id",
            [input.organizationId, input.employeeId],
          );
          files.push(result.rows[0]);
        }
        return operation(client, files);
      }),
  },
  "./requestRules.mjs": rules,
};
const context = vm.createContext({ console, Date, Number, String, Math, JSON });
const synthetic = (exports) =>
  new vm.SyntheticModule(
    Object.keys(exports),
    function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    },
    { context },
  );

try {
  assert.ok(/^leave_test_[a-f0-9]{32}$/.test(schema));
  await admin.query(`CREATE SCHEMA ${schema}`);
  await pool.query(`
    CREATE TABLE employees(id bigint PRIMARY KEY,organization_id bigint,employment_status text,joined_date date,deleted_at timestamptz);
    CREATE TABLE leave_types(id bigint PRIMARY KEY,organization_id bigint,unit text,requires_attachment boolean,required_attachment_category text,uses_balance boolean,annual_allowance int,is_active boolean);
    CREATE TABLE leave_entitlements(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,organization_id bigint,employee_id bigint,leave_type_id bigint,period_start date,period_end date,created_by_user_id bigint, UNIQUE(organization_id,employee_id,leave_type_id,period_start));
    CREATE TABLE leave_requests(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,organization_id bigint,request_no text,employee_id bigint,leave_type_id bigint,start_at timestamptz,end_at timestamptz,requested_units int,reason text,submission_source text,status text,submitted_at timestamptz,created_by_user_id bigint,cancelled_at timestamptz,cancelled_by_user_id bigint,cancellation_reason text,updated_at timestamptz DEFAULT clock_timestamp(), UNIQUE(organization_id,request_no));
    CREATE TABLE leave_balance_transactions(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,organization_id bigint,entitlement_id bigint REFERENCES leave_entitlements(id),leave_request_id bigint REFERENCES leave_requests(id),transaction_type text,units int,reason text,created_by_user_id bigint);
    CREATE UNIQUE INDEX uq_leave_balance_request_usage ON leave_balance_transactions(organization_id,leave_request_id,transaction_type) WHERE leave_request_id IS NOT NULL AND transaction_type IN ('usage','restoration');
    CREATE TABLE stored_files(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,organization_id bigint,employee_id bigint,category text,lifecycle_status text,deleted_at timestamptz);
    CREATE TABLE leave_request_attachments(organization_id bigint,leave_request_id bigint REFERENCES leave_requests(id),file_id bigint REFERENCES stored_files(id),attachment_category text);
    CREATE TABLE leave_decisions(organization_id bigint,leave_request_id bigint,decision text,decided_by_user_id bigint,decision_role text,notes text);
    CREATE TABLE audit_logs(organization_id bigint,action text,entity_id text);
    CREATE TABLE integration_outbox(organization_id bigint,event_type text,aggregate_type text,aggregate_id text,payload jsonb);
    INSERT INTO employees VALUES(1,1,'active','2021-02-01',NULL),(2,1,'active','2021-02-01',NULL),(3,2,'active','2021-02-01',NULL),(99,1,'active','2021-02-01',NULL);
    INSERT INTO leave_types VALUES(1,1,'day',false,NULL,true,12,true),(2,1,'day',false,NULL,false,NULL,true),(3,1,'day',true,'leave_attachment',true,12,true),(4,2,'day',false,NULL,true,12,true);
  `);
  const source = await readFile(new URL("../lib/leave/service.js", import.meta.url), "utf8");
  const serviceModule = new vm.SourceTextModule(source, { context });
  await serviceModule.link((name) => {
    assert.ok(imports[name], `Import belum dipetakan: ${name}`);
    return synthetic(imports[name]);
  });
  await serviceModule.evaluate();
  const { createLeaveRequest, cancelLeaveRequest } = serviceModule.namespace;
  const base = {
    organizationId: 1,
    employeeId: 1,
    leaveTypeId: 1,
    startDate: "2026-08-26",
    endDate: "2026-08-29",
    requestedUnits: 2,
    reason: "Urusan keluarga",
    decisionNotes: null,
    attachmentFileIds: [],
  };
  const save = (changes = {}, files = []) =>
    createLeaveRequest({ ...base, ...changes }, actor, randomUUID(), files);
  const snapshot = async () =>
    (
      await pool.query(`SELECT
    (SELECT count(*)::int FROM leave_requests) requests,
    (SELECT count(*)::int FROM stored_files) files,
    (SELECT count(*)::int FROM leave_balance_transactions) ledger,
    (SELECT count(*)::int FROM audit_logs) audit`)
    ).rows[0];
  const before = await snapshot();
  await assert.rejects(save({ startDate: "2021-01-31", endDate: "2021-01-31" }), {
    code: "LEAVE_BEFORE_JOINED",
  });
  assert.deepEqual(await snapshot(), before);
  const request = await save();
  assert.equal(
    Number(
      (await pool.query("SELECT sum(units) balance FROM leave_balance_transactions")).rows[0]
        .balance,
    ),
    10,
  );
  await assert.rejects(save(), { code: "LEAVE_PERIOD_OVERLAP" });
  await assert.rejects(save({ employeeId: 3, organizationId: 2, leaveTypeId: 4 }), {
    code: "FORBIDDEN",
  });
  await assert.rejects(save({ employeeId: 99 }), { code: "FORBIDDEN" });
  const stable = await snapshot();
  await assert.rejects(
    save({ startDate: "2026-09-01", endDate: "2026-09-01", requestedUnits: 11 }),
    { code: "LEAVE_BALANCE_INSUFFICIENT" },
  );
  await assert.rejects(save({ leaveTypeId: 3, startDate: "2026-09-01", endDate: "2026-09-01" }), {
    code: "LEAVE_ATTACHMENT_REQUIRED",
  });
  assert.deepEqual(await snapshot(), stable);
  failAudit = true;
  await assert.rejects(
    save({ startDate: "2026-09-01", endDate: "2026-09-01" }, [{ size: 10 }]),
    /failure injection audit/,
  );
  failAudit = false;
  assert.deepEqual(await snapshot(), stable);
  const version = (
    await pool.query("SELECT updated_at FROM leave_requests WHERE id=$1", [request.id])
  ).rows[0].updated_at.toISOString();
  await assert.rejects(
    cancelLeaveRequest(
      request.id,
      { organizationId: 1, version: "2000-01-01T00:00:00Z", reason: "Tanggal salah" },
      actor,
      randomUUID(),
    ),
    { code: "VERSION_CONFLICT" },
  );
  const cancelInput = { organizationId: 1, version, reason: "Tanggal pencatatan salah" };
  const cancellations = await Promise.allSettled([
    cancelLeaveRequest(request.id, cancelInput, actor, randomUUID()),
    cancelLeaveRequest(request.id, cancelInput, actor, randomUUID()),
  ]);
  assert.equal(cancellations.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(
    Number(
      (await pool.query("SELECT sum(units) balance FROM leave_balance_transactions")).rows[0]
        .balance,
    ),
    12,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int n FROM leave_balance_transactions WHERE transaction_type='restoration'",
      )
    ).rows[0].n,
    1,
  );
  const concurrent = await Promise.allSettled([
    save({ employeeId: 2, startDate: "2026-10-01", endDate: "2026-10-07", requestedUnits: 7 }),
    save({ employeeId: 2, startDate: "2026-11-01", endDate: "2026-11-07", requestedUnits: 7 }),
  ]);
  assert.equal(concurrent.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(
    concurrent.find((item) => item.status === "rejected").reason.code,
    "LEAVE_BALANCE_INSUFFICIENT",
  );
  await save({ leaveTypeId: 2, startDate: "2021-02-01", endDate: "2021-02-01", requestedUnits: 1 });
  assert.equal(
    (await pool.query("SELECT count(*)::int n FROM leave_entitlements WHERE leave_type_id=2"))
      .rows[0].n,
    0,
  );

  // Route asli, schema asli dan parser streaming asli diuji melalui HTTP lokal tanpa login produksi.
  const routeModule = new vm.SourceTextModule(
    await readFile(new URL("../app/api/leave-requests/route.js", import.meta.url), "utf8"),
    { context },
  );
  await routeModule.link((name) =>
    synthetic(
      {
        "@/lib/auth/permissions": {
          requirePermission: async () => ({ user: actor }),
          resolvePermissionOrganization: (user, id) => {
            if (Number(id) !== Number(user.organization_id))
              throw new helpers.ServiceError("FORBIDDEN", "Organisasi tidak sesuai.", 403);
            return id;
          },
        },
        "@/lib/api/routeHelpers": { ...helpers, validateMutationRequest: async () => null },
        "@/lib/leave/schemas": schemas,
        "@/lib/leave/service": serviceModule.namespace,
        "@/lib/leave/requestRules.mjs": rules,
      }[name],
    ),
  );
  await routeModule.evaluate();
  server = createServer(async (req, res) => {
    const response = await routeModule.namespace.POST(
      new Request(`http://127.0.0.1${req.url}`, {
        method: req.method,
        headers: req.headers,
        body: Readable.toWeb(req),
        duplex: "half",
      }),
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const post = async (changes, sizes = []) => {
    const body = new FormData();
    body.set("payload", JSON.stringify({ ...base, ...changes }));
    for (const size of sizes)
      body.append("files", new Blob([Buffer.alloc(size)], { type: "application/pdf" }), "test.pdf");
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/leave-requests`, {
      method: "POST",
      body,
    });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await post({}, [10, 10])).status, 413);
  const mixed = await post({ attachmentFileIds: [1] }, [10]);
  assert.equal(mixed.body.code, "LEAVE_ATTACHMENT_LIMIT");
  const invalid = await post({ startDate: "2021-01-31", endDate: "2021-01-31" }, [10]);
  assert.equal(invalid.body.code, "LEAVE_BEFORE_JOINED");
  assert.ok(invalid.body.fieldErrors.startDate);
  assert.equal((await post({ startDate: "2026-12-01", endDate: "2026-12-01" }, [10])).status, 201);
  assert.deepEqual(await readdir(path.join(root, ".tmp", "multipart")), []);
  console.log(
    "PASS service PostgreSQL: tanggal 2021/2026, jumlah HRD, saldo, rollback metadata, konkurensi, pembatalan tepat sekali, organisasi/scope; HTTP multipart: satu file, campuran ID/file, fieldErrors dan cleanup.",
  );
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
  if (/^leave_test_[a-f0-9]{32}$/.test(schema))
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
  if (previousRoot === undefined) delete process.env.UPLOAD_ROOT;
  else process.env.UPLOAD_ROOT = previousRoot;
  await rm(root, { recursive: true, force: true });
}
