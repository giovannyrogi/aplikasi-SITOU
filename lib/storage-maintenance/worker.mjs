import { access, mkdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import {
  CLEANABLE_PROFILE_CATEGORIES,
  FILE_CLEANUP_MAX_ATTEMPTS,
  FILE_CLEANUP_RETENTION_DAYS,
  STORED_FILE_REFERENCES,
} from "./policy.mjs";

const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export function resolveMaintenancePath(uploadRoot, file) {
  const root = path.resolve(uploadRoot);
  const expectedPrefix = `org_${file.organization_id}/`;
  if (!String(file.object_key || "").startsWith(expectedPrefix))
    return { valid: false, reasonCode: "organization_mismatch" };
  const absolutePath = path.resolve(root, ...String(file.object_key).split("/"));
  if (!absolutePath.startsWith(`${root}${path.sep}`))
    return { valid: false, reasonCode: "invalid_storage_path" };
  return { valid: true, absolutePath };
}

export async function findStoredFileReferences(database, organizationId, fileId) {
  const references = [];
  for (const reference of STORED_FILE_REFERENCES) {
    const result = await database.query(
      `SELECT 1 FROM ${reference.table}
       WHERE organization_id=$1 AND ${reference.column}=$2 LIMIT 1`,
      [organizationId, fileId],
    );
    if (result.rows[0]) references.push(reference.label);
  }
  return references;
}

async function hasActiveObjectKey(database, file) {
  const result = await database.query(
    `SELECT 1 FROM stored_files
     WHERE storage_provider=$1 AND object_key=$2 AND deleted_at IS NULL AND id<>$3 LIMIT 1`,
    [file.storage_provider, file.object_key, file.id],
  );
  return Boolean(result.rows[0]);
}

export function olderThanRetention(deletedAt, now = new Date()) {
  if (!deletedAt) return false;
  return now.getTime() - new Date(deletedAt).getTime() >= FILE_CLEANUP_RETENTION_DAYS * 86_400_000;
}

export async function inspectDeletedProfileFile(database, uploadRoot, file) {
  if (!CLEANABLE_PROFILE_CATEGORIES.includes(file.category))
    return { status: "needs_review", itemKind: "issue", reasonCode: "category_not_allowed" };
  if (!file.deleted_at)
    return { status: "needs_review", itemKind: "issue", reasonCode: "active_metadata" };
  if (!olderThanRetention(file.deleted_at))
    return { status: "needs_review", itemKind: "issue", reasonCode: "retention_not_met" };
  if (file.storage_provider !== "local_private")
    return { status: "needs_review", itemKind: "issue", reasonCode: "unsupported_provider" };
  const resolved = resolveMaintenancePath(uploadRoot, file);
  if (!resolved.valid)
    return { status: "needs_review", itemKind: "issue", reasonCode: resolved.reasonCode };
  if (await hasActiveObjectKey(database, file))
    return { status: "needs_review", itemKind: "issue", reasonCode: "active_object_key" };
  const references = await findStoredFileReferences(database, file.organization_id, file.id);
  if (references.length)
    return {
      status: "needs_review",
      itemKind: "issue",
      reasonCode: "still_referenced",
      references,
    };
  if (!(await exists(resolved.absolutePath)))
    return {
      status: "already_absent",
      itemKind: "candidate",
      reasonCode: "content_already_absent",
    };
  return {
    status: "eligible",
    itemKind: "candidate",
    reasonCode: "retention_expired_unreferenced",
  };
}

async function writeAudit(database, values) {
  await database.query(
    `INSERT INTO audit_logs(
      organization_id,actor_user_id,action,entity_type,entity_id,after_data,request_id)
     VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::uuid)`,
    [
      values.organizationId,
      values.actorUserId,
      values.action,
      values.entityType,
      String(values.entityId),
      JSON.stringify(values.afterData || {}),
      values.requestId || null,
    ],
  );
}

async function withTransaction(pool, callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const value = await callback(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function recoverStaleStorageMaintenanceRuns(pool) {
  await pool.query(
    `UPDATE file_cleanup_runs
     SET status=CASE WHEN attempts>=$1 THEN 'failed' ELSE 'queued' END,
       next_attempt_at=now(),last_error_code='WORKER_INTERRUPTED',
       completed_at=CASE WHEN attempts>=$1 THEN now() ELSE NULL END
     WHERE status='running' AND updated_at<now()-interval '5 minutes'`,
    [FILE_CLEANUP_MAX_ATTEMPTS],
  );
}

async function claimNextRun(pool) {
  return withTransaction(pool, async (client) => {
    const result = await client.query(
      `WITH next_run AS (
         SELECT id FROM file_cleanup_runs
         WHERE status='queued' AND next_attempt_at<=now()
         ORDER BY next_attempt_at,id
         FOR UPDATE SKIP LOCKED LIMIT 1
       )
       UPDATE file_cleanup_runs run
       SET status='running',started_at=COALESCE(started_at,now()),attempts=attempts+1,
         last_error_code=NULL
       FROM next_run WHERE run.id=next_run.id RETURNING run.*`,
    );
    return result.rows[0] || null;
  });
}

async function claimRunById(pool, runId) {
  return withTransaction(pool, async (client) => {
    const result = await client.query(
      `WITH requested_run AS (
         SELECT id FROM file_cleanup_runs
         WHERE id=$1 AND status='queued' AND next_attempt_at<=now()
         FOR UPDATE SKIP LOCKED
       )
       UPDATE file_cleanup_runs run
       SET status='running',started_at=COALESCE(started_at,now()),attempts=attempts+1,
         last_error_code=NULL
       FROM requested_run WHERE run.id=requested_run.id RETURNING run.*`,
      [runId],
    );
    return result.rows[0] || null;
  });
}

async function performScan(pool, uploadRoot, run) {
  const files = await pool.query(
    `SELECT file.id::text,file.organization_id::text,file.employee_id::text,
      file.storage_provider,file.object_key,file.category,file.size_bytes,file.deleted_at,
      file.content_purged_at
     FROM stored_files file
     WHERE file.organization_id=$1 AND file.content_purged_at IS NULL
       AND ((file.deleted_at IS NOT NULL AND file.category=ANY($2::varchar[]))
         OR (file.deleted_at IS NULL AND file.storage_provider='local_private'))
     ORDER BY file.id`,
    [run.organization_id, CLEANABLE_PROFILE_CATEGORIES],
  );
  const inspectedItems = [];
  const alreadyAbsentIds = [];

  for (const file of files.rows) {
    if (file.deleted_at) {
      if (!olderThanRetention(file.deleted_at)) continue;
      const inspection = await inspectDeletedProfileFile(pool, uploadRoot, file);
      inspectedItems.push({ file, ...inspection });
      if (inspection.status === "already_absent") alreadyAbsentIds.push(file.id);
      continue;
    }
    const resolved = resolveMaintenancePath(uploadRoot, file);
    if (!resolved.valid) {
      inspectedItems.push({
        file,
        status: "needs_review",
        itemKind: "issue",
        reasonCode: resolved.reasonCode,
      });
    } else if (!(await exists(resolved.absolutePath))) {
      inspectedItems.push({
        file,
        status: "needs_review",
        itemKind: "issue",
        reasonCode: "active_content_missing",
      });
    }
  }

  await withTransaction(pool, async (client) => {
    await client.query("DELETE FROM file_cleanup_items WHERE run_id=$1", [run.id]);
    for (const item of inspectedItems)
      await client.query(
        `INSERT INTO file_cleanup_items(
          organization_id,run_id,stored_file_id,item_kind,status,reason_code,
          reference_labels,category,size_bytes)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          run.organization_id,
          run.id,
          item.file.id,
          item.itemKind,
          item.status,
          item.reasonCode,
          item.references || [],
          item.file.category,
          item.file.size_bytes,
        ],
      );
    if (alreadyAbsentIds.length)
      await client.query(
        `UPDATE stored_files SET content_purged_at=COALESCE(content_purged_at,now())
         WHERE organization_id=$1 AND id=ANY($2::bigint[]) AND deleted_at IS NOT NULL`,
        [run.organization_id, alreadyAbsentIds],
      );
    const candidates = inspectedItems.filter((item) => item.status === "eligible");
    const issues = inspectedItems.filter((item) => item.itemKind === "issue");
    await client.query(
      `UPDATE file_cleanup_runs SET status='completed',total_items=$2,candidate_items=$3,
        issue_items=$4,candidate_bytes=$5,completed_at=now(),last_error_code=NULL
       WHERE id=$1`,
      [
        run.id,
        inspectedItems.length,
        candidates.length,
        issues.length,
        candidates.reduce((total, item) => total + Number(item.file.size_bytes || 0), 0),
      ],
    );
    await writeAudit(client, {
      organizationId: run.organization_id,
      actorUserId: run.requested_by_user_id,
      action: "storage_maintenance.scan_completed",
      entityType: "file_cleanup_run",
      entityId: run.id,
      afterData: { candidates: candidates.length, issues: issues.length },
    });
  });
}

function quarantinePaths(uploadRoot, runId, itemId, file) {
  const original = resolveMaintenancePath(uploadRoot, file);
  if (!original.valid) return { ...original };
  const relative = path.posix.join(
    ".trash",
    "storage-maintenance",
    `run_${runId}`,
    `item_${itemId}${path.extname(original.absolutePath).slice(0, 12)}`,
  );
  return {
    valid: true,
    originalPath: original.absolutePath,
    quarantinePath: path.resolve(uploadRoot, ...relative.split("/")),
    quarantineKey: relative,
  };
}

async function markCleanupItem(pool, itemId, values) {
  await pool.query(
    `UPDATE file_cleanup_items SET status=$2,reason_code=$3,
      last_error_code=$4,attempts=attempts+$5,next_attempt_at=COALESCE($6,now())
     WHERE id=$1`,
    [
      itemId,
      values.status,
      values.reasonCode,
      values.errorCode || null,
      values.incrementAttempts ? 1 : 0,
      values.nextAttemptAt || null,
    ],
  );
}

async function processCleanupItem(pool, uploadRoot, run, item) {
  const fileResult = await pool.query(
    `SELECT id::text,organization_id::text,storage_provider,object_key,category,size_bytes,
      deleted_at,content_purged_at
     FROM stored_files WHERE id=$1 AND organization_id=$2`,
    [item.stored_file_id, run.organization_id],
  );
  const file = fileResult.rows[0];
  if (!file) {
    await markCleanupItem(pool, item.id, {
      status: "skipped",
      reasonCode: "changed_after_scan",
      errorCode: "FILE_NOT_FOUND",
    });
    return;
  }
  const paths = quarantinePaths(uploadRoot, run.id, item.id, file);
  if (!paths.valid) {
    await markCleanupItem(pool, item.id, {
      status: "skipped",
      reasonCode: paths.reasonCode,
    });
    return;
  }

  let moved = false;
  let metadataCommitted = false;
  try {
    const state = await withTransaction(pool, async (client) => {
      const locked = await client.query(
        `SELECT id::text,organization_id::text,storage_provider,object_key,category,size_bytes,
          deleted_at,content_purged_at
         FROM stored_files WHERE id=$1 AND organization_id=$2 FOR UPDATE`,
        [file.id, run.organization_id],
      );
      const current = locked.rows[0];
      const inspection = current
        ? await inspectDeletedProfileFile(client, uploadRoot, current)
        : { status: "needs_review", reasonCode: "changed_after_scan", references: [] };
      if (!current || !["eligible", "already_absent"].includes(inspection.status)) {
        await client.query(
          `UPDATE file_cleanup_items SET status='skipped',reason_code=$2,
            reference_labels=$3,last_error_code=NULL WHERE id=$1`,
          [item.id, inspection.reasonCode || "changed_after_scan", inspection.references || []],
        );
        return { skipped: true };
      }

      await mkdir(path.dirname(paths.quarantinePath), { recursive: true });
      const originalExists = await exists(paths.originalPath);
      const quarantineExists = await exists(paths.quarantinePath);
      if (originalExists && !quarantineExists) {
        await rename(paths.originalPath, paths.quarantinePath);
        moved = true;
      } else if (originalExists && quarantineExists) {
        await client.query(
          `UPDATE file_cleanup_items SET status='skipped',reason_code='changed_after_scan',
            last_error_code='DUPLICATE_STORAGE_CONTENT' WHERE id=$1`,
          [item.id],
        );
        return { skipped: true };
      }

      await client.query(
        `UPDATE stored_files SET content_purged_at=COALESCE(content_purged_at,now())
         WHERE id=$1 AND organization_id=$2`,
        [file.id, run.organization_id],
      );
      await client.query(
        `UPDATE file_cleanup_items SET status='pending_retry',reason_code=$2,
          quarantine_key=$3,last_error_code=NULL WHERE id=$1`,
        [
          item.id,
          originalExists || quarantineExists
            ? "retention_expired_unreferenced"
            : "content_already_absent",
          paths.quarantineKey,
        ],
      );
      await writeAudit(client, {
        organizationId: run.organization_id,
        actorUserId: run.requested_by_user_id,
        action: "private_file.content_purged",
        entityType: "stored_file",
        entityId: file.id,
        afterData: { category: file.category, cleanupRunId: String(run.id) },
      });
      return { skipped: false, alreadyAbsent: !originalExists && !quarantineExists };
    });
    metadataCommitted = true;
    if (state.skipped) {
      if (moved) await rename(paths.quarantinePath, paths.originalPath).catch(() => {});
      return;
    }
    if (await exists(paths.quarantinePath)) await unlink(paths.quarantinePath);
    await markCleanupItem(pool, item.id, {
      status: state.alreadyAbsent ? "already_absent" : "cleaned",
      reasonCode: state.alreadyAbsent ? "content_already_absent" : "cleanup_completed",
    });
  } catch (error) {
    if (moved && !metadataCommitted)
      await rename(paths.quarantinePath, paths.originalPath).catch(() => {});
    const nextAttempts = Number(item.attempts || 0) + 1;
    await markCleanupItem(pool, item.id, {
      status: nextAttempts >= FILE_CLEANUP_MAX_ATTEMPTS ? "failed" : "pending_retry",
      reasonCode: "cleanup_failed",
      errorCode: "STORAGE_OPERATION_FAILED",
      incrementAttempts: true,
      nextAttemptAt: new Date(Date.now() + Math.min(300_000, 30_000 * 2 ** nextAttempts)),
    });
  }
}

async function performCleanup(pool, uploadRoot, run) {
  const items = await pool.query(
    `SELECT id::text,stored_file_id::text,status,attempts
     FROM file_cleanup_items
     WHERE run_id=$1 AND status IN ('queued','processing','pending_retry')
       AND next_attempt_at<=now() ORDER BY id`,
    [run.id],
  );
  for (const item of items.rows) await processCleanupItem(pool, uploadRoot, run, item);

  const summary = await pool.query(
    `SELECT count(*) FILTER (WHERE status='cleaned')::int AS cleaned,
      count(*) FILTER (WHERE status IN ('skipped','already_absent'))::int AS skipped,
      count(*) FILTER (WHERE status='failed')::int AS failed,
      count(*) FILTER (WHERE status='pending_retry')::int AS pending,
      COALESCE(sum(size_bytes) FILTER (WHERE status='cleaned'),0)::bigint AS cleaned_bytes
     FROM file_cleanup_items WHERE run_id=$1`,
    [run.id],
  );
  const counts = summary.rows[0];
  if (counts.pending > 0) {
    await pool.query(
      `UPDATE file_cleanup_runs SET status='queued',next_attempt_at=now()+interval '30 seconds',
        cleaned_items=$2,skipped_items=$3,failed_items=$4,cleaned_bytes=$5
       WHERE id=$1`,
      [run.id, counts.cleaned, counts.skipped, counts.failed, counts.cleaned_bytes],
    );
    return;
  }
  const status = counts.failed > 0 || counts.skipped > 0 ? "partial" : "completed";
  await withTransaction(pool, async (client) => {
    await client.query(
      `UPDATE file_cleanup_runs SET status=$2,cleaned_items=$3,skipped_items=$4,
        failed_items=$5,cleaned_bytes=$6,completed_at=now() WHERE id=$1`,
      [run.id, status, counts.cleaned, counts.skipped, counts.failed, counts.cleaned_bytes],
    );
    await writeAudit(client, {
      organizationId: run.organization_id,
      actorUserId: run.requested_by_user_id,
      action: "storage_maintenance.cleanup_completed",
      entityType: "file_cleanup_run",
      entityId: run.id,
      afterData: {
        status,
        cleaned: counts.cleaned,
        skipped: counts.skipped,
        failed: counts.failed,
      },
    });
  });
}

async function handleRunFailure(pool, run, error) {
  const retry = Number(run.attempts || 0) < FILE_CLEANUP_MAX_ATTEMPTS;
  await pool.query(
    `UPDATE file_cleanup_runs SET status=$2,last_error_code='WORKER_PROCESS_FAILED',
      next_attempt_at=now()+interval '30 seconds',completed_at=CASE WHEN $2='failed' THEN now() ELSE NULL END
     WHERE id=$1`,
    [run.id, retry ? "queued" : "failed"],
  );
  console.error("[storage-maintenance.worker]", { runId: String(run.id), error: error.message });
}

export async function processNextStorageMaintenanceRun(pool, uploadRoot) {
  const run = await claimNextRun(pool);
  if (!run) return false;
  try {
    if (run.run_type === "scan") await performScan(pool, uploadRoot, run);
    else await performCleanup(pool, uploadRoot, run);
  } catch (error) {
    await handleRunFailure(pool, run, error);
  }
  return true;
}

export async function processStorageMaintenanceRunById(pool, uploadRoot, runId) {
  const run = await claimRunById(pool, runId);
  if (!run) return false;
  try {
    if (run.run_type === "scan") await performScan(pool, uploadRoot, run);
    else await performCleanup(pool, uploadRoot, run);
  } catch (error) {
    await handleRunFailure(pool, run, error);
  }
  return true;
}

export async function runStorageMaintenanceWorker(
  pool,
  uploadRoot,
  { once = false, signal, pollIntervalMs = 2000 } = {},
) {
  await recoverStaleStorageMaintenanceRuns(pool);
  do {
    const processed = await processNextStorageMaintenanceRun(pool, uploadRoot);
    if (once) return processed;
    if (!processed) await sleep(pollIntervalMs);
  } while (!signal?.aborted);
  return false;
}
