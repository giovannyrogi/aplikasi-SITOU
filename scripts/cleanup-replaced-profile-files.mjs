import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import {
  inspectDeletedProfileFile,
  processStorageMaintenanceRunById,
} from "../lib/storage-maintenance/worker.mjs";
import {
  CLEANABLE_PROFILE_CATEGORIES,
  FILE_CLEANUP_RETENTION_DAYS,
} from "../lib/storage-maintenance/policy.mjs";

dotenv.config({
  path:
    process.env.ENV_FILE ||
    (process.env.NODE_ENV === "production" ? ".env.production" : ".env.development"),
  quiet: true,
});

const apply = process.argv.includes("--apply");
const readArgument = (name) => {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) || null;
};
const organizationId = readArgument("organization-id");
const actorUserId = readArgument("actor-user-id");
const positiveInteger = (value) => (/^[1-9][0-9]*$/.test(String(value)) ? String(value) : null);

if (!positiveInteger(organizationId))
  throw new Error("Gunakan --organization-id=ID untuk membatasi pemeriksaan ke satu organisasi.");
if (apply && !positiveInteger(actorUserId))
  throw new Error("Mode --apply memerlukan --actor-user-id=ID milik Superadmin aktif.");

const uploadRoot = path.resolve(process.env.UPLOAD_ROOT || path.join(process.cwd(), "uploads"));
const pool = new pg.Pool({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT || 5432),
  max: 2,
});

const summaryTemplate = () =>
  Object.fromEntries(
    CLEANABLE_PROFILE_CATEGORIES.map((category) => [
      category,
      { eligible: 0, needsReview: 0, bytes: 0 },
    ]),
  );

async function inspect() {
  const result = await pool.query(
    `SELECT id::text,organization_id::text,storage_provider,object_key,category,size_bytes,
      deleted_at,content_purged_at
     FROM stored_files
     WHERE organization_id=$1 AND deleted_at IS NOT NULL AND content_purged_at IS NULL
       AND category=ANY($2::varchar[])
       AND deleted_at<=now()-($3::text || ' days')::interval
     ORDER BY id`,
    [organizationId, CLEANABLE_PROFILE_CATEGORIES, FILE_CLEANUP_RETENTION_DAYS],
  );
  const summary = summaryTemplate();
  const eligibleIds = [];
  for (const file of result.rows) {
    const inspection = await inspectDeletedProfileFile(pool, uploadRoot, file);
    if (inspection.status === "eligible") {
      summary[file.category].eligible += 1;
      summary[file.category].bytes += Number(file.size_bytes || 0);
      eligibleIds.push(file.id);
    } else summary[file.category].needsReview += 1;
  }
  return { summary, eligibleIds };
}

async function ensureSuperadmin() {
  const result = await pool.query(
    `SELECT 1 FROM users user_account
     JOIN user_organization_roles membership ON membership.user_id=user_account.id
     JOIN roles role ON role.id=membership.role_id AND role.code='superadmin'
     JOIN role_permissions mapping ON mapping.role_id=role.id
     JOIN permissions permission ON permission.id=mapping.permission_id
       AND permission.code='storage_maintenance.manage'
     WHERE user_account.id=$1 AND user_account.is_active=true
       AND membership.organization_id IS NULL
       AND membership.active_from<=CURRENT_DATE
       AND (membership.active_until IS NULL OR membership.active_until>=CURRENT_DATE)
     LIMIT 1`,
    [actorUserId],
  );
  if (!result.rows[0]) throw new Error("Actor bukan Superadmin aktif yang berizin.");
}

async function enqueueAndRun(eligibleIds) {
  await ensureSuperadmin();
  const client = await pool.connect();
  let scanRunId;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [organizationId]);
    const active = await client.query(
      "SELECT 1 FROM file_cleanup_runs WHERE organization_id=$1 AND status IN ('queued','running') LIMIT 1",
      [organizationId],
    );
    if (active.rows[0]) throw new Error("Masih ada proses aktif untuk organisasi ini.");
    const inserted = await client.query(
      `INSERT INTO file_cleanup_runs(organization_id,run_type,status,requested_by_user_id)
       VALUES($1,'scan','queued',$2) RETURNING id::text`,
      [organizationId, actorUserId],
    );
    scanRunId = inserted.rows[0].id;
    await client.query(
      `INSERT INTO audit_logs(
        organization_id,actor_user_id,action,entity_type,entity_id,after_data)
       VALUES($1,$2,'storage_maintenance.scan_requested','file_cleanup_run',$3,$4::jsonb)`,
      [organizationId, actorUserId, scanRunId, JSON.stringify({ source: "emergency_cli" })],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  await processStorageMaintenanceRunById(pool, uploadRoot, scanRunId);
  const scanned = await pool.query(
    `SELECT id::text,stored_file_id::text,category,size_bytes
     FROM file_cleanup_items
     WHERE run_id=$1 AND status='eligible' AND stored_file_id=ANY($2::bigint[])
     ORDER BY id`,
    [scanRunId, eligibleIds],
  );
  if (!scanned.rowCount) return { scanRunId, cleanupRunId: null, selected: 0 };

  const cleanupClient = await pool.connect();
  let cleanupRunId;
  try {
    await cleanupClient.query("BEGIN");
    await cleanupClient.query("SELECT pg_advisory_xact_lock($1::bigint)", [organizationId]);
    const inserted = await cleanupClient.query(
      `INSERT INTO file_cleanup_runs(
        organization_id,run_type,source_scan_run_id,status,requested_by_user_id,
        total_items,selected_items,candidate_bytes)
       VALUES($1,'cleanup',$2,'queued',$3,$4,$4,$5) RETURNING id::text`,
      [
        organizationId,
        scanRunId,
        actorUserId,
        scanned.rowCount,
        scanned.rows.reduce((total, item) => total + Number(item.size_bytes || 0), 0),
      ],
    );
    cleanupRunId = inserted.rows[0].id;
    for (const item of scanned.rows)
      await cleanupClient.query(
        `INSERT INTO file_cleanup_items(
          organization_id,run_id,stored_file_id,item_kind,status,reason_code,category,size_bytes)
         VALUES($1,$2,$3,'candidate','queued','retention_expired_unreferenced',$4,$5)`,
        [organizationId, cleanupRunId, item.stored_file_id, item.category, item.size_bytes],
      );
    await cleanupClient.query(
      "UPDATE file_cleanup_items SET status='selected' WHERE run_id=$1 AND id=ANY($2::bigint[])",
      [scanRunId, scanned.rows.map((item) => item.id)],
    );
    await cleanupClient.query(
      `INSERT INTO audit_logs(
        organization_id,actor_user_id,action,entity_type,entity_id,after_data)
       VALUES($1,$2,'storage_maintenance.cleanup_requested','file_cleanup_run',$3,$4::jsonb)`,
      [
        organizationId,
        actorUserId,
        cleanupRunId,
        JSON.stringify({ source: "emergency_cli", selectedItems: scanned.rowCount }),
      ],
    );
    await cleanupClient.query("COMMIT");
  } catch (error) {
    await cleanupClient.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    cleanupClient.release();
  }
  await processStorageMaintenanceRunById(pool, uploadRoot, cleanupRunId);
  return { scanRunId, cleanupRunId, selected: scanned.rowCount };
}

try {
  const inspected = await inspect();
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...inspected.summary }, null, 2));
  if (apply) {
    const result = await enqueueAndRun(inspected.eligibleIds);
    console.log(JSON.stringify({ queuedAndProcessed: result.selected }, null, 2));
  }
} finally {
  await pool.end();
}
