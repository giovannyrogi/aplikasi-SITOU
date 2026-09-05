import { randomUUID } from "node:crypto";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import pg from "pg";
import { processNextStorageMaintenanceRun } from "../lib/storage-maintenance/worker.mjs";

dotenv.config({ path: process.env.ENV_FILE || ".env.development", quiet: true });

const uploadRoot = path.resolve(process.env.UPLOAD_ROOT || path.join(process.cwd(), "uploads"));
const pool = new pg.Pool({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT || 5432),
  max: 4,
});
const runIds = [];
const fileIds = [];
const physicalPaths = [];

const fileExists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
};

try {
  const context = await pool.query(
    `SELECT organization.id::text AS organization_id,user_account.id::text AS actor_user_id
     FROM organizations organization
     CROSS JOIN LATERAL (
       SELECT user_account.id
       FROM users user_account
       JOIN user_organization_roles membership ON membership.user_id=user_account.id
       JOIN roles role ON role.id=membership.role_id AND role.code='superadmin'
       WHERE user_account.is_active=true AND membership.organization_id IS NULL
       ORDER BY membership.id LIMIT 1
     ) user_account
     ORDER BY organization.id LIMIT 1`,
  );
  if (!context.rows[0]) throw new Error("Organisasi dan Superadmin diperlukan untuk test DB.");
  const { organization_id: organizationId, actor_user_id: actorUserId } = context.rows[0];
  const marker = randomUUID();

  const createFile = async ({ category, deleted }) => {
    const objectKey = `org_${organizationId}/pegawai/employee_0/dokumen_lain/2026/${randomUUID()}.webp`;
    const absolutePath = path.resolve(uploadRoot, ...objectKey.split("/"));
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, Buffer.from("synthetic-storage-maintenance-test"));
    physicalPaths.push(absolutePath);
    const inserted = await pool.query(
      `INSERT INTO stored_files(
        organization_id,storage_provider,object_key,original_name,mime_type,size_bytes,sha256,
        category,is_confidential,uploaded_by_user_id,deleted_at,deleted_by_user_id,deletion_reason_code)
       VALUES($1,'local_private',$2,$3,'image/webp',34,$4,$5,true,$6::bigint,
         CASE WHEN $7::boolean THEN now()-interval '8 days' ELSE NULL END,
         CASE WHEN $7::boolean THEN $6::bigint ELSE NULL END,
         CASE WHEN $7::boolean THEN 'profile_removed' ELSE NULL END)
       RETURNING id::text`,
      [
        organizationId,
        objectKey,
        `maintenance-test-${marker}.webp`,
        "a".repeat(64),
        category,
        actorUserId,
        deleted,
      ],
    );
    fileIds.push(inserted.rows[0].id);
    return { id: inserted.rows[0].id, absolutePath };
  };

  const candidate = await createFile({ category: "employee_photo", deleted: true });
  const changedAfterScan = await createFile({ category: "identity", deleted: true });
  const active = await createFile({ category: "employee_photo", deleted: false });
  const official = await createFile({ category: "contract", deleted: true });
  const scan = await pool.query(
    `INSERT INTO file_cleanup_runs(organization_id,run_type,status,requested_by_user_id)
     VALUES($1,'scan','queued',$2) RETURNING id::text`,
    [organizationId, actorUserId],
  );
  runIds.push(scan.rows[0].id);

  const workerResults = await Promise.all([
    processNextStorageMaintenanceRun(pool, uploadRoot),
    processNextStorageMaintenanceRun(pool, uploadRoot),
  ]);
  assert.equal(
    workerResults.filter(Boolean).length,
    1,
    "Dua worker tidak boleh mengambil job sama.",
  );
  const inspected = await pool.query(
    "SELECT stored_file_id::text,status FROM file_cleanup_items WHERE run_id=$1",
    [scan.rows[0].id],
  );
  assert.equal(
    inspected.rows.find((item) => item.stored_file_id === candidate.id)?.status,
    "eligible",
  );
  assert.equal(
    inspected.rows.find((item) => item.stored_file_id === changedAfterScan.id)?.status,
    "eligible",
  );
  assert.equal(
    inspected.rows.some((item) => item.stored_file_id === active.id),
    false,
  );
  assert.equal(
    inspected.rows.some((item) => item.stored_file_id === official.id),
    false,
  );

  const cleanup = await pool.query(
    `INSERT INTO file_cleanup_runs(
      organization_id,run_type,source_scan_run_id,status,requested_by_user_id,
      total_items,selected_items,candidate_bytes)
     VALUES($1,'cleanup',$2,'queued',$3,2,2,68) RETURNING id::text`,
    [organizationId, scan.rows[0].id, actorUserId],
  );
  runIds.push(cleanup.rows[0].id);
  for (const file of [
    { ...candidate, category: "employee_photo" },
    { ...changedAfterScan, category: "identity" },
  ])
    await pool.query(
      `INSERT INTO file_cleanup_items(
        organization_id,run_id,stored_file_id,item_kind,status,reason_code,category,size_bytes)
       VALUES($1,$2,$3,'candidate','queued','retention_expired_unreferenced',$4,34)`,
      [organizationId, cleanup.rows[0].id, file.id, file.category],
    );
  await pool.query("UPDATE stored_files SET deleted_at=NULL WHERE id=$1", [changedAfterScan.id]);
  await processNextStorageMaintenanceRun(pool, uploadRoot);

  const result = await pool.query(
    `SELECT file.id::text,file.content_purged_at,item.status
     FROM stored_files file
     LEFT JOIN file_cleanup_items item ON item.stored_file_id=file.id AND item.run_id=$2
     WHERE file.id=ANY($1::bigint[]) ORDER BY file.id`,
    [fileIds, cleanup.rows[0].id],
  );
  assert.ok(result.rows.find((item) => item.id === candidate.id)?.content_purged_at);
  assert.equal(result.rows.find((item) => item.id === candidate.id)?.status, "cleaned");
  assert.equal(
    result.rows.find((item) => item.id === changedAfterScan.id)?.content_purged_at,
    null,
  );
  assert.equal(result.rows.find((item) => item.id === changedAfterScan.id)?.status, "skipped");
  assert.equal(await fileExists(candidate.absolutePath), false);
  assert.equal(await fileExists(changedAfterScan.absolutePath), true);
  assert.equal(await fileExists(active.absolutePath), true);
  assert.equal(await fileExists(official.absolutePath), true);

  console.log(
    JSON.stringify(
      {
        ready: true,
        concurrentClaimProtected: true,
        activeFilePreserved: true,
        officialDocumentExcluded: true,
        changedFileSkipped: true,
        eligibleProfileFilePurged: true,
      },
      null,
      2,
    ),
  );
} finally {
  for (const filePath of physicalPaths) await unlink(filePath).catch(() => {});
  if (runIds.length)
    await pool.query("DELETE FROM file_cleanup_runs WHERE id=ANY($1::bigint[])", [runIds]);
  if (fileIds.length) {
    await pool.query(
      `DELETE FROM audit_logs
       WHERE (entity_type='stored_file' AND entity_id=ANY($1::text[]))
          OR (entity_type='file_cleanup_run' AND entity_id=ANY($2::text[]))`,
      [fileIds, runIds],
    );
    await pool.query("DELETE FROM stored_files WHERE id=ANY($1::bigint[])", [fileIds]);
  }
  await pool.end();
}
