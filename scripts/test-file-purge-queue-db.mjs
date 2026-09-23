import { randomUUID } from "node:crypto";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import pg from "pg";
import { processNextFilePurgeJob } from "../lib/storage-maintenance/worker.mjs";

dotenv.config({ path: process.env.ENV_FILE || ".env.development", quiet: true });
const pool = new pg.Pool();
const uploadRoot = path.resolve(process.env.UPLOAD_ROOT || path.join(process.cwd(), "uploads"));
const ids = [];
const paths = [];
const exists = async (target) => access(target).then(() => true, () => false);

try {
  const context = await pool.query(
    "SELECT organization.id::text AS organization_id,user_account.id::text AS actor_user_id FROM organizations organization CROSS JOIN LATERAL (SELECT user_account.id FROM users user_account JOIN user_organization_roles membership ON membership.user_id=user_account.id JOIN roles role ON role.id=membership.role_id AND role.code='superadmin' WHERE user_account.is_active=true AND membership.organization_id IS NULL ORDER BY membership.id LIMIT 1) user_account ORDER BY organization.id LIMIT 1",
  );
  if (!context.rows[0]) throw new Error("Organisasi dan Superadmin diperlukan.");
  const { organization_id: organizationId, actor_user_id: actorId } = context.rows[0];

  const createDeleted = async (asDirectory = false) => {
    const objectKey = "org_" + organizationId + "/pegawai/employee_0/dokumen_lain/2026/" + randomUUID() + ".bin";
    const absolute = path.resolve(uploadRoot, ...objectKey.split("/"));
    await mkdir(path.dirname(absolute), { recursive: true });
    if (asDirectory) await mkdir(absolute); else await writeFile(absolute, "purge-test");
    paths.push(absolute);
    const file = await pool.query(
      "INSERT INTO stored_files(organization_id,storage_provider,object_key,original_name,mime_type,size_bytes,sha256,category,is_confidential,uploaded_by_user_id,lifecycle_status,deleted_at,deleted_by_user_id,deletion_reason_code) VALUES($1,'local_private',$2,'purge-test.bin','application/octet-stream',10,$3,'other',true,$4,'deleted',now(),$4,'removed_by_user') RETURNING id::text",
      [organizationId, objectKey, "b".repeat(64), actorId],
    );
    ids.push(file.rows[0].id);
    const job = await pool.query(
      "INSERT INTO file_purge_jobs(organization_id,stored_file_id,object_key) VALUES($1,$2,$3) RETURNING id::text",
      [organizationId, file.rows[0].id, objectKey],
    );
    return { fileId: file.rows[0].id, jobId: job.rows[0].id, absolute };
  };

  const normal = await createDeleted();
  const claims = await Promise.all([
    processNextFilePurgeJob(pool, uploadRoot),
    processNextFilePurgeJob(pool, uploadRoot),
  ]);
  assert.equal(claims.filter(Boolean).length, 1);
  assert.equal(await exists(normal.absolute), false);
  const completed = await pool.query(
    "SELECT file.lifecycle_status,job.status FROM stored_files file JOIN file_purge_jobs job ON job.stored_file_id=file.id WHERE file.id=$1",
    [normal.fileId],
  );
  assert.deepEqual(completed.rows[0], { lifecycle_status: "purged", status: "completed" });

  const retry = await createDeleted(true);
  await processNextFilePurgeJob(pool, uploadRoot);
  const failedAttempt = await pool.query("SELECT status,attempts FROM file_purge_jobs WHERE id=$1", [retry.jobId]);
  assert.equal(failedAttempt.rows[0].status, "retry");
  assert.equal(Number(failedAttempt.rows[0].attempts), 1);
  const stillDeleted = await pool.query("SELECT lifecycle_status FROM stored_files WHERE id=$1", [retry.fileId]);
  assert.equal(stillDeleted.rows[0].lifecycle_status, "deleted");

  console.log(JSON.stringify({ ready: true, concurrentClaimProtected: true, purgeCompleted: true, failureRetried: true }));
} finally {
  await Promise.all(paths.map((target) => rm(target, { recursive: true, force: true })));
  if (ids.length) await pool.query("DELETE FROM file_purge_jobs WHERE stored_file_id=ANY($1::bigint[])", [ids]);
  if (ids.length) await pool.query("DELETE FROM stored_files WHERE id=ANY($1::bigint[])", [ids]);
  await pool.end();
}
