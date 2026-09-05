import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import {
  FILE_CATEGORY_LABELS,
  FILE_CLEANUP_REASON_LABELS,
  FILE_DELETION_REASON_LABELS,
  maskEmployeeNumber,
} from "@/lib/storage-maintenance/policy.mjs";

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
  return {
    ...safeRow,
    size_bytes: Number(row.size_bytes || 0),
    category_label: FILE_CATEGORY_LABELS[row.category] || "File profil",
    reason_label: FILE_CLEANUP_REASON_LABELS[row.reason_code] || "Perlu diperiksa",
    deletion_reason_label:
      FILE_DELETION_REASON_LABELS[row.deletion_reason_code] || "Alasan tidak tersedia",
    employee_no_masked: maskEmployeeNumber(employeeNumber),
    reference_labels: row.reference_labels || [],
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

export async function getStorageMaintenanceSummary(organizationId) {
  await ensureOrganization(pool, organizationId);
  const result = await pool.query(
    `SELECT organization.id::text,organization.name,
      latest_scan.id::text AS latest_scan_id,latest_scan.status AS latest_scan_status,
      COALESCE((SELECT count(*)::int FROM file_cleanup_items item
        WHERE item.run_id=latest_scan.id AND item.status='eligible'),0) AS candidate_items,
      COALESCE((SELECT count(*)::int FROM file_cleanup_items item
        WHERE item.run_id=latest_scan.id AND item.item_kind='issue'),0) AS issue_items,
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
     ) latest_cleanup ON true
     WHERE organization.id=$1`,
    [organizationId],
  );
  const row = result.rows[0];
  return {
    ...row,
    candidate_items: row.candidate_items || 0,
    issue_items: row.issue_items || 0,
    candidate_bytes: Number(row.candidate_bytes || 0),
    cleaned_items: row.cleaned_items || 0,
    cleaned_bytes: Number(row.cleaned_bytes || 0),
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
        "Masih ada pemeriksaan atau pembersihan yang sedang diproses untuk organisasi ini.",
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
      `SELECT id,stored_file_id,category,size_bytes
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
           organization_id,run_id,stored_file_id,item_kind,status,reason_code,category,size_bytes)
         VALUES($1,$2,$3,'candidate','queued','retention_expired_unreferenced',$4,$5)`,
        [input.organizationId, runId, item.stored_file_id, item.category, item.size_bytes],
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
    AND ($3='all' OR item.item_kind=$3)`;
  const itemSelect = `SELECT item.id::text,item.stored_file_id::text,item.item_kind,item.status,
    item.reason_code,item.category,item.size_bytes::text,item.attempts,item.last_error_code,
    item.created_at,item.updated_at,file.original_name,file.created_at AS uploaded_at,
    file.deleted_at,file.deletion_reason_code,file.content_purged_at,
    organization.name AS organization_name,
    employee.full_name AS employee_name,employee.employee_no,
    COALESCE(item.reference_labels,'{}'::text[]) AS reference_labels
   FROM file_cleanup_items item
   JOIN stored_files file ON file.organization_id=item.organization_id AND file.id=item.stored_file_id
   JOIN organizations organization ON organization.id=item.organization_id
   LEFT JOIN employees employee ON employee.organization_id=file.organization_id AND employee.id=file.employee_id`;
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
