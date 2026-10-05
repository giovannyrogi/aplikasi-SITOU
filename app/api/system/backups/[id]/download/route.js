import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import { Readable } from "node:stream";
import pool from "@/lib/dbConfig";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/permissions";
import { errorResponse, getRequestId, handleRouteError } from "@/lib/api/routeHelpers";
import { backupPaths, packagePath } from "@/lib/system-backup/paths.mjs";

/** Range download diautentikasi ulang dan diaudit pada setiap permintaan. */
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("system_backup.manage");
  if (response) return response;
  try {
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      return errorResponse("BACKUP_ID_INVALID", "ID backup tidak valid.", 400, requestId);
    const result = await pool.query(
      `SELECT id::text,status,package_path FROM system_backup_jobs WHERE id=$1::uuid`, [id]);
    const job = result.rows[0];
    if (!job || !["ready", "ready_with_warnings"].includes(job.status))
      return errorResponse("BACKUP_UNAVAILABLE", "Paket backup tidak tersedia atau telah dihapus.", 404, requestId);
    const expected = packagePath(backupPaths().backupRoot, id);
    if (job.package_path !== expected)
      return errorResponse("BACKUP_PATH_INVALID", "Lokasi paket backup tidak valid.", 503, requestId);
    let size;
    try {
      const file = await lstat(expected);
      if (!file.isFile())
        return errorResponse("BACKUP_FILE_INVALID", "Paket backup tidak valid di server.", 503, requestId);
      size = file.size;
    }
    catch (error) {
      if (error.code === "ENOENT")
        return errorResponse("BACKUP_FILE_MISSING", "Paket backup tidak ditemukan di server. Buat backup baru.", 503, requestId);
      throw error;
    }
    const range = request.headers.get("range");
    let start = 0;
    let end = size - 1;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) return errorResponse("RANGE_INVALID", "Rentang unduhan tidak valid.", 416, requestId);
      start = Number(match[1]);
      end = match[2] ? Number(match[2]) : end;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || end >= size)
        return errorResponse("RANGE_INVALID", "Rentang unduhan tidak valid.", 416, requestId);
    }
    const client = await pool.connect();
    try {
      await writeAudit(client, {
        actorUserId: user.id, action: "system_backup.downloaded",
        entityType: "system_backup_job", entityId: id, requestId,
        afterData: { partial: Boolean(range) },
      });
    } finally { client.release(); }
    return new Response(Readable.toWeb(createReadStream(expected, { start, end })), {
      status: range ? 206 : 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="sitou-backup-${id}.sitou-backup"`,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
        ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
      },
    });
  } catch (error) {
    return handleRouteError("system-backup.download", error, requestId);
  }
}
