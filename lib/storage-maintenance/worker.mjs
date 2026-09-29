import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, readdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import { scanUploadBuffer } from "../files/malwareScanner.js";
import {
  ACTIVE_ORPHAN_GRACE_HOURS,
  CLEANABLE_PROFILE_CATEGORIES,
  FILE_CLEANUP_MAX_ATTEMPTS,
  FILE_CLEANUP_RETENTION_DAYS,
  FILE_QUARANTINE_DAYS,
  OFFICIAL_HISTORY_CATEGORIES,
} from "./policy.mjs";
import { findStoredFileReferences, resolveMaintenancePath } from "./shared.mjs";

export { findStoredFileReferences, resolveMaintenancePath } from "./shared.mjs";

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
      reasonCode: "metadata_status_invalid",
      references,
    };
  if (OFFICIAL_HISTORY_CATEGORIES.includes(file.category))
    return { status: "needs_review", itemKind: "issue", reasonCode: "official_history_detached" };
  if (
    !CLEANABLE_PROFILE_CATEGORIES.includes(file.category) &&
    file.deletion_reason_code !== "maintenance_approved"
  )
    return { status: "needs_review", itemKind: "issue", reasonCode: "category_not_allowed" };
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

async function listFilesystemFiles(root, current = root) {
  const results = [];
  let entries = [];
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return results;
    throw error;
  }
  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    if (entry.isDirectory()) results.push(...(await listFilesystemFiles(root, absolutePath)));
    else if (entry.isFile()) {
      const details = await stat(absolutePath);
      results.push({
        objectKey: path.relative(root, absolutePath).split(path.sep).join("/"),
        sizeBytes: details.size,
        modifiedAt: details.mtime,
      });
    }
  }
  return results;
}

const sanitizeSignature = (value) =>
  String(value || "detected-by-clamav")
    .replace(/[\r\n\0]/g, " ")
    .slice(0, 240);

async function inspectPhysicalSecurity(absolutePath) {
  const buffer = await readFile(absolutePath);
  const detected = await fileTypeFromBuffer(buffer);
  const base = {
    mimeType: detected?.mime || "application/octet-stream",
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
  try {
    const result = await scanUploadBuffer(buffer);
    return {
      ...base,
      malwareScanStatus: result.status,
      malwareSignature: result.signature || null,
    };
  } catch (error) {
    return {
      ...base,
      malwareScanStatus: error?.code === "MALWARE_DETECTED" ? "infected" : "scan_error",
      malwareSignature:
        error?.code === "MALWARE_DETECTED" ? sanitizeSignature(error.malwareSignature) : null,
    };
  }
}

async function quarantineThreat(pool, uploadRoot, run, file, security = {}) {
  const resolved = resolveMaintenancePath(uploadRoot, file);
  if (!resolved.valid || !(await exists(resolved.absolutePath))) return false;
  const buffer = await readFile(resolved.absolutePath);
  const extension = path.extname(resolved.absolutePath).slice(0, 12);
  const quarantineKey = path.posix.join(
    ".trash",
    "storage-maintenance",
    "security",
    `org_${run.organization_id}`,
    `${randomUUID()}${extension}`,
  );
  const quarantinePath = path.resolve(uploadRoot, ...quarantineKey.split("/"));
  await mkdir(path.dirname(quarantinePath), { recursive: true });
  await rename(resolved.absolutePath, quarantinePath);
  try {
    await withTransaction(pool, async (client) => {
      await client.query(
        `INSERT INTO file_quarantine_items(
          organization_id,stored_file_id,reason,status,original_object_key,quarantine_object_key,
          original_name,mime_type,size_bytes,sha256,malware_scan_status,malware_scan_engine,
          malware_signature,quarantined_by_user_id,purge_after)
         VALUES($1,$2,'malware','quarantined',$3,$4,$5,$6,$7,$8,'infected','clamav',$9,$10,
           now()+($11*interval '1 day'))`,
        [
          run.organization_id,
          file.id || null,
          file.object_key,
          quarantineKey,
          file.original_name || "File terdeteksi berbahaya",
          file.mime_type || security.mimeType || "application/octet-stream",
          file.size_bytes || buffer.length,
          file.sha256 || security.sha256 || createHash("sha256").update(buffer).digest("hex"),
          sanitizeSignature(file.malware_signature || security.malwareSignature),
          run.requested_by_user_id,
          FILE_QUARANTINE_DAYS,
        ],
      );
      if (file.id) {
        await client.query(
          `UPDATE stored_files SET lifecycle_status='quarantined',quarantined_at=now()
           WHERE id=$1 AND organization_id=$2 AND malware_scan_status='infected'`,
          [file.id, run.organization_id],
        );
        await client.query(
          `UPDATE file_purge_jobs SET status='cancelled',completed_at=now(),
             last_error_code='SECURITY_QUARANTINE'
           WHERE stored_file_id=$1 AND organization_id=$2 AND status IN ('queued','retry')`,
          [file.id, run.organization_id],
        );
      }
    });
    return true;
  } catch (error) {
    await rename(quarantinePath, resolved.absolutePath).catch(() => {});
    throw error;
  }
}

async function inspectActiveOrphanFile(database, uploadRoot, file) {
  if (file.lifecycle_status === "draft")
    return { status: "needs_review", itemKind: "issue", reasonCode: "draft_active" };
  const references = await findStoredFileReferences(database, file.organization_id, file.id);
  if (references.length) return null;
  if (Date.now() - new Date(file.created_at).getTime() < ACTIVE_ORPHAN_GRACE_HOURS * 3_600_000)
    return null;
  if (file.storage_provider !== "local_private")
    return { status: "needs_review", itemKind: "issue", reasonCode: "unsupported_provider" };
  const resolved = resolveMaintenancePath(uploadRoot, file);
  if (!resolved.valid)
    return { status: "needs_review", itemKind: "issue", reasonCode: resolved.reasonCode };
  if (!(await exists(resolved.absolutePath)))
    return {
      status: "needs_review",
      itemKind: "issue",
      reasonCode: "unreferenced_content_missing",
    };
  if (OFFICIAL_HISTORY_CATEGORIES.includes(file.category))
    return { status: "needs_review", itemKind: "issue", reasonCode: "official_history_detached" };
  if (!CLEANABLE_PROFILE_CATEGORIES.includes(file.category))
    return { status: "needs_review", itemKind: "issue", reasonCode: "category_not_allowed" };
  return { status: "needs_review", itemKind: "issue", reasonCode: "active_orphan" };
}

async function performScan(pool, uploadRoot, run) {
  const files = await pool.query(
    `SELECT file.id::text,file.organization_id::text,file.employee_id::text,
      file.onboarding_draft_id::text,file.storage_provider,file.object_key,file.original_name,file.category,
      file.size_bytes,file.mime_type,file.sha256,file.created_at,file.deleted_at,file.deletion_reason_code,
      file.content_purged_at,
      file.lifecycle_status,file.malware_scan_status,file.malware_scanned_at,file.malware_scan_engine,
      file.malware_signature
     FROM stored_files file
     WHERE file.organization_id=$1 AND file.lifecycle_status NOT IN ('purged','retained','quarantined')
     ORDER BY file.id`,
    [run.organization_id],
  );
  const inspectedItems = [];
  const alreadyAbsentIds = [];
  const metadataKeys = new Set(files.rows.map((file) => file.object_key));

  for (const file of files.rows) {
    if (file.malware_scan_status === "infected") {
      await quarantineThreat(pool, uploadRoot, run, file);
      inspectedItems.push({
        file,
        status: "needs_review",
        itemKind: "issue",
        reasonCode: "malware_infected",
      });
      continue;
    }
    if (file.malware_scan_status === "scan_error") {
      inspectedItems.push({
        file,
        status: "needs_review",
        itemKind: "issue",
        reasonCode: "malware_scan_error",
      });
      continue;
    }
    if (file.lifecycle_status === "deleted" || file.deleted_at) {
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
      continue;
    }
    if (!(await exists(resolved.absolutePath))) {
      const references = await findStoredFileReferences(pool, file.organization_id, file.id);
      inspectedItems.push({
        file,
        status: "needs_review",
        itemKind: "issue",
        reasonCode: references.length
          ? "active_content_missing"
          : "unreferenced_content_missing",
        references,
      });
      continue;
    }
    const inspection = await inspectActiveOrphanFile(pool, uploadRoot, file);
    if (inspection) inspectedItems.push({ file, ...inspection });
  }

  const organizationRoot = path.join(uploadRoot, `org_${run.organization_id}`);
  const filesystemFiles = await listFilesystemFiles(uploadRoot, organizationRoot);
  for (const physical of filesystemFiles) {
    if (metadataKeys.has(physical.objectKey)) continue;
    if (Date.now() - physical.modifiedAt.getTime() < ACTIVE_ORPHAN_GRACE_HOURS * 3_600_000) continue;
    const reasonCode = physical.objectKey.endsWith(".tmp") ? "temporary_file" : "filesystem_orphan";
    const security = await inspectPhysicalSecurity(
      path.resolve(uploadRoot, ...physical.objectKey.split("/")),
    );
    if (security.malwareScanStatus === "infected")
      await quarantineThreat(
        pool,
        uploadRoot,
        run,
        {
          organization_id: run.organization_id,
          object_key: physical.objectKey,
          original_name: path.basename(physical.objectKey),
          category: "filesystem",
          size_bytes: physical.sizeBytes,
          mime_type: security.mimeType,
        },
        security,
      );
    inspectedItems.push({
      file: {
        id: null,
        object_key: physical.objectKey,
        category: "filesystem",
        size_bytes: physical.sizeBytes,
        mime_type: security.mimeType,
        malware_scan_status: security.malwareScanStatus,
        malware_signature: security.malwareSignature,
        file_modified_at: physical.modifiedAt,
      },
      status: security.malwareScanStatus === "clean" ? "eligible" : "needs_review",
      itemKind: security.malwareScanStatus === "clean" ? "candidate" : "issue",
      reasonCode:
        security.malwareScanStatus === "infected"
          ? "malware_infected"
          : security.malwareScanStatus === "scan_error"
            ? "malware_scan_error"
            : reasonCode,
    });
  }

  const trashFiles = await listFilesystemFiles(uploadRoot, path.join(uploadRoot, ".trash"));
  for (const physical of trashFiles) {
    if (!physical.objectKey.split("/").includes(`org_${run.organization_id}`)) continue;
    if (
      physical.objectKey.includes(".trash/storage-maintenance/security/") ||
      physical.objectKey.includes(".trash/storage-maintenance/quarantine/")
    )
      continue;
    inspectedItems.push({
      file: {
        id: null,
        object_key: physical.objectKey,
        category: "filesystem",
        size_bytes: physical.sizeBytes,
      },
      status: "needs_review",
      itemKind: "issue",
      reasonCode: "trash_file",
    });
  }

  await withTransaction(pool, async (client) => {
    await client.query("DELETE FROM file_cleanup_items WHERE run_id=$1", [run.id]);
    for (const item of inspectedItems)
      await client.query(
        `INSERT INTO file_cleanup_items(
          organization_id,run_id,stored_file_id,object_key,item_kind,status,reason_code,
          reference_labels,category,size_bytes,mime_type,malware_scan_status,malware_signature,
          malware_scanned_at,file_modified_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          run.organization_id,
          run.id,
          item.file.id,
          item.file.id ? null : item.file.object_key,
          item.itemKind,
          item.status,
          item.reasonCode,
          item.references || [],
          item.file.category,
          item.file.size_bytes,
          item.file.mime_type || null,
          item.file.malware_scan_status || null,
          item.file.malware_signature ? sanitizeSignature(item.file.malware_signature) : null,
          item.file.malware_scanned_at || null,
          item.file.file_modified_at || null,
        ],
      );
    if (alreadyAbsentIds.length)
      await client.query(
        `UPDATE stored_files
         SET lifecycle_status='purged',content_purged_at=COALESCE(content_purged_at,now())
         WHERE organization_id=$1 AND id=ANY($2::bigint[]) AND lifecycle_status='deleted'`,
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
      deleted_at,deletion_reason_code,content_purged_at
     FROM stored_files WHERE id=$1 AND organization_id=$2 AND lifecycle_status='deleted'`,
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
          deleted_at,deletion_reason_code,content_purged_at
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
        `UPDATE stored_files SET lifecycle_status='purged',
            deleted_at=COALESCE(deleted_at,now()),
            deletion_reason_code=COALESCE(deletion_reason_code,'orphan_reconciled'),
            content_purged_at=COALESCE(content_purged_at,now())
         WHERE id=$1 AND organization_id=$2 AND lifecycle_status='deleted'`,
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
    `UPDATE file_cleanup_runs SET status=$2::varchar,last_error_code='WORKER_PROCESS_FAILED',
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

export async function recoverStaleFilePurgeJobs(pool) {
  await pool.query(
    `UPDATE file_purge_jobs
     SET status=CASE WHEN attempts>=$1 THEN 'failed' ELSE 'retry' END,
       next_attempt_at=now(),last_error_code='WORKER_INTERRUPTED',started_at=NULL
     WHERE status='processing' AND started_at<now()-interval '5 minutes'`,
    [FILE_CLEANUP_MAX_ATTEMPTS],
  );
}

async function claimNextFilePurgeJob(pool) {
  return withTransaction(pool, async (client) => {
    const result = await client.query(
      `WITH next_job AS (
         SELECT id FROM file_purge_jobs
         WHERE status IN ('queued','retry') AND next_attempt_at<=now()
         ORDER BY next_attempt_at,id
         FOR UPDATE SKIP LOCKED LIMIT 1
       )
       UPDATE file_purge_jobs job
       SET status='processing',started_at=now(),attempts=attempts+1,last_error_code=NULL
       FROM next_job WHERE job.id=next_job.id RETURNING job.*`,
    );
    return result.rows[0] || null;
  });
}

export async function processNextFilePurgeJob(pool, uploadRoot) {
  const job = await claimNextFilePurgeJob(pool);
  if (!job) return false;
  try {
    const fileResult = await pool.query(
      `SELECT id::text,organization_id::text,object_key,lifecycle_status,category
       FROM stored_files WHERE id=$1 AND organization_id=$2`,
      [job.stored_file_id, job.organization_id],
    );
    const file = fileResult.rows[0];
    const references = file
      ? await findStoredFileReferences(pool, file.organization_id, file.id)
      : [];
    if (file && (OFFICIAL_HISTORY_CATEGORIES.includes(file.category) || references.length)) {
      await pool.query(
        `UPDATE file_purge_jobs SET status='cancelled',completed_at=now(),
           last_error_code='PROTECTED_OR_REFERENCED' WHERE id=$1`,
        [job.id],
      );
      return true;
    }
    if (!file || file.lifecycle_status !== "deleted" || file.object_key !== job.object_key) {
      await pool.query(
        `UPDATE file_purge_jobs SET status='failed',completed_at=now(),
          last_error_code='FILE_STATE_CHANGED' WHERE id=$1`,
        [job.id],
      );
      return true;
    }
    const resolved = resolveMaintenancePath(uploadRoot, file);
    if (!resolved.valid) throw new Error(resolved.reasonCode);
    await unlink(resolved.absolutePath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
    await withTransaction(pool, async (client) => {
      await client.query(
        `UPDATE stored_files SET lifecycle_status='purged',
          content_purged_at=COALESCE(content_purged_at,now())
         WHERE id=$1 AND organization_id=$2 AND lifecycle_status='deleted'`,
        [job.stored_file_id, job.organization_id],
      );
      await client.query(
        `UPDATE file_purge_jobs SET status='completed',completed_at=now(),
          last_error_code=NULL WHERE id=$1`,
        [job.id],
      );
    });
  } catch (error) {
    const retry = Number(job.attempts || 0) < FILE_CLEANUP_MAX_ATTEMPTS;
    const delaySeconds = Math.min(3600, 15 * 2 ** Math.max(0, Number(job.attempts || 1) - 1));
    await pool.query(
      `UPDATE file_purge_jobs SET status=$2::varchar,next_attempt_at=now()+($3*interval '1 second'),
        last_error_code='PURGE_FAILED',completed_at=CASE WHEN $2='failed' THEN now() ELSE NULL END
       WHERE id=$1`,
      [job.id, retry ? "retry" : "failed", delaySeconds],
    );
    console.error("[file-purge.worker]", { jobId: String(job.id), error: error.message });
  }
  return true;
}

export async function processNextQuarantinePurge(pool, uploadRoot) {
  const claimed = await withTransaction(pool, async (client) => {
    const result = await client.query(
      `SELECT * FROM file_quarantine_items
       WHERE status='quarantined' AND purge_after<=now()
       ORDER BY purge_after,id FOR UPDATE SKIP LOCKED LIMIT 1`,
    );
    return result.rows[0] || null;
  });
  if (!claimed) return false;
  const root = path.resolve(uploadRoot);
  const quarantinePath = path.resolve(root, ...String(claimed.quarantine_object_key).split("/"));
  if (
    !claimed.quarantine_object_key.startsWith(".trash/storage-maintenance/") ||
    !quarantinePath.startsWith(`${root}${path.sep}`)
  ) {
    await pool.query(
      "UPDATE file_quarantine_items SET status='failed',last_error_code='INVALID_QUARANTINE_PATH' WHERE id=$1",
      [claimed.id],
    );
    return true;
  }
  try {
    await unlink(quarantinePath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
    await withTransaction(pool, async (client) => {
      await client.query(
        `UPDATE file_quarantine_items SET status='purged',purged_at=now(),last_error_code=NULL
         WHERE id=$1 AND status='quarantined'`,
        [claimed.id],
      );
      if (claimed.stored_file_id)
        await client.query(
          `UPDATE stored_files SET lifecycle_status='purged',deleted_at=COALESCE(deleted_at,now()),
             content_purged_at=COALESCE(content_purged_at,now())
           WHERE id=$1 AND organization_id=$2 AND lifecycle_status='quarantined'`,
          [claimed.stored_file_id, claimed.organization_id],
        );
    });
  } catch (error) {
    await pool.query(
      `UPDATE file_quarantine_items SET attempts=attempts+1,last_error_code='QUARANTINE_PURGE_FAILED',
         status=CASE WHEN attempts+1>=$2 THEN 'failed' ELSE status END WHERE id=$1`,
      [claimed.id, FILE_CLEANUP_MAX_ATTEMPTS],
    );
  }
  return true;
}
export async function runStorageMaintenanceWorker(
  pool,
  uploadRoot,
  { once = false, signal, pollIntervalMs = 2000 } = {},
) {
  await recoverStaleStorageMaintenanceRuns(pool);
  await recoverStaleFilePurgeJobs(pool);
  await pool.query("DELETE FROM security_rate_limit_buckets WHERE expires_at<now()");
  do {
    const quarantinePurged = await processNextQuarantinePurge(pool, uploadRoot);
    const purged = await processNextFilePurgeJob(pool, uploadRoot);
    const maintained = await processNextStorageMaintenanceRun(pool, uploadRoot);
    const processed = quarantinePurged || purged || maintained;
    if (once) return processed;
    if (!processed) await sleep(pollIntervalMs);
  } while (!signal?.aborted);
  return false;
}
