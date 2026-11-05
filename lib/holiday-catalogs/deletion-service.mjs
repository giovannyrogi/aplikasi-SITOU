import { createHash } from "node:crypto";
import { lockCatalogYear } from "./yearPolicy.mjs";

export const deletionMessages = {
  CATALOG_USED: "Katalog tidak dapat dihapus karena pernah digunakan pada kalender organisasi.",
  CALENDAR_USED: "Kalender tidak dapat dihapus karena pernah digunakan pada jadwal kerja.",
  HISTORY_UNVERIFIED: "Data belum dapat dihapus karena riwayat penggunaannya perlu diperiksa.",
  DOCUMENT_BUSY: "Dokumen masih diproses. Tunggu proses selesai, lalu coba lagi.",
  DOCUMENT_QUARANTINED:
    "Dokumen sedang dikarantina. Selesaikan penanganan keamanan sebelum menghapus katalog.",
  DOCUMENT_UNSAFE: "Dokumen sumber perlu diperiksa sebelum katalog dapat dihapus.",
  VERSION_CONFLICT: "Data telah berubah. Muat ulang, lalu periksa kembali sebelum menghapus.",
  ALREADY_DELETED: "Data sudah dihapus. Daftar akan diperbarui.",
  FORBIDDEN: "Anda tidak memiliki izin untuk menghapus data ini.",
};
function fail(code, status = 409) {
  throw Object.assign(new Error(deletionMessages[code]), { code, status });
}
const digest = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function assertDeletionAdmin(actor) {
  if (actor.role_code !== "superadmin") fail("FORBIDDEN", 403);
}

// Called only inside a transaction. Usage writers lock these same parent rows.
export async function deletionPreview(db, actor, kind, id, org) {
  assertDeletionAdmin(actor);
  const row = (
    await db.query(
      kind === "catalog"
        ? "SELECT *,id::text,source_file_id::text FROM holiday_catalogs WHERE id=$1 FOR UPDATE"
        : "SELECT *,id::text FROM work_calendars WHERE id=$1 AND organization_id=$2 FOR UPDATE",
      kind === "catalog" ? [id] : [id, org],
    )
  ).rows[0];
  if (!row) fail("ALREADY_DELETED", 404);
  const usages = (
    await db.query(
      kind === "catalog"
        ? `SELECT u.calendar_name AS name,o.name AS organization,count(*) OVER()::int AS total
       FROM holiday_catalog_usage u JOIN organizations o ON o.id=u.organization_id WHERE catalog_id=$1 ORDER BY first_used_at LIMIT 20`
        : `SELECT source_name AS name,source_type,count(*) OVER()::int AS total
       FROM work_calendar_usage WHERE calendar_id=$1 AND organization_id=$2 ORDER BY first_used_at LIMIT 20`,
      kind === "catalog" ? [id] : [id, org],
    )
  ).rows;
  let code = usages.length
    ? kind === "catalog"
      ? "CATALOG_USED"
      : "CALENDAR_USED"
    : !row.deletion_history_verified
      ? "HISTORY_UNVERIFIED"
      : null;
  let document = null,
    remainingRevision = null;
  if (kind === "catalog") {
    remainingRevision =
      (
        await db.query(
          "SELECT revision FROM holiday_catalogs WHERE year=$1 AND id<>$2 AND status='published' ORDER BY revision DESC LIMIT 1",
          [row.year, id],
        )
      ).rows[0]?.revision || null;
    if (row.source_file_id) {
      // Match save/expiry lock ordering: import, then file. Prevent attaching a purge candidate.
      const imports = await db.query(
        "SELECT id,status FROM holiday_pdf_imports WHERE file_id=$1 FOR UPDATE",
        [row.source_file_id],
      );
      const file = (
        await db.query(
          "SELECT id,original_name,ownership_scope,category,lifecycle_status,malware_scan_status,storage_provider FROM stored_files WHERE id=$1 FOR UPDATE",
          [row.source_file_id],
        )
      ).rows[0];
      const shared = Number(
        (
          await db.query(
            "SELECT count(*) FROM holiday_catalogs WHERE source_file_id=$1 AND id<>$2",
            [row.source_file_id, id],
          )
        ).rows[0].count,
      );
      document = { name: file?.original_name || "PDF SKB", shared: shared > 0 };
      if (
        !file ||
        file.ownership_scope !== "platform" ||
        file.category !== "holiday_catalog_source" ||
        file.storage_provider !== "local_private"
      )
        code ||= "DOCUMENT_UNSAFE";
      if (file?.lifecycle_status === "quarantined" || file?.malware_scan_status === "infected")
        code ||= "DOCUMENT_QUARANTINED";
      if (imports.rows.some((i) => ["queued", "running"].includes(i.status)))
        code ||= "DOCUMENT_BUSY";
    }
  }
  const organization =
    kind === "calendar"
      ? (await db.query("SELECT name FROM organizations WHERE id=$1", [org])).rows[0]?.name
      : null;
  return {
    row,
    data: {
      id,
      kind,
      version: row.version,
      name: kind === "catalog" ? `Katalog ${row.year} · Revisi ${row.revision}` : row.name,
      organization,
      eligible: !code,
      code,
      message: code
        ? deletionMessages[code]
        : "Data ini belum pernah digunakan dan dapat dihapus permanen.",
      usages,
      usageCount: usages[0]?.total || 0,
      document,
      remainingRevision,
      revisionEffect:
        kind === "catalog" && row.status === "published"
          ? remainingRevision
            ? `Setelah dihapus, revisi terbit ${remainingRevision} tersedia untuk tahun ${row.year}.`
            : `Tahun ${row.year} tidak lagi memiliki katalog terbit.`
          : null,
    },
  };
}

export async function deletionReceipt(db, actor, kind, id, org, requestKey) {
  assertDeletionAdmin(actor);
  const row = (
    await db.query(
      "SELECT kind,target_id::text,organization_id::text,result,cleanup_file_id::text FROM holiday_deletions WHERE actor_user_id=$1 AND request_key=$2",
      [actor.id, requestKey],
    )
  ).rows[0];
  if (!row) return { state: "not_found" };
  if (row.kind !== kind || row.target_id !== id || (row.organization_id || null) !== (org || null))
    fail("FORBIDDEN", 403);
  const result = { state: "deleted", ...row.result };
  if (result.cleanupPending && row.cleanup_file_id) {
    const job = (
      await db.query("SELECT attempts FROM holiday_pdf_purge_jobs WHERE file_id=$1", [
        row.cleanup_file_id,
      ])
    ).rows[0];
    if (job?.attempts > 0)
      result.message =
        "Data berhasil dihapus. Pembersihan dokumen tertunda karena kendala layanan dan akan dicoba kembali.";
  }
  return result;
}

export async function deleteHoliday(db, actor, kind, id, org, input, requestId) {
  assertDeletionAdmin(actor);
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,71))", [
    `${actor.id}:${input.requestKey}`,
  ]);
  const payloadHash = digest({ kind, id, org: org || null, version: input.version });
  const prior = (
    await db.query(
      "SELECT payload_hash,result FROM holiday_deletions WHERE actor_user_id=$1 AND request_key=$2",
      [actor.id, input.requestKey],
    )
  ).rows[0];
  if (prior) {
    if (prior.payload_hash !== payloadHash) fail("VERSION_CONFLICT");
    return prior.result;
  }
  if (kind === "catalog") {
    const { rows } = await db.query("SELECT year FROM holiday_catalogs WHERE id=$1", [id]);
    if (!rows[0]) fail("ALREADY_DELETED", 404);
    await lockCatalogYear(db, rows[0].year);
  }
  const { row, data } = await deletionPreview(db, actor, kind, id, org);
  if (!data.eligible) fail(data.code);
  if (row.version !== input.version) fail("VERSION_CONFLICT");
  await db.query(
    `INSERT INTO holiday_deletions(actor_user_id,request_key,kind,target_id,organization_id,version,payload_hash)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [actor.id, input.requestKey, kind, id, org || null, input.version, payloadHash],
  );
  let cleanupPending = false;
  if (kind === "catalog") {
    await db.query("DELETE FROM holiday_catalog_days WHERE catalog_id=$1", [id]);
    await db.query("DELETE FROM holiday_catalogs WHERE id=$1", [id]);
    // Keep a minimal tombstone instead of replaying a deleted save/publication.
    await db.query(
      `UPDATE holiday_catalog_requests SET result=jsonb_build_object('id',$1::text,'deleted',true)
      WHERE result->>'id'=$1`,
      [id],
    );
    if (row.source_file_id && !data.document.shared) {
      cleanupPending = true;
      await db.query(
        `UPDATE holiday_pdf_imports SET status='expired',stage='expired',result=NULL WHERE file_id=$1`,
        [row.source_file_id],
      );
      await db.query(
        `UPDATE stored_files SET lifecycle_status='deleted',deleted_at=now(),deletion_reason_code='holiday_catalog_deleted' WHERE id=$1 AND ownership_scope='platform' AND category='holiday_catalog_source'`,
        [row.source_file_id],
      );
      await db.query(
        "INSERT INTO holiday_pdf_purge_jobs(file_id) VALUES($1) ON CONFLICT DO NOTHING",
        [row.source_file_id],
      );
    }
  } else {
    await db.query("DELETE FROM work_calendar_days WHERE organization_id=$1 AND calendar_id=$2", [
      org,
      id,
    ]);
    await db.query("DELETE FROM work_calendars WHERE organization_id=$1 AND id=$2", [org, id]);
    await db.query(
      `UPDATE work_schedule_requests SET result=jsonb_build_object('id',$2::text,'deleted',true)
      WHERE organization_id=$1 AND operation='calendars.save' AND result->>'id'=$2`,
      [org, id],
    );
  }
  const result = {
    deleted: true,
    cleanupPending,
    message: cleanupPending
      ? "Data berhasil dihapus. Pembersihan dokumen masih diproses."
      : "Data berhasil dihapus permanen.",
  };
  await db.query(
    `INSERT INTO audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,request_id)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [
      org || null,
      actor.id,
      `holiday_${kind}.delete`,
      `holiday_${kind}`,
      id,
      JSON.stringify({
        name: data.name,
        version: row.version,
        requestKey: input.requestKey,
        cleanupPending,
      }),
      requestId,
    ],
  );
  await db.query(
    `UPDATE holiday_deletions SET result=$3,cleanup_file_id=$4 WHERE actor_user_id=$1 AND request_key=$2`,
    [actor.id, input.requestKey, result, cleanupPending ? row.source_file_id : null],
  );
  return result;
}
