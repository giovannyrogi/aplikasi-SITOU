import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import pool from "@/lib/dbConfig";
import { requireRole, resolveOrganizationAccess } from "@/app/utils/auth";
import { getRequestId, errorResponse } from "@/lib/api/routeHelpers";
import { writeAudit } from "@/lib/audit";
import { requireScheduleAccess } from "@/lib/work-schedules/repository";
import { getPrivateUploadRoot } from "@/lib/files/localLifecycle.mjs";
import { inspectPrivateStoragePath } from "@/lib/storage-maintenance/shared.mjs";
import { pdfError } from "./pdf-process.mjs";

export async function holidayPdfDocument(request, id, importPreview = false) {
  const auth = await requireRole(importPreview ? ["superadmin"] : ["superadmin", "hrd"]);
  if (auth.response) return auth.response;
  const requestId = getRequestId(request);
  try {
    if (
      importPreview
        ? !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        : !/^\d{1,18}$/.test(id)
    )
      throw pdfError("NOT_FOUND", "Dokumen tidak ditemukan.", 404);
    const q = new URL(request.url).searchParams;
    if ([...q.keys()].some((k) => !["organizationId", "download"].includes(k)))
      throw pdfError("VALIDATION_ERROR", "Permintaan tidak valid.", 400);
    const reference = (
      await pool.query(
        importPreview
          ? "SELECT file_id AS source_file_id,year,status FROM holiday_pdf_imports WHERE id=$1 AND status IN ('ready','incomplete')"
          : "SELECT source_file_id,year,status,revision FROM holiday_catalogs WHERE id=$1",
        [id],
      )
    ).rows[0];
    if (!reference?.source_file_id) throw pdfError("NOT_FOUND", "Dokumen belum tersedia.", 404);
    if (auth.user.role_code !== "superadmin") {
      if (reference.status !== "published")
        throw pdfError("FORBIDDEN", "Dokumen belum diterbitkan.", 403);
      const scope = resolveOrganizationAccess(auth.user, q.get("organizationId") || undefined);
      if (scope.response) return scope.response;
      await requireScheduleAccess(pool, auth.user, String(scope.organizationId), "work-calendars");
    }
    const file = (
      await pool.query(
        "SELECT * FROM stored_files WHERE id=$1 AND ownership_scope='platform' AND category='holiday_catalog_source' AND deleted_at IS NULL AND lifecycle_status IN ('draft','active')",
        [reference.source_file_id],
      )
    ).rows[0];
    if (
      !file ||
      (process.env.NODE_ENV === "production" && file.malware_scan_status !== "clean") ||
      file.malware_scan_status === "infected"
    )
      throw pdfError("FILE_UNAVAILABLE", "Dokumen belum dapat dibuka.", 403);
    const physical = await inspectPrivateStoragePath(getPrivateUploadRoot(), file.object_key);
    if (!physical.valid || !physical.exists)
      throw pdfError("FILE_UNAVAILABLE", "Dokumen belum dapat dibuka.", 404);
    await writeAudit(pool, {
      actorUserId: auth.user.id,
      organizationId: auth.user.organization_id || null,
      action:
        q.get("download") === "1"
          ? "holiday_catalog.document_download"
          : "holiday_catalog.document_view",
      entityType: "stored_file",
      entityId: file.id,
      requestId,
      afterData: {
        year: reference.year,
        catalogId: importPreview ? null : id,
        importId: importPreview ? id : null,
      },
    });
    return new Response(Readable.toWeb(createReadStream(physical.absolutePath)), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(physical.details.size),
        "Content-Disposition": `${q.get("download") === "1" ? "attachment" : "inline"}; filename="SKB-${reference.year}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'; frame-ancestors 'self'",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    return errorResponse(
      e.code || "DOCUMENT_ERROR",
      e.status ? e.message : "Dokumen belum dapat dibuka.",
      e.status || 500,
      requestId,
    );
  }
}
