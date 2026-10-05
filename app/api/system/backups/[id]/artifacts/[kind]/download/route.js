import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import { Readable } from "node:stream";
import pool from "@/lib/dbConfig";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/permissions";
import { errorResponse, getRequestId, handleRouteError } from "@/lib/api/routeHelpers";
import { artifactPath, backupPaths } from "@/lib/system-backup/paths.mjs";

export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("system_backup.manage");
  if (response) return response;
  try {
    const { id, kind } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
        !["database_zip", "uploads_zip"].includes(kind))
      return errorResponse("BACKUP_ARTIFACT_INVALID", "Unduhan backup tidak valid.", 400, requestId);
    const result = await pool.query(`SELECT j.status,a.status AS artifact_status,
      a.internal_path,a.size_bytes,a.sha256 FROM system_backup_jobs j
      JOIN system_backup_artifacts a ON a.job_id=j.id AND a.kind=$2
      WHERE j.id=$1::uuid`, [id, kind]);
    const item = result.rows[0];
    if (!item || !["ready", "ready_with_warnings"].includes(item.status) || item.artifact_status !== "ready")
      return errorResponse("BACKUP_UNAVAILABLE", "ZIP belum tersedia atau telah dihapus.", 404, requestId);
    const expected = artifactPath(backupPaths().backupRoot, id, kind);
    if (item.internal_path !== expected)
      return errorResponse("BACKUP_PATH_INVALID", "Lokasi ZIP backup tidak valid.", 503, requestId);
    const metadata = await lstat(expected);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size !== Number(item.size_bytes))
      return errorResponse("BACKUP_FILE_INVALID", "ZIP backup di server tidak sesuai. Buat backup baru.", 503, requestId);
    const range = request.headers.get("range");
    let start = 0; let end = metadata.size - 1;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) return errorResponse("RANGE_INVALID", "Rentang unduhan tidak valid.", 416, requestId);
      start = Number(match[1]); end = match[2] ? Number(match[2]) : end;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || end >= metadata.size)
        return errorResponse("RANGE_INVALID", "Rentang unduhan tidak valid.", 416, requestId);
    }
    const client = await pool.connect();
    try {
      await writeAudit(client, { actorUserId: user.id, action: "system_backup.artifact_downloaded",
        entityType: "system_backup_job", entityId: id, requestId,
        afterData: { kind, partial: Boolean(range) } });
    } finally { client.release(); }
    return new Response(Readable.toWeb(createReadStream(expected, { start, end })), {
      status: range ? 206 : 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="sitou-${kind === "database_zip" ? "database" : "uploads"}-${id}.zip"`,
        "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes",
        ...(range ? { "Content-Range": `bytes ${start}-${end}/${metadata.size}` } : {}),
        "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
      },
    });
  } catch (error) {
    if (error.code === "ENOENT")
      return errorResponse("BACKUP_FILE_MISSING", "ZIP backup tidak ditemukan. Buat backup baru.", 503, requestId);
    return handleRouteError("system-backup.artifact-download", error, requestId);
  }
}
