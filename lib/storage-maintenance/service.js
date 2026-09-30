import { createHash, randomUUID } from "node:crypto";
import { access, link, mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { scanUploadBuffer } from "@/lib/files/malwareScanner";
import {
  FILE_CATEGORY_LABELS,
  FILE_CLEANUP_RETENTION_DAYS,
  FILE_CLEANUP_REASON_LABELS,
  FILE_DELETION_REASON_LABELS,
  FILE_QUARANTINE_DAYS,
  ISSUE_PRESENTATION,
  MAINTENANCE_INLINE_MIMES,
  MAINTENANCE_PREVIEW_MAX_BYTES,
  OFFICIAL_HISTORY_CATEGORIES,
  maskEmployeeNumber,
} from "@/lib/storage-maintenance/policy.mjs";
import {
  findStoredFileReferences,
  inspectMaintenancePath,
  inspectPrivateStoragePath,
  lockFileReferences,
} from "@/lib/storage-maintenance/shared.mjs";

const uploadRoot = path.resolve(
  /* turbopackIgnore: true */ process.env.UPLOAD_ROOT || path.join(process.cwd(), "uploads"),
);

const runSelect = `SELECT run.id::text,run.organization_id::text,organization.name AS organization_name,
  run.run_type,run.source_scan_run_id::text,run.status,run.total_items,run.candidate_items,
  run.issue_items,run.selected_items,run.cleaned_items,run.skipped_items,run.failed_items,
  run.candidate_bytes::text,run.cleaned_bytes::text,run.attempts,run.last_error_code,
  run.started_at,run.completed_at,run.created_at,run.updated_at,
  identity.display_name AS requested_by_name
 FROM file_cleanup_runs run
 JOIN organizations organization ON organization.id=run.organization_id
 LEFT JOIN v_user_identity identity ON identity.user_id=run.requested_by_user_id`;

const mapRun = (row) => ({
  ...row,
  candidate_bytes: Number(row.candidate_bytes || 0),
  cleaned_bytes: Number(row.cleaned_bytes || 0),
});

const mapItem = (row) => {
  const { employee_no: employeeNumber, ...safeRow } = row;
  const presentation = ISSUE_PRESENTATION[row.reason_code] || {};
  const safeToRead =
    !["active_content_missing", "unreferenced_content_missing"].includes(row.reason_code) &&
    row.malware_scan_status === "clean" &&
    Number(row.size_bytes || 0) <= MAINTENANCE_PREVIEW_MAX_BYTES;
  const previewAvailable = safeToRead && MAINTENANCE_INLINE_MIMES.includes(row.mime_type);
  const availableActions = [];
  if (previewAvailable) availableActions.push("preview");
  if (safeToRead) availableActions.push("download");
  if (row.status === "eligible" && row.organization_id) availableActions.push("cleanup");
  if (row.reason_code === "metadata_status_invalid") availableActions.push("restore_metadata");
  if (row.reason_code === "active_content_missing") availableActions.push("recover_content");
  if (row.reason_code === "malware_scan_error") availableActions.push("rescan");
  if (
    [
      "invalid_storage_path",
      "organization_mismatch",
      "unsupported_provider",
      "storage_unavailable",
      "active_object_key",
      "trash_file",
    ].includes(row.reason_code)
  )
    availableActions.push("validate_storage");
  if (row.reason_code === "malware_infected" && row.quarantine_id)
    availableActions.push("purge_now");
  if (row.stored_file_id && row.item_kind === "issue")
    availableActions.unshift("view_relationships");
  return {
    ...safeRow,
    size_bytes: Number(row.size_bytes || 0),
    category_label: FILE_CATEGORY_LABELS[row.category] || "File lainnya",
    reason_label:
      FILE_CLEANUP_REASON_LABELS[row.reason_code] || "Kondisi file perlu ditindaklanjuti",
    issue_type: presentation.issueType || (row.item_kind === "candidate" ? "cleanup" : "integrity"),
    impact: presentation.impact || "File tidak akan diubah sampai Superadmin memilih tindakan.",
    recommended_action:
      presentation.recommendedAction || "Tinjau informasi file sebelum melanjutkan.",
    preview_available: previewAvailable,
    preview_kind: row.mime_type?.startsWith("image/")
      ? "image"
      : row.mime_type === "application/pdf"
        ? "pdf"
        : "download",
    available_actions: availableActions,
    deletion_reason_label:
      FILE_DELETION_REASON_LABELS[row.deletion_reason_code] || "Alasan tidak tersedia",
    employee_no_masked: maskEmployeeNumber(employeeNumber),
    reference_labels: row.reference_labels || [],
    relationship_label: !row.stored_file_id
      ? "File tanpa catatan"
      : (row.reference_labels || []).length
        ? `Terhubung: ${row.reference_labels.join(", ")}`
        : "Tidak digunakan",
  };
};

async function ensureOrganization(database, organizationId) {
  const result = await database.query("SELECT id FROM organizations WHERE id=$1", [organizationId]);
  if (!result.rows[0])
    throw new ServiceError("ORGANIZATION_NOT_FOUND", "Organisasi tidak ditemukan.", 404);
}

function normalizeRunId(runId) {
  if (!/^[1-9][0-9]*$/.test(String(runId)))
    throw new ServiceError("INVALID_RUN_ID", "ID proses tidak valid.", 400);
  return String(runId);
}

const storageSummarySelect = `SELECT organization.id::text,organization.name,
      latest_scan.id::text AS latest_scan_id,latest_scan.status AS latest_scan_status,
      COALESCE((SELECT count(*)::int FROM file_cleanup_items item
        WHERE item.run_id=latest_scan.id AND item.status='eligible'),0) AS candidate_items,
      COALESCE((SELECT count(*)::int FROM file_cleanup_items item
        WHERE item.run_id=latest_scan.id AND item.item_kind='issue'
          AND item.status='needs_review' AND item.reason_code<>'malware_infected'),0) AS issue_items,
      COALESCE((SELECT count(*)::int FROM file_cleanup_items item
        WHERE item.run_id=latest_scan.id AND item.status='needs_review'
          AND item.reason_code='malware_infected'),0) AS security_items,
      COALESCE((SELECT count(*)::int FROM file_quarantine_items item
        WHERE item.organization_id=organization.id AND item.status='quarantined'),0) AS quarantine_items,
      COALESCE((SELECT sum(item.size_bytes)::bigint FROM file_cleanup_items item
        WHERE item.run_id=latest_scan.id AND item.status='eligible'),0)::text AS candidate_bytes,
      latest_scan.completed_at AS latest_scan_at,
      latest_cleanup.id::text AS latest_cleanup_id,latest_cleanup.status AS latest_cleanup_status,
      latest_cleanup.cleaned_items,latest_cleanup.cleaned_bytes::text,
      latest_cleanup.completed_at AS latest_cleanup_at,
      (SELECT count(*)::int FROM file_cleanup_runs pending
        WHERE pending.organization_id=organization.id AND pending.status IN ('queued','running')) AS active_run_count
     FROM organizations organization
     LEFT JOIN LATERAL (
       SELECT * FROM file_cleanup_runs run
       WHERE run.organization_id=organization.id AND run.run_type='scan'
       ORDER BY run.created_at DESC,run.id DESC LIMIT 1
     ) latest_scan ON true
     LEFT JOIN LATERAL (
       SELECT * FROM file_cleanup_runs run
       WHERE run.organization_id=organization.id AND run.run_type='cleanup'
       ORDER BY run.created_at DESC,run.id DESC LIMIT 1
     ) latest_cleanup ON true`;

export async function getStorageMaintenanceSummary(organizationId) {
  await ensureOrganization(pool, organizationId);
  const result = await pool.query(`${storageSummarySelect} WHERE organization.id=$1`, [
    organizationId,
  ]);
  const row = result.rows[0];
  return {
    ...row,
    candidate_items: row.candidate_items || 0,
    issue_items: row.issue_items || 0,
    security_items: row.security_items || 0,
    quarantine_items: row.quarantine_items || 0,
    candidate_bytes: Number(row.candidate_bytes || 0),
    cleaned_items: row.cleaned_items || 0,
    cleaned_bytes: Number(row.cleaned_bytes || 0),
  };
}

/** Read-only cross-organization view for Superadmin; mutations still require one organization. */
export async function getAllStorageMaintenance({ page, pageSize, itemKind }) {
  const summaries = (await pool.query(storageSummarySelect)).rows;
  const summary = {
    candidate_items: 0,
    candidate_bytes: 0,
    issue_items: 0,
    security_items: 0,
    quarantine_items: 0,
    active_run_count: 0,
  };
  for (const row of summaries) {
    for (const key of Object.keys(summary)) summary[key] += Number(row[key] || 0);
  }
  const latestScanAt = summaries
    .map((row) => row.latest_scan_at)
    .filter(Boolean)
    .sort((left, right) => new Date(left) - new Date(right))
    .at(-1);
  summary.latest_scan_at = latestScanAt || null;
  const latestCleanup = summaries
    .filter((row) => row.latest_cleanup_at)
    .sort((left, right) => new Date(right.latest_cleanup_at) - new Date(left.latest_cleanup_at))[0];
  summary.latest_cleanup_at = latestCleanup?.latest_cleanup_at || null;
  summary.cleaned_items = latestCleanup?.cleaned_items || 0;
  const runs = await pool.query(`${runSelect} ORDER BY run.created_at DESC,run.id DESC LIMIT 50`);
  if (itemKind === "history") return { summary, runs: runs.rows.map(mapRun), items: [], total: 0 };
  const offset = (page - 1) * pageSize;
  if (itemKind === "quarantine") {
    const [items, count] = await Promise.all([
      pool.query(
        `SELECT q.id::text,q.organization_id::text,o.name AS organization_name,q.reason,q.status,
          q.original_name,q.size_bytes::text,q.purge_after,q.malware_scan_status,
          q.reason<>'malware' AS restore_available
         FROM file_quarantine_items q JOIN organizations o ON o.id=q.organization_id
         WHERE q.status='quarantined' ORDER BY q.id DESC LIMIT $1 OFFSET $2`,
        [pageSize, offset],
      ),
      pool.query(
        "SELECT count(*)::int AS total FROM file_quarantine_items WHERE status='quarantined'",
      ),
    ]);
    return { summary, runs: runs.rows.map(mapRun), items: items.rows, total: count.rows[0].total };
  }
  const kindCondition =
    itemKind === "candidate"
      ? "item.item_kind='candidate' AND item.status='eligible'"
      : itemKind === "security"
        ? "item.status='needs_review' AND item.reason_code='malware_infected'"
        : "item.item_kind='issue' AND item.status='needs_review' AND item.reason_code<>'malware_infected'";
  const from = `FROM file_cleanup_items item
    JOIN LATERAL (SELECT id FROM file_cleanup_runs r WHERE r.organization_id=item.organization_id
      AND r.run_type='scan' ORDER BY r.created_at DESC,r.id DESC LIMIT 1) latest ON latest.id=item.run_id
    JOIN organizations organization ON organization.id=item.organization_id
    LEFT JOIN stored_files file ON file.organization_id=item.organization_id AND file.id=item.stored_file_id
    LEFT JOIN employees employee ON employee.organization_id=file.organization_id AND employee.id=file.employee_id
    LEFT JOIN LATERAL (SELECT q.id,q.purge_after FROM file_quarantine_items q
      WHERE q.organization_id=item.organization_id AND q.status='quarantined'
      AND ((item.stored_file_id IS NOT NULL AND q.stored_file_id=item.stored_file_id)
        OR (item.stored_file_id IS NULL AND q.original_object_key=item.object_key))
      ORDER BY q.id DESC LIMIT 1) quarantine ON true
    WHERE ${kindCondition}`;
  const [items, count] = await Promise.all([
    pool.query(
      `SELECT item.id::text,item.run_id::text,item.organization_id::text,item.stored_file_id::text,
        item.item_kind,item.status,item.reason_code,item.category,item.size_bytes::text,
        item.mime_type,item.malware_scan_status,item.malware_signature,item.malware_scanned_at,
        item.attempts,item.last_error_code,item.created_at,item.updated_at,
        COALESCE(file.original_name,'File tanpa catatan') AS original_name,
        file.created_at AS uploaded_at,file.deleted_at,file.deletion_reason_code,
        file.content_purged_at,file.lifecycle_status,organization.name AS organization_name,
        employee.id::text AS employee_id,employee.full_name AS employee_name,employee.employee_no,
        quarantine.id::text AS quarantine_id,quarantine.purge_after,
        COALESCE(item.reference_labels,'{}'::text[]) AS reference_labels
       ${from} ORDER BY item.created_at DESC,item.id DESC LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    ),
    pool.query(`SELECT count(*)::int AS total ${from}`),
  ]);
  return {
    summary,
    runs: runs.rows.map(mapRun),
    items: items.rows.map(mapItem),
    total: count.rows[0].total,
  };
}

export async function createStorageScan(organizationId, actor, requestId) {
  return withTransaction(async (client) => {
    await ensureOrganization(client, organizationId);
    await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [organizationId]);
    const active = await client.query(
      `SELECT id FROM file_cleanup_runs
       WHERE organization_id=$1 AND status IN ('queued','running')
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [organizationId],
    );
    if (active.rows[0])
      throw new ServiceError(
        "STORAGE_MAINTENANCE_BUSY",
        "Masih ada pemeriksaan atau penghapusan file yang sedang diproses untuk organisasi ini.",
        409,
      );
    const inserted = await client.query(
      `INSERT INTO file_cleanup_runs(organization_id,run_type,status,requested_by_user_id)
       VALUES($1,'scan','queued',$2) RETURNING id::text`,
      [organizationId, actor.id],
    );
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "storage_maintenance.scan_requested",
      entityType: "file_cleanup_run",
      entityId: inserted.rows[0].id,
      afterData: { runType: "scan" },
      requestId,
    });
    return { id: inserted.rows[0].id, status: "queued" };
  });
}

export async function createStorageCleanup(scanRunId, input, actor, requestId) {
  const normalizedScanRunId = normalizeRunId(scanRunId);
  return withTransaction(async (client) => {
    await ensureOrganization(client, input.organizationId);
    await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [input.organizationId]);
    const scan = await client.query(
      `SELECT id,status FROM file_cleanup_runs
       WHERE id=$1 AND organization_id=$2 AND run_type='scan' FOR UPDATE`,
      [normalizedScanRunId, input.organizationId],
    );
    if (!scan.rows[0])
      throw new ServiceError("SCAN_NOT_FOUND", "Hasil pemeriksaan tidak ditemukan.", 404);
    if (scan.rows[0].status !== "completed")
      throw new ServiceError(
        "SCAN_NOT_READY",
        "Pemeriksaan belum selesai atau tidak dapat digunakan.",
        409,
      );

    const active = await client.query(
      `SELECT id FROM file_cleanup_runs
       WHERE organization_id=$1 AND status IN ('queued','running')
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [input.organizationId],
    );
    if (active.rows[0])
      throw new ServiceError(
        "STORAGE_MAINTENANCE_BUSY",
        "Masih ada proses lain yang sedang berjalan untuk organisasi ini.",
        409,
      );

    const selected = await client.query(
      `SELECT id,stored_file_id,category,size_bytes,object_key,file_modified_at,reason_code
       FROM file_cleanup_items
       WHERE run_id=$1 AND organization_id=$2 AND id=ANY($3::bigint[])
         AND item_kind='candidate' AND status='eligible'
       ORDER BY id FOR UPDATE`,
      [normalizedScanRunId, input.organizationId, input.itemIds],
    );
    if (selected.rowCount !== input.itemIds.length)
      throw new ServiceError(
        "CLEANUP_SELECTION_INVALID",
        "Sebagian file tidak lagi tersedia sebagai kandidat aman. Jalankan pemeriksaan kembali.",
        409,
      );

    const inserted = await client.query(
      `INSERT INTO file_cleanup_runs(
         organization_id,run_type,source_scan_run_id,status,requested_by_user_id,
         total_items,selected_items,candidate_bytes)
       VALUES($1,'cleanup',$2,'queued',$3,$4,$4,$5) RETURNING id::text`,
      [
        input.organizationId,
        normalizedScanRunId,
        actor.id,
        selected.rowCount,
        selected.rows.reduce((total, item) => total + Number(item.size_bytes || 0), 0),
      ],
    );
    const runId = inserted.rows[0].id;
    for (const item of selected.rows)
      await client.query(
        `INSERT INTO file_cleanup_items(
           organization_id,run_id,stored_file_id,item_kind,status,reason_code,category,size_bytes,object_key,file_modified_at)
         VALUES($1,$2,$3,'candidate','queued',$8,$4,$5,$6,$7)`,
        [
          input.organizationId,
          runId,
          item.stored_file_id,
          item.category,
          item.size_bytes,
          item.object_key,
          item.file_modified_at,
          item.reason_code,
        ],
      );
    await client.query(
      `UPDATE file_cleanup_items SET status='selected'
       WHERE run_id=$1 AND organization_id=$2 AND id=ANY($3::bigint[]) AND status='eligible'`,
      [normalizedScanRunId, input.organizationId, input.itemIds],
    );

    await writeAudit(client, {
      organizationId: input.organizationId,
      actorUserId: actor.id,
      action: "storage_maintenance.cleanup_requested",
      entityType: "file_cleanup_run",
      entityId: runId,
      afterData: { sourceScanRunId: normalizedScanRunId, selectedItems: selected.rowCount },
      requestId,
    });
    return { id: runId, status: "queued" };
  });
}

export async function listStorageMaintenanceRuns({ organizationId, page, pageSize, runType }) {
  await ensureOrganization(pool, organizationId);
  const offset = (page - 1) * pageSize;
  const params = [organizationId, runType || "all", pageSize, offset];
  const where = "WHERE run.organization_id=$1 AND ($2='all' OR run.run_type=$2)";
  const [rows, count] = await Promise.all([
    pool.query(
      `${runSelect} ${where} ORDER BY run.created_at DESC,run.id DESC LIMIT $3 OFFSET $4`,
      params,
    ),
    pool.query(
      `SELECT count(*)::int AS total FROM file_cleanup_runs run ${where}`,
      params.slice(0, 2),
    ),
  ]);
  return { data: rows.rows.map(mapRun), total: count.rows[0].total };
}

export async function getStorageMaintenanceRun(
  runId,
  organizationId,
  { page, pageSize, itemKind },
) {
  const normalizedRunId = normalizeRunId(runId);
  const run = await pool.query(`${runSelect} WHERE run.id=$1 AND run.organization_id=$2`, [
    normalizedRunId,
    organizationId,
  ]);
  if (!run.rows[0])
    throw new ServiceError("RUN_NOT_FOUND", "Proses pemeliharaan tidak ditemukan.", 404);
  const offset = (page - 1) * pageSize;
  const params = [normalizedRunId, organizationId, itemKind || "all", pageSize, offset];
  const where = `WHERE item.run_id=$1 AND item.organization_id=$2
    AND ($3='all'
      OR ($3='candidate' AND item.item_kind='candidate' AND item.status='eligible')
      OR ($3 IN ('issue','recovery') AND item.item_kind='issue' AND item.status='needs_review'
        AND item.reason_code<>'malware_infected')
      OR ($3='security' AND item.status='needs_review' AND item.reason_code='malware_infected'))`;
  const itemSelect = `SELECT item.id::text,item.organization_id::text,item.stored_file_id::text,
    item.item_kind,item.status,item.reason_code,item.category,item.size_bytes::text,
    item.mime_type,item.malware_scan_status,item.malware_signature,item.malware_scanned_at,
    item.attempts,item.last_error_code,item.created_at,item.updated_at,
    COALESCE(file.original_name,'File tanpa catatan') AS original_name,
    file.created_at AS uploaded_at,file.deleted_at,file.deletion_reason_code,
    file.content_purged_at,file.lifecycle_status,
    organization.name AS organization_name,
    employee.id::text AS employee_id,employee.full_name AS employee_name,employee.employee_no,
    quarantine.id::text AS quarantine_id,quarantine.purge_after,
    COALESCE(item.reference_labels,'{}'::text[]) AS reference_labels
   FROM file_cleanup_items item
   LEFT JOIN stored_files file ON file.organization_id=item.organization_id AND file.id=item.stored_file_id
   JOIN organizations organization ON organization.id=item.organization_id
   LEFT JOIN employees employee ON employee.organization_id=file.organization_id AND employee.id=file.employee_id
   LEFT JOIN LATERAL (
     SELECT quarantine_item.id,quarantine_item.purge_after
     FROM file_quarantine_items quarantine_item
     WHERE quarantine_item.organization_id=item.organization_id
       AND quarantine_item.status='quarantined'
       AND ((item.stored_file_id IS NOT NULL AND quarantine_item.stored_file_id=item.stored_file_id)
         OR (item.stored_file_id IS NULL AND quarantine_item.original_object_key=item.object_key))
     ORDER BY quarantine_item.id DESC LIMIT 1
   ) quarantine ON true`;
  const [items, count] = await Promise.all([
    pool.query(`${itemSelect} ${where} ORDER BY item.id LIMIT $4 OFFSET $5`, params),
    pool.query(
      `SELECT count(*)::int AS total FROM file_cleanup_items item ${where}`,
      params.slice(0, 3),
    ),
  ]);
  return {
    run: mapRun(run.rows[0]),
    items: items.rows.map(mapItem),
    total: count.rows[0].total,
  };
}

export async function cancelStorageMaintenanceRun(runId, organizationId, actor, requestId) {
  const normalizedRunId = normalizeRunId(runId);
  return withTransaction(async (client) => {
    const cancelled = await client.query(
      `UPDATE file_cleanup_runs SET status='cancelled',completed_at=now()
       WHERE id=$1 AND organization_id=$2 AND status='queued'
       RETURNING id::text`,
      [normalizedRunId, organizationId],
    );
    if (!cancelled.rows[0])
      throw new ServiceError(
        "RUN_NOT_CANCELLABLE",
        "Proses tidak ditemukan atau sudah mulai dijalankan.",
        409,
      );
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "storage_maintenance.cancelled",
      entityType: "file_cleanup_run",
      entityId: normalizedRunId,
      requestId,
    });
    return { id: cancelled.rows[0].id, status: "cancelled" };
  });
}

function normalizeItemId(itemId) {
  if (!/^[1-9][0-9]*$/.test(String(itemId)))
    throw new ServiceError("INVALID_ITEM_ID", "ID file pemeriksaan tidak valid.", 400);
  return String(itemId);
}

async function getMaintenanceItem(database, runId, itemId, organizationId, lock = false) {
  const result = await database.query(
    `SELECT item.*,file.object_key AS stored_object_key,file.original_name,file.mime_type AS stored_mime_type,
      file.sha256,file.lifecycle_status,file.deleted_at,file.deletion_reason_code,
      file.created_at AS file_created_at,file.malware_scan_status AS stored_scan_status,
      file.employee_id::text
     FROM file_cleanup_items item
     LEFT JOIN stored_files file ON file.organization_id=item.organization_id AND file.id=item.stored_file_id
     WHERE item.run_id=$1 AND item.id=$2 AND item.organization_id=$3${lock ? " FOR UPDATE OF item" : ""}`,
    [normalizeRunId(runId), normalizeItemId(itemId), organizationId],
  );
  if (!result.rows[0])
    throw new ServiceError("MAINTENANCE_ITEM_NOT_FOUND", "File pemeriksaan tidak ditemukan.", 404);
  return result.rows[0];
}

const resolveItemPath = (item) =>
  inspectMaintenancePath(uploadRoot, {
    organization_id: item.organization_id,
    object_key: item.stored_object_key || item.object_key,
  });

export async function getMaintenanceItemContent(
  runId,
  itemId,
  organizationId,
  actor,
  requestId,
  { download = false } = {},
) {
  const item = await getMaintenanceItem(pool, runId, itemId, organizationId);
  const scanStatus = item.stored_scan_status || item.malware_scan_status;
  if (scanStatus !== "clean")
    throw new ServiceError(
      "FILE_NOT_SAFE_TO_OPEN",
      "File belum dinyatakan aman dan tidak dapat dibuka atau diunduh.",
      423,
    );
  if (Number(item.size_bytes || 0) > MAINTENANCE_PREVIEW_MAX_BYTES)
    throw new ServiceError(
      "FILE_PREVIEW_TOO_LARGE",
      "File terlalu besar untuk dibuka dari menu ini.",
      413,
    );
  const resolved = await resolveItemPath(item);
  if (!resolved.valid) throw new ServiceError("FILE_PATH_INVALID", "Lokasi file tidak valid.", 409);
  let buffer;
  let fileStat;
  try {
    [buffer, fileStat] = await Promise.all([
      readFile(/* turbopackIgnore: true */ resolved.absolutePath),
      stat(/* turbopackIgnore: true */ resolved.absolutePath),
    ]);
  } catch {
    throw new ServiceError("FILE_CONTENT_MISSING", "Isi file tidak ditemukan di penyimpanan.", 404);
  }
  const currentHash = createHash("sha256").update(buffer).digest("hex");
  const expectedHash = item.sha256?.trim();
  const expectedModifiedAt = item.file_modified_at
    ? new Date(item.file_modified_at).getTime()
    : null;
  if (
    buffer.length !== Number(item.size_bytes || 0) ||
    (expectedHash && currentHash !== expectedHash) ||
    (!expectedHash && expectedModifiedAt && Math.abs(fileStat.mtimeMs - expectedModifiedAt) > 1000)
  )
    throw new ServiceError(
      "FILE_STATE_CHANGED",
      "Isi file berubah setelah pemeriksaan. Jalankan pemeriksaan ulang sebelum membuka file.",
      409,
    );
  const detected = await fileTypeFromBuffer(buffer);
  const mimeType = detected?.mime || item.stored_mime_type || item.mime_type;
  const expectedMime = item.stored_mime_type || item.mime_type;
  if (detected?.mime && expectedMime && detected.mime !== expectedMime)
    throw new ServiceError(
      "FILE_MIME_CHANGED",
      "Jenis isi file tidak lagi sesuai dengan hasil pemeriksaan. Jalankan pemeriksaan ulang.",
      409,
    );
  if (!download && !MAINTENANCE_INLINE_MIMES.includes(mimeType))
    throw new ServiceError(
      "FILE_INLINE_UNSUPPORTED",
      "Format ini tidak dapat dipreview. Gunakan unduh file.",
      415,
    );
  await writeAudit(pool, {
    organizationId,
    actorUserId: actor.id,
    action: download ? "storage_maintenance.file_downloaded" : "storage_maintenance.file_previewed",
    entityType: "file_cleanup_item",
    entityId: item.id,
    afterData: { runId: String(runId), category: item.category },
    requestId,
  });
  return {
    buffer,
    mimeType,
    originalName: item.original_name || `file-${item.id}`,
  };
}

export async function quarantineMaintenanceItem(runId, itemId, organizationId, actor, requestId) {
  const item = await getMaintenanceItem(pool, runId, itemId, organizationId);
  if (item.stored_file_id || !["filesystem_orphan", "temporary_file"].includes(item.reason_code))
    throw new ServiceError(
      "QUARANTINE_NOT_ALLOWED",
      "Hanya file fisik tanpa metadata yang dapat dikarantina melalui aksi ini.",
      409,
    );
  if (item.malware_scan_status !== "clean")
    throw new ServiceError("FILE_NOT_SAFE", "Status keamanan file belum bersih.", 409);
  const resolved = await resolveItemPath(item);
  if (!resolved.valid) throw new ServiceError("FILE_PATH_INVALID", "Lokasi file tidak valid.", 409);
  const currentMetadata = await pool.query(
    "SELECT 1 FROM stored_files WHERE organization_id=$1 AND object_key=$2 LIMIT 1",
    [organizationId, item.object_key],
  );
  if (currentMetadata.rows[0])
    throw new ServiceError(
      "FILE_STATE_CHANGED",
      "File kini sudah memiliki metadata. Jalankan pemeriksaan ulang.",
      409,
    );
  const buffer = await readFile(resolved.absolutePath).catch(() => null);
  if (!buffer) throw new ServiceError("FILE_CONTENT_MISSING", "Isi file tidak ditemukan.", 404);
  const quarantineKey = path.posix.join(
    ".trash",
    "storage-maintenance",
    "quarantine",
    `org_${organizationId}`,
    `${randomUUID()}${path.extname(resolved.absolutePath).slice(0, 12)}`,
  );
  const quarantinePath = path.resolve(uploadRoot, ...quarantineKey.split("/"));
  await mkdir(path.dirname(quarantinePath), { recursive: true });
  await rename(resolved.absolutePath, quarantinePath);
  try {
    return await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO file_quarantine_items(
          organization_id,source_cleanup_item_id,reason,status,original_object_key,
          quarantine_object_key,original_name,mime_type,size_bytes,sha256,malware_scan_status,
          malware_scan_engine,quarantined_by_user_id,purge_after)
         VALUES($1,$2,$3,'quarantined',$4,$5,$6,$7,$8,$9,'clean','clamav',$10,
           now()+($11*interval '1 day')) RETURNING id::text,purge_after`,
        [
          organizationId,
          item.id,
          item.reason_code,
          item.object_key,
          quarantineKey,
          path.basename(item.object_key),
          item.mime_type,
          buffer.length,
          createHash("sha256").update(buffer).digest("hex"),
          actor.id,
          FILE_QUARANTINE_DAYS,
        ],
      );
      await client.query(
        "UPDATE file_cleanup_items SET status='selected',reason_code='quarantined_for_review' WHERE id=$1",
        [item.id],
      );
      await writeAudit(client, {
        organizationId,
        actorUserId: actor.id,
        action: "storage_maintenance.file_quarantined",
        entityType: "file_quarantine_item",
        entityId: inserted.rows[0].id,
        afterData: { sourceItemId: String(item.id), purgeAfter: inserted.rows[0].purge_after },
        requestId,
      });
      return inserted.rows[0];
    });
  } catch (error) {
    await rename(quarantinePath, resolved.absolutePath).catch(() => {});
    throw error;
  }
}

export async function listQuarantineItems(organizationId, { page, pageSize }) {
  const offset = (page - 1) * pageSize;
  const [rows, count] = await Promise.all([
    pool.query(
      `SELECT quarantine.id::text,quarantine.organization_id::text,organization.name AS organization_name,quarantine.reason,quarantine.status,quarantine.original_name,
        quarantine.mime_type,quarantine.size_bytes::text,quarantine.malware_scan_status,
        quarantine.malware_signature,quarantine.quarantined_at,quarantine.purge_after,
        file.employee_id::text,employee.full_name AS employee_name,employee.employee_no
       FROM file_quarantine_items quarantine
       JOIN organizations organization ON organization.id=quarantine.organization_id
       LEFT JOIN stored_files file ON file.organization_id=quarantine.organization_id
         AND file.id=quarantine.stored_file_id
       LEFT JOIN employees employee ON employee.organization_id=file.organization_id
         AND employee.id=file.employee_id
       WHERE quarantine.organization_id=$1 AND quarantine.status='quarantined'
       ORDER BY quarantine.purge_after,quarantine.id LIMIT $2 OFFSET $3`,
      [organizationId, pageSize, offset],
    ),
    pool.query(
      "SELECT count(*)::int AS total FROM file_quarantine_items WHERE organization_id=$1 AND status='quarantined'",
      [organizationId],
    ),
  ]);
  return {
    items: rows.rows.map((row) => {
      const { employee_no: employeeNumber, ...safe } = row;
      return {
        ...safe,
        size_bytes: Number(row.size_bytes || 0),
        employee_no_masked: maskEmployeeNumber(employeeNumber),
        restore_available: row.reason !== "malware",
      };
    }),
    total: count.rows[0].total,
  };
}

/** Serialize restore with purge so only one operation can move the quarantined file. */
export async function restoreQuarantineItem(itemId, organizationId, actor, requestId) {
  const id = normalizeItemId(itemId);
  let moved = null;
  try {
    await withTransaction(async (client) => {
      await lockFileReferences(client);
      const itemResult = await client.query(
        "SELECT * FROM file_quarantine_items WHERE id=$1 AND organization_id=$2 AND status='quarantined' FOR UPDATE",
        [id, organizationId],
      );
      const item = itemResult.rows[0];
      if (!item)
        throw new ServiceError("QUARANTINE_NOT_FOUND", "File karantina tidak ditemukan.", 404);
      if (item.reason === "malware" || item.malware_scan_status === "infected")
        throw new ServiceError(
          "INFECTED_RESTORE_FORBIDDEN",
          "File terinfeksi tidak dapat dipulihkan.",
          409,
        );
      const target = await inspectMaintenancePath(uploadRoot, {
        organization_id: organizationId,
        object_key: item.original_object_key,
      });
      if (!target.valid)
        throw new ServiceError("FILE_PATH_INVALID", "Lokasi pemulihan tidak valid.", 409);
      if (
        !item.quarantine_object_key.startsWith(
          `.trash/storage-maintenance/quarantine/org_${organizationId}/`,
        )
      )
        throw new ServiceError("FILE_PATH_INVALID", "Lokasi karantina tidak valid.", 409);
      const source = await inspectPrivateStoragePath(uploadRoot, item.quarantine_object_key);
      if (!source.valid || !source.exists)
        throw new ServiceError(
          "FILE_CONTENT_MISSING",
          "File karantina tidak dapat diakses. Validasi penyimpanan terlebih dahulu.",
          409,
        );
      if (target.exists)
        throw new ServiceError("RESTORE_TARGET_EXISTS", "Lokasi asal sudah berisi file lain.", 409);
      const hash = createHash("sha256")
        .update(await readFile(source.absolutePath))
        .digest("hex");
      if (hash !== item.sha256)
        throw new ServiceError(
          "FILE_STATE_CHANGED",
          "File berubah. Jalankan pemeriksaan kembali.",
          409,
        );
      await mkdir(path.dirname(target.absolutePath), { recursive: true });
      await rename(source.absolutePath, target.absolutePath);
      moved = { source: source.absolutePath, target: target.absolutePath };
      await client.query(
        `UPDATE file_quarantine_items SET status='restored',restored_at=now(),restored_by_user_id=$3
         WHERE id=$1 AND organization_id=$2 AND status='quarantined'`,
        [id, organizationId, actor.id],
      );
      await writeAudit(client, {
        organizationId,
        actorUserId: actor.id,
        action: "storage_maintenance.quarantine_restored",
        entityType: "file_quarantine_item",
        entityId: id,
        requestId,
      });
    });
  } catch (error) {
    if (moved) await rename(moved.target, moved.source).catch(() => {});
    throw error;
  }
  return { id, status: "restored" };
}

/** Manual purge locks the quarantine record and protects newly restored/referenced content. */
export async function purgeQuarantineItem(itemId, organizationId, actor, requestId) {
  const id = normalizeItemId(itemId);
  return withTransaction(async (client) => {
    await lockFileReferences(client);
    const result = await client.query(
      "SELECT * FROM file_quarantine_items WHERE id=$1 AND organization_id=$2 AND status='quarantined' FOR UPDATE",
      [id, organizationId],
    );
    const item = result.rows[0];
    if (!item)
      throw new ServiceError("QUARANTINE_NOT_FOUND", "File karantina tidak ditemukan.", 404);
    if (
      item.reason !== "malware" &&
      item.stored_file_id &&
      (await findStoredFileReferences(client, organizationId, item.stored_file_id)).length
    )
      throw new ServiceError(
        "FILE_IN_USE",
        "File masih digunakan. Pulihkan file terlebih dahulu.",
        409,
      );
    const prefix = item.reason === "malware" ? "security" : "quarantine";
    const expected = ".trash/storage-maintenance/" + prefix + "/";
    if (!item.quarantine_object_key.startsWith(expected + "org_" + organizationId + "/"))
      throw new ServiceError("FILE_PATH_INVALID", "Lokasi karantina tidak valid.", 409);
    const physical = await inspectPrivateStoragePath(uploadRoot, item.quarantine_object_key);
    if (!physical.valid)
      throw new ServiceError("FILE_PATH_INVALID", "Lokasi karantina tidak valid.", 409);
    if (physical.exists) {
      const hash = createHash("sha256")
        .update(await readFile(physical.absolutePath))
        .digest("hex");
      if (hash !== item.sha256)
        throw new ServiceError(
          "FILE_STATE_CHANGED",
          "File berubah. Jalankan pemeriksaan kembali.",
          409,
        );
      await unlink(physical.absolutePath);
    }
    await client.query(
      "UPDATE file_quarantine_items SET status='purged',purged_at=now(),purged_by_user_id=$3 WHERE id=$1 AND organization_id=$2",
      [id, organizationId, actor.id],
    );
    if (item.stored_file_id)
      await client.query(
        "UPDATE stored_files SET lifecycle_status='purged',deleted_at=COALESCE(deleted_at,now()),content_purged_at=COALESCE(content_purged_at,now()) WHERE id=$1 AND organization_id=$2 AND lifecycle_status='quarantined'",
        [item.stored_file_id, organizationId],
      );
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "storage_maintenance.quarantine_purged",
      entityType: "file_quarantine_item",
      entityId: id,
      requestId,
    });
    return { id, status: "purged" };
  });
}

export async function resolveMaintenanceItem(
  runId,
  itemId,
  organizationId,
  input,
  actor,
  requestId,
) {
  return withTransaction(async (client) => {
    await lockFileReferences(client);
    const item = await getMaintenanceItem(client, runId, itemId, organizationId, true);
    if (!item.stored_file_id)
      throw new ServiceError("FILE_METADATA_REQUIRED", "Aksi ini memerlukan metadata file.", 409);
    if (input.action === "restore_metadata") {
      const references = await findStoredFileReferences(
        client,
        organizationId,
        item.stored_file_id,
      );
      if (!references.length)
        throw new ServiceError(
          "FILE_REFERENCE_MISSING",
          "File tidak lagi memiliki referensi bisnis.",
          409,
        );
      const physical = await inspectMaintenancePath(uploadRoot, {
        organization_id: organizationId,
        object_key: item.stored_object_key,
      });
      if (!physical.valid)
        throw new ServiceError("FILE_STORAGE_UNAVAILABLE", "Penyimpanan tidak dapat diakses.", 409);
      if (!physical.exists)
        throw new ServiceError(
          "FILE_CONTENT_MISSING",
          "File fisik tidak ditemukan. Unggah pemulihan.",
          409,
        );
      if (item.stored_scan_status === "infected")
        throw new ServiceError("FILE_NOT_SAFE", "File terinfeksi tidak dapat dipulihkan.", 409);
      await client.query(
        `UPDATE stored_files SET lifecycle_status='active',deleted_at=NULL,deleted_by_user_id=NULL,
          deletion_reason_code=NULL,retained_at=NULL,retained_by_user_id=NULL,retention_reason=NULL,content_purged_at=NULL
         WHERE id=$1 AND organization_id=$2 AND lifecycle_status IN ('deleted','retained','purged')`,
        [item.stored_file_id, organizationId],
      );
    } else if (input.action === "retain_official") {
      if (!OFFICIAL_HISTORY_CATEGORIES.includes(item.category))
        throw new ServiceError(
          "OFFICIAL_FILE_REQUIRED",
          "File ini bukan dokumen histori resmi.",
          409,
        );
      if (item.malware_scan_status !== "clean")
        throw new ServiceError(
          "FILE_NOT_CLEAN",
          "Dokumen hanya dapat dipertahankan setelah pemeriksaan antivirus menyatakan file bersih.",
          409,
        );
      const resolved = await resolveItemPath(item);
      if (!resolved.valid)
        throw new ServiceError("FILE_PATH_INVALID", "Lokasi file tidak valid.", 409);
      await access(resolved.absolutePath).catch(() => {
        throw new ServiceError("FILE_CONTENT_MISSING", "Isi file tidak ditemukan.", 409);
      });
      await client.query(
        `UPDATE stored_files SET lifecycle_status='retained',deleted_at=COALESCE(deleted_at,now()),
          retained_at=now(),
          retained_by_user_id=$3,retention_reason=$4
         WHERE id=$1 AND organization_id=$2 AND lifecycle_status IN ('active','deleted')`,
        [item.stored_file_id, organizationId, actor.id, input.reason],
      );
    } else if (input.action === "stage_cleanup") {
      if (OFFICIAL_HISTORY_CATEGORIES.includes(item.category))
        throw new ServiceError(
          "OFFICIAL_CLEANUP_FORBIDDEN",
          "Dokumen histori resmi tidak dapat dipindahkan ke pembersihan.",
          409,
        );
      if (!["active_orphan", "category_not_allowed"].includes(item.reason_code))
        throw new ServiceError(
          "CLEANUP_STAGE_NOT_ALLOWED",
          "File ini tidak dapat dipindahkan ke pembersihan.",
          409,
        );
      const references = await findStoredFileReferences(
        client,
        organizationId,
        item.stored_file_id,
      );
      if (references.length)
        throw new ServiceError(
          "FILE_REFERENCE_EXISTS",
          "File kembali digunakan oleh data bisnis.",
          409,
        );
      if (item.stored_scan_status !== "clean")
        throw new ServiceError(
          "FILE_NOT_CLEAN",
          "File harus dinyatakan bersih sebelum dipindahkan.",
          409,
        );
      const resolved = await resolveItemPath(item);
      if (!resolved.valid)
        throw new ServiceError("FILE_PATH_INVALID", "Lokasi file tidak valid.", 409);
      const buffer = await readFile(/* turbopackIgnore: true */ resolved.absolutePath).catch(
        () => null,
      );
      if (!buffer)
        throw new ServiceError(
          "FILE_CONTENT_MISSING",
          "Isi file tidak ditemukan. Jalankan pemeriksaan ulang.",
          409,
        );
      const currentHash = createHash("sha256").update(buffer).digest("hex");
      if (
        buffer.length !== Number(item.size_bytes || 0) ||
        !item.sha256 ||
        currentHash !== item.sha256.trim()
      )
        throw new ServiceError("FILE_STATE_CHANGED", "Isi file berubah setelah pemeriksaan.", 409);
      const detected = await fileTypeFromBuffer(buffer);
      if (detected?.mime && item.stored_mime_type && detected.mime !== item.stored_mime_type)
        throw new ServiceError(
          "FILE_MIME_CHANGED",
          "Jenis isi file berubah setelah pemeriksaan.",
          409,
        );
      const now = Date.now();
      const createdAt = new Date(item.file_created_at).getTime();
      if (item.lifecycle_status === "active" && now - createdAt < 24 * 3_600_000)
        throw new ServiceError("FILE_GRACE_PERIOD", "File belum melewati masa aman 24 jam.", 409);
      const staged = await client.query(
        `UPDATE stored_files SET lifecycle_status='deleted',deleted_at=COALESCE(deleted_at,now()),
          deleted_by_user_id=$3,deletion_reason_code='maintenance_approved'
         WHERE id=$1 AND organization_id=$2 AND lifecycle_status IN ('active','deleted')
         RETURNING id`,
        [item.stored_file_id, organizationId, actor.id],
      );
      if (!staged.rows[0])
        throw new ServiceError(
          "FILE_STATE_CHANGED",
          "Status file berubah. Jalankan pemeriksaan ulang.",
          409,
        );
      const deletedAt = item.deleted_at ? new Date(item.deleted_at).getTime() : now;
      const ready = now - deletedAt >= FILE_CLEANUP_RETENTION_DAYS * 86_400_000;
      await client.query(
        `UPDATE file_cleanup_items SET item_kind=$3,status=$4,reason_code=$5,
          reference_labels='{}'::text[] WHERE id=$1 AND organization_id=$2`,
        [
          item.id,
          organizationId,
          ready ? "candidate" : "issue",
          ready ? "eligible" : "skipped",
          ready ? "maintenance_approved_cleanup" : "cleanup_waiting_period",
        ],
      );
    } else if (input.action === "finalize_cleanup") {
      if (OFFICIAL_HISTORY_CATEGORIES.includes(item.category))
        throw new ServiceError(
          "OFFICIAL_CLEANUP_FORBIDDEN",
          "Dokumen histori resmi yang hilang harus dipulihkan dari backup.",
          409,
        );
      if (item.reason_code !== "unreferenced_content_missing")
        throw new ServiceError(
          "FINALIZE_NOT_ALLOWED",
          "Catatan file ini tidak dapat diselesaikan.",
          409,
        );
      const references = await findStoredFileReferences(
        client,
        organizationId,
        item.stored_file_id,
      );
      if (references.length)
        throw new ServiceError(
          "FILE_REFERENCE_EXISTS",
          "File kembali digunakan oleh data bisnis.",
          409,
        );
      const resolved = await resolveItemPath(item);
      if (!resolved.valid)
        throw new ServiceError("FILE_PATH_INVALID", "Lokasi file tidak valid.", 409);
      const contentExists = resolved.exists;
      if (contentExists)
        throw new ServiceError(
          "FILE_STATE_CHANGED",
          "File fisik ditemukan kembali. Jalankan pemeriksaan ulang.",
          409,
        );
      const finalized = await client.query(
        `UPDATE stored_files SET lifecycle_status='purged',deleted_at=COALESCE(deleted_at,now()),
          deleted_by_user_id=$3,deletion_reason_code='maintenance_approved',
          content_purged_at=COALESCE(content_purged_at,now())
         WHERE id=$1 AND organization_id=$2 AND lifecycle_status IN ('active','deleted')
         RETURNING id`,
        [item.stored_file_id, organizationId, actor.id],
      );
      if (!finalized.rows[0])
        throw new ServiceError(
          "FILE_STATE_CHANGED",
          "Status file berubah. Jalankan pemeriksaan ulang.",
          409,
        );
      await client.query(
        `UPDATE file_cleanup_items SET status='already_absent',reason_code='content_already_absent'
         WHERE id=$1 AND organization_id=$2`,
        [item.id, organizationId],
      );
    }
    await client.query(
      `UPDATE file_purge_jobs SET status='cancelled',completed_at=now(),last_error_code='RESOLVED_BY_ADMIN'
       WHERE stored_file_id=$1 AND organization_id=$2 AND status IN ('queued','retry')`,
      [item.stored_file_id, organizationId],
    );
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: `storage_maintenance.${input.action}`,
      entityType: "stored_file",
      entityId: item.stored_file_id,
      afterData: { reason: input.reason || null, resolution: input.action },
      requestId,
    });
    return { id: String(item.stored_file_id), status: input.action };
  });
}

export async function recoverMaintenanceItemContent(
  runId,
  itemId,
  organizationId,
  file,
  actor,
  requestId,
) {
  if (!file)
    throw new ServiceError("RECOVERY_FILE_REQUIRED", "Pilih file pemulihan dari backup.", 400);
  const item = await getMaintenanceItem(pool, runId, itemId, organizationId);
  if (
    !item.stored_file_id ||
    !["active_content_missing", "unreferenced_content_missing"].includes(item.reason_code)
  )
    throw new ServiceError(
      "CONTENT_RECOVERY_NOT_ALLOWED",
      "Pemulihan byte hanya tersedia untuk file aktif yang isinya hilang.",
      409,
    );
  if (item.lifecycle_status !== "active")
    throw new ServiceError(
      "FILE_STATE_CHANGED",
      "Status file telah berubah. Jalankan pemeriksaan ulang.",
      409,
    );
  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(buffer);
  const detectedMime = detected?.mime || "application/octet-stream";
  const expectedMime = item.stored_mime_type || item.mime_type;
  const expectedHash = item.sha256?.trim();
  const currentHash = createHash("sha256").update(buffer).digest("hex");
  if (
    buffer.length !== Number(item.size_bytes || 0) ||
    !expectedHash ||
    currentHash !== expectedHash ||
    !expectedMime ||
    detectedMime !== expectedMime
  )
    throw new ServiceError(
      "RECOVERY_FILE_MISMATCH",
      "File backup tidak cocok dengan hash, ukuran, atau jenis dokumen yang tercatat.",
      422,
    );
  const scan = await scanUploadBuffer(buffer);
  if (scan.status !== "clean")
    throw new ServiceError(
      "RECOVERY_SCAN_INCOMPLETE",
      "File pemulihan belum dinyatakan bersih oleh ClamAV.",
      503,
    );
  const resolved = await resolveItemPath(item);
  if (!resolved.valid)
    throw new ServiceError("FILE_PATH_INVALID", "Lokasi pemulihan tidak valid.", 409);
  await access(resolved.absolutePath)
    .then(() => {
      throw new ServiceError(
        "RECOVERY_TARGET_EXISTS",
        "Isi file sudah tersedia. Jalankan pemeriksaan ulang sebelum melakukan tindakan lain.",
        409,
      );
    })
    .catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  await mkdir(path.dirname(resolved.absolutePath), { recursive: true });
  const temporaryPath = `${resolved.absolutePath}.${randomUUID()}.recovery`;
  await writeFile(temporaryPath, buffer, { flag: "wx" });
  await link(temporaryPath, resolved.absolutePath).catch(async (error) => {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  });
  await unlink(temporaryPath);
  try {
    await withTransaction(async (client) => {
      const current = await getMaintenanceItem(client, runId, itemId, organizationId, true);
      if (
        !["active_content_missing", "unreferenced_content_missing"].includes(current.reason_code) ||
        current.lifecycle_status !== "active"
      )
        throw new ServiceError(
          "FILE_STATE_CHANGED",
          "Status file berubah selama pemulihan. Jalankan pemeriksaan ulang.",
          409,
        );
      await client.query(
        `UPDATE stored_files SET malware_scan_status='clean',malware_scan_engine=$3,
          malware_scanned_at=now(),malware_signature=NULL
         WHERE id=$1 AND organization_id=$2`,
        [item.stored_file_id, organizationId, scan.engine],
      );
      await client.query(
        `UPDATE file_cleanup_items SET status='skipped',reason_code='content_restored',updated_at=now()
         WHERE id=$1 AND organization_id=$2`,
        [item.id, organizationId],
      );
      await writeAudit(client, {
        organizationId,
        actorUserId: actor.id,
        action: "storage_maintenance.content_recovered",
        entityType: "stored_file",
        entityId: item.stored_file_id,
        afterData: { sourceRunId: String(runId) },
        requestId,
      });
    });
  } catch (error) {
    await unlink(resolved.absolutePath).catch(() => {});
    throw error;
  }
  return { id: String(item.stored_file_id), status: "content_restored" };
}
