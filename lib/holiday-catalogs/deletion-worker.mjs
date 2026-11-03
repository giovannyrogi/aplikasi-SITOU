import { unlink } from "node:fs/promises";
import { inspectPrivateStoragePath } from "../storage-maintenance/shared.mjs";

/** A database lock is the lease: a crashed worker rolls back and another can retry. */
export async function purgeDeletedHolidayPdf(pool, root) {
  const db = await pool.connect();
  let fileId;
  try {
    await db.query("BEGIN");
    const job = (
      await db.query(
        "SELECT file_id::text FROM holiday_pdf_purge_jobs WHERE next_attempt_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
      )
    ).rows[0];
    if (!job) {
      await db.query("COMMIT");
      return false;
    }
    fileId = job.file_id;
    const imports = await db.query(
      "SELECT id,status FROM holiday_pdf_imports WHERE file_id=$1 FOR UPDATE",
      [fileId],
    );
    const file = (await db.query("SELECT * FROM stored_files WHERE id=$1 FOR UPDATE", [fileId]))
      .rows[0];
    if (
      !file ||
      file.ownership_scope !== "platform" ||
      file.category !== "holiday_catalog_source" ||
      file.storage_provider !== "local_private" ||
      file.malware_scan_status === "infected" ||
      file.lifecycle_status !== "deleted"
    )
      throw Object.assign(new Error("Invalid purge ownership"), { code: "INVALID_PURGE_STATE" });
    if (
      imports.rows.some((i) => ["running", "queued"].includes(i.status)) ||
      (await db.query("SELECT 1 FROM holiday_catalogs WHERE source_file_id=$1", [fileId])).rowCount
    )
      throw Object.assign(new Error("Referenced source"), { code: "SOURCE_REFERENCED" });
    const physical = await inspectPrivateStoragePath(root, file.object_key);
    if (!String(file.object_key).startsWith("platform/holiday_catalogs/") || !physical.valid)
      throw Object.assign(new Error("Unsafe purge path"), { code: "UNSAFE_STORAGE_PATH" });
    if (physical.exists) await unlink(physical.absolutePath);
    await db.query("DELETE FROM holiday_pdf_imports WHERE file_id=$1", [fileId]);
    await db.query("DELETE FROM holiday_pdf_purge_jobs WHERE file_id=$1", [fileId]);
    await db.query("DELETE FROM stored_files WHERE id=$1", [fileId]);
    await db.query(
      `UPDATE holiday_deletions SET result=jsonb_set(jsonb_set(result,'{cleanupPending}','false'),'{message}',to_jsonb('Data berhasil dihapus permanen.'::text)) WHERE cleanup_file_id=$1`,
      [fileId],
    );
    await db.query(
      `INSERT INTO audit_logs(action,entity_type,entity_id,after_data) VALUES('holiday_catalog.pdf_purged','stored_file',$1,'{"actor":"system"}')`,
      [fileId],
    );
    await db.query("COMMIT");
    return true;
  } catch (e) {
    await db.query("ROLLBACK");
    if (fileId) {
      await pool.query(
        `UPDATE holiday_pdf_purge_jobs SET attempts=attempts+1,next_attempt_at=now()+interval '30 seconds',last_error=$2 WHERE file_id=$1`,
        [fileId, String(e.code || "PURGE_FAILED").slice(0, 80)],
      );
      console.error("[holiday-pdf.purge]", { code: e.code || "PURGE_FAILED" });
      return false;
    }
    throw e;
  } finally {
    db.release();
  }
}
