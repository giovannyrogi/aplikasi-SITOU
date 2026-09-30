import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, utimes, access, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import {
  processStorageMaintenanceRunById,
  processNextQuarantinePurge,
} from "../lib/storage-maintenance/worker.mjs";

// A disposable database and upload root keep production-like worker tests isolated.
dotenv.config({ path: ".env.development", quiet: true });
const name = "sitou_cleanup_test_" + randomUUID().replaceAll("-", "").slice(0, 16);
const config = {
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
};
const admin = new pg.Client({ ...config, database: "postgres" });
const root = await mkdtemp(path.join(os.tmpdir(), "sitou-cleanup-test-"));
let pool;
let created = false;
const bytes = Buffer.from("synthetic cleanup fixture");
const hash = createHash("sha256").update(bytes).digest("hex");
const present = async (file) =>
  access(file)
    .then(() => true)
    .catch((e) => {
      if (e.code === "ENOENT") return false;
      throw e;
    });
try {
  await admin.connect();
  await admin.query('CREATE DATABASE "' + name + '"');
  created = true;
  pool = new pg.Pool({ ...config, database: name, max: 4 });
  await pool.query(await readFile(new URL("../sitou_schema_v3.sql", import.meta.url), "utf8"));
  const actor = (
    await pool.query(
      "INSERT INTO users(username,password_hash) VALUES('cleanup-test','synthetic-not-a-login') RETURNING id",
    )
  ).rows[0].id;
  const org = (
    await pool.query(
      "INSERT INTO organizations(code,name) VALUES('CLEANUP_A','Organisasi uji A') RETURNING id",
    )
  ).rows[0].id;
  const otherOrg = (
    await pool.query(
      "INSERT INTO organizations(code,name) VALUES('CLEANUP_B','Organisasi uji B') RETURNING id",
    )
  ).rows[0].id;
  async function file(
    category,
    { missing = false, organizationId = org, scan = "legacy_unscanned" } = {},
  ) {
    const key = "org_" + organizationId + "/pegawai/" + randomUUID() + ".txt";
    const absolute = path.join(root, ...key.split("/"));
    await mkdir(path.dirname(absolute), { recursive: true });
    if (!missing) await writeFile(absolute, bytes);
    const id = (
      await pool.query(
        "INSERT INTO stored_files(organization_id,storage_provider,object_key,original_name,mime_type,size_bytes,sha256,category,uploaded_by_user_id,created_at,malware_scan_status) VALUES($1,'local_private',$2,'fixture.txt','text/plain',$3,$4,$5,$6,now()-interval '2 days',$7) RETURNING id",
        [organizationId, key, bytes.length, hash, category, actor, scan],
      )
    ).rows[0].id;
    return { id, key, absolute };
  }
  const official = await file("contract");
  const missing = await file("identity", { missing: true });
  const referenced = await file("logo");
  const raced = await file("education");
  const foreign = await file("identity", { organizationId: otherOrg });
  await pool.query(
    "INSERT INTO organization_branding(organization_id,logo_file_id) VALUES($1,$2)",
    [org, referenced.id],
  );
  const orphanKey = "org_" + org + "/orphan.txt";
  const orphan = path.join(root, orphanKey);
  await writeFile(orphan, bytes);
  const old = new Date(Date.now() - 2 * 86400000);
  await utimes(orphan, old, old);
  const fresh = path.join(root, "org_" + org, "fresh.tmp");
  await writeFile(fresh, bytes);
  const scanId = (
    await pool.query(
      "INSERT INTO file_cleanup_runs(organization_id,run_type,requested_by_user_id) VALUES($1,'scan',$2) RETURNING id",
      [org, actor],
    )
  ).rows[0].id;
  await processStorageMaintenanceRunById(pool, root, scanId);
  const scanRun = (await pool.query("SELECT status FROM file_cleanup_runs WHERE id=$1", [scanId]))
    .rows[0];
  assert.equal(scanRun.status, "completed");
  const items = (await pool.query("SELECT * FROM file_cleanup_items WHERE run_id=$1", [scanId]))
    .rows;
  for (const candidate of [official, missing, raced])
    assert.equal(items.find((i) => i.stored_file_id === candidate.id)?.status, "eligible");
  assert.equal(
    items.some((i) => i.stored_file_id === referenced.id),
    false,
  );
  assert.equal(
    items.some((i) => i.stored_file_id === foreign.id),
    false,
  );
  assert.equal(items.find((i) => i.object_key === orphanKey)?.status, "eligible");
  assert.equal(
    items.some((i) => i.object_key?.endsWith("fresh.tmp")),
    false,
  );
  // A newly created reference after the scan must prevent deletion.
  await pool.query("UPDATE organization_branding SET logo_file_id=$2 WHERE organization_id=$1", [
    org,
    raced.id,
  ]);
  const cleanup = (
    await pool.query(
      "INSERT INTO file_cleanup_runs(organization_id,run_type,source_scan_run_id,requested_by_user_id) VALUES($1,'cleanup',$2,$3) RETURNING id",
      [org, scanId, actor],
    )
  ).rows[0].id;
  await pool.query(
    "INSERT INTO file_cleanup_items(organization_id,run_id,stored_file_id,object_key,item_kind,status,reason_code,category,size_bytes,file_modified_at) SELECT organization_id,$2,stored_file_id,object_key,item_kind,'queued',reason_code,category,size_bytes,file_modified_at FROM file_cleanup_items WHERE run_id=$1 AND status='eligible'",
    [scanId, cleanup],
  );
  await processStorageMaintenanceRunById(pool, root, cleanup);
  const results = (
    await pool.query(
      "SELECT stored_file_id,object_key,status FROM file_cleanup_items WHERE run_id=$1",
      [cleanup],
    )
  ).rows;
  assert.equal(results.find((i) => i.stored_file_id === official.id).status, "cleaned");
  assert.equal(results.find((i) => i.stored_file_id === missing.id).status, "cleaned");
  assert.equal(results.find((i) => i.stored_file_id === raced.id).status, "skipped");
  assert.equal(results.find((i) => i.object_key === orphanKey).status, "cleaned");
  assert.equal(await present(official.absolute), false);
  assert.equal(await present(orphan), false);
  for (const retained of [raced.absolute, referenced.absolute, foreign.absolute, fresh])
    assert.equal(await present(retained), true);
  // Retrying a completed run is idempotent.
  assert.equal(await processStorageMaintenanceRunById(pool, root, cleanup), false);
  // Expired quarantine is purged exactly once; hash changes stay available for investigation.
  async function quarantineFixture(contentHash) {
    const key = `.trash/storage-maintenance/security/org_${org}/${randomUUID()}.txt`;
    const absolute = path.join(root, ...key.split("/"));
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes);
    const id = (
      await pool.query(
        `INSERT INTO file_quarantine_items(organization_id,reason,status,original_object_key,quarantine_object_key,original_name,mime_type,size_bytes,sha256,malware_scan_status,quarantined_by_user_id,purge_after)
       VALUES($1,'malware','quarantined',$2,$3,'fixture.txt','text/plain',$4,$5,'infected',$6,now()-interval '1 day') RETURNING id`,
        [org, `org_${org}/old.txt`, key, bytes.length, contentHash, actor],
      )
    ).rows[0].id;
    return { id, absolute };
  }
  const expired = await quarantineFixture(hash);
  assert.equal(await processNextQuarantinePurge(pool, root), true);
  assert.equal(await present(expired.absolute), false);
  assert.equal(
    (await pool.query("SELECT status FROM file_quarantine_items WHERE id=$1", [expired.id])).rows[0]
      .status,
    "purged",
  );
  assert.equal(await processNextQuarantinePurge(pool, root), false);
  const changed = await quarantineFixture("0".repeat(64));
  assert.equal(await processNextQuarantinePurge(pool, root), true);
  assert.equal(await present(changed.absolute), true);
  assert.equal(
    (await pool.query("SELECT attempts FROM file_quarantine_items WHERE id=$1", [changed.id]))
      .rows[0].attempts,
    1,
  );
  console.log("PASS: expired quarantine, idempotent purge, changed content retained for retry.");
  console.log(
    "PASS: bootstrap, unused official file, orphan, missing content, fresh upload, live reference race, organization isolation, retry.",
  );
} finally {
  await pool?.end();
  if (created) await admin.query('DROP DATABASE "' + name + '"');
  await admin.end();
  if (
    path.dirname(root) === path.resolve(os.tmpdir()) &&
    path.basename(root).startsWith("sitou-cleanup-test-")
  )
    await rm(root, { recursive: true, force: true });
}
