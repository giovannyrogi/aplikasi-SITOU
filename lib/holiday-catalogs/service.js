import { createHash } from "node:crypto";
import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { requireScheduleAccess, organization } from "@/lib/work-schedules/repository";

function admin(actor) {
  if (actor.role_code !== "superadmin")
    throw new ServiceError("FORBIDDEN", "Khusus Admin SITOU.", 403);
}
const conflict = () => {
  throw new ServiceError(
    "VERSION_CONFLICT",
    "Katalog berubah. Muat ulang sebelum melanjutkan.",
    409,
  );
};
async function dates(db, id) {
  return (
    await db.query(
      "SELECT id::text,date(holiday_date)::text AS date,name,category FROM holiday_catalog_days WHERE catalog_id=$1 ORDER BY holiday_date",
      [id],
    )
  ).rows;
}
export async function listCatalogs(actor, { year, page = 1, pageSize = 20 }) {
  admin(actor);
  const values = year ? [year] : [];
  const where = year ? "WHERE c.year=$1" : "";
  const total = Number(
    (await pool.query(`SELECT count(*) FROM holiday_catalogs c ${where}`, values)).rows[0].count,
  );
  const rows = (
    await pool.query(
      `SELECT c.*,c.id::text,u.full_name AS publisher_name,
    (SELECT count(*)::int FROM holiday_catalog_days d WHERE d.catalog_id=c.id) AS day_count
    FROM holiday_catalogs c LEFT JOIN platform_user_profiles u ON u.user_id=c.published_by_user_id ${where}
    ORDER BY c.year DESC,c.revision DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, pageSize, (page - 1) * pageSize],
    )
  ).rows;
  // Each revision is bounded to 366 dates. Keep immutable source IDs as strings.
  for (const row of rows) {
    row.days = await dates(pool, row.id);
    row.document = await catalogDocument(pool, row.source_file_id);
  }
  return {
    data: rows,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}
export async function readCatalog(actor, org, year) {
  await requireScheduleAccess(pool, actor, org, "work-calendars");
  const info = await organization(pool, org);
  const selectedYear = year || Number(info.today.slice(0, 4));
  const catalog =
    (
      await pool.query(
        "SELECT id::text,year,revision,decision_number,source_url,published_at,source_file_id FROM holiday_catalogs WHERE year=$1 AND status='published' ORDER BY revision DESC LIMIT 1",
        [selectedYear],
      )
    ).rows[0] || null;
  if (catalog) {
    catalog.days = await dates(pool, catalog.id);
    catalog.document = await catalogDocument(pool, catalog.source_file_id);
  }
  return { today: info.today, year: selectedYear, catalog };
}
export async function mutateCatalog(actor, input, requestId) {
  admin(actor);
  return withTransaction(async (db) => {
    // Serialize catalog changes per year, including first publication and concurrent revisions.
    await db.query("SELECT pg_advisory_xact_lock(69000,$1)", [input.year]);
    // Same key cannot create drafts in two years concurrently.
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,69))", [
      `${actor.id}:${input.requestKey}`,
    ]);
    const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const receipt = (
      await db.query(
        "SELECT payload_hash,result FROM holiday_catalog_requests WHERE actor_user_id=$1 AND request_key=$2",
        [actor.id, input.requestKey],
      )
    ).rows[0];
    if (receipt) {
      if (receipt.payload_hash !== hash) conflict();
      if (receipt.result.deleted)
        throw new ServiceError("ALREADY_DELETED", "Data sudah dihapus. Daftar akan diperbarui.", 409);
      return receipt.result;
    }
    const old = input.id
      ? (
          await db.query("SELECT *,id::text FROM holiday_catalogs WHERE id=$1 FOR UPDATE", [
            input.id,
          ])
        ).rows[0]
      : null;
    if (input.id && (!old || old.year !== input.year || old.version !== input.version)) conflict();
    if (old?.status === "published")
      throw new ServiceError(
        "PUBLISHED_IMMUTABLE",
        "Katalog terbit tidak dapat diubah. Buat revisi baru.",
        409,
      );
    let pdf = null;
    if (input.pdfImportId) {
      pdf = (
        await db.query(
          `SELECT i.*,f.sha256,f.malware_scan_status,f.deleted_at,f.lifecycle_status FROM holiday_pdf_imports i JOIN stored_files f ON f.id=i.file_id WHERE i.id=$1 FOR UPDATE OF i,f`,
          [input.pdfImportId],
        )
      ).rows[0];
      if (
        !pdf ||
        pdf.year !== input.year ||
        pdf.result?.yearMismatch ||
        !["ready", "incomplete"].includes(pdf.status) ||
        pdf.deleted_at ||
        pdf.lifecycle_status === "purged" ||
        (process.env.NODE_ENV === "production" && pdf.malware_scan_status !== "clean")
      )
        throw new ServiceError(
          "INVALID_PDF_SOURCE",
          "PDF belum siap atau tidak sesuai tahun katalog.",
          422,
        );
      if (input.pdfReviewed !== true)
        throw new ServiceError(
          "PDF_REVIEW_REQUIRED",
          "Cocokkan seluruh tanggal dengan PDF sumber.",
          422,
        );
    }
    if (old?.pdf_import_id && !input.pdfImportId)
      throw new ServiceError(
        "PDF_SOURCE_REQUIRED",
        "Referensi PDF tidak dapat dilepas diam-diam. Pilih penggantinya secara eksplisit.",
        422,
      );
    let id = old?.id;
    const prior = old ? { ...old, days: await dates(db, id) } : null;
    if (input.operation === "publish") {
      // Publish exactly the version reviewed; changed fields must be saved as a new draft version first.
      const clean = (a) =>
        a
          .map(({ date, name, category }) => ({ date, name, category }))
          .sort((a, b) => a.date.localeCompare(b.date));
      if (
        old.decision_number !== input.decisionNumber ||
        old.source_url !== input.sourceUrl ||
        (old.pdf_import_id || undefined) !== input.pdfImportId ||
        JSON.stringify(clean(prior.days)) !== JSON.stringify(clean(input.days))
      )
        conflict();
      await db.query(
        "UPDATE holiday_catalogs SET status='published',published_at=now(),published_by_user_id=$2,version=version+1,updated_at=now() WHERE id=$1",
        [id, actor.id],
      );
    } else {
      if (!old) {
        const draft = (
          await db.query("SELECT id FROM holiday_catalogs WHERE year=$1 AND status='draft'", [
            input.year,
          ])
        ).rows[0];
        if (draft)
          throw new ServiceError(
            "DRAFT_EXISTS",
            "Draft tahun ini sudah tersedia. Buka draft tersebut.",
            409,
          );
        id = (
          await db.query(
            `INSERT INTO holiday_catalogs(year,revision,decision_number,source_url,created_by_user_id)
          SELECT $1,coalesce(max(revision),0)+1,$2,$3,$4 FROM holiday_catalogs WHERE year=$1 RETURNING id::text`,
            [input.year, input.decisionNumber, input.sourceUrl, actor.id],
          )
        ).rows[0].id;
      } else
        await db.query(
          "UPDATE holiday_catalogs SET decision_number=$2,source_url=$3,version=version+1,updated_at=now() WHERE id=$1",
          [id, input.decisionNumber, input.sourceUrl],
        );
      await db.query("DELETE FROM holiday_catalog_days WHERE catalog_id=$1", [id]);
      for (const d of input.days)
        await db.query(
          "INSERT INTO holiday_catalog_days(catalog_id,holiday_date,name,category) VALUES($1,$2,$3,$4)",
          [id, d.date, d.name, d.category],
        );
    }
    if (input.operation === "save" && pdf) {
      await db.query(
        `UPDATE holiday_catalogs SET source_file_id=$2,pdf_import_id=$3,pdf_review=$4 WHERE id=$1`,
        [
          id,
          pdf.file_id,
          pdf.id,
          JSON.stringify({
            actorUserId: String(actor.id),
            reviewedAt: new Date().toISOString(),
            sha256: pdf.sha256,
            parserVersion: pdf.parser_version,
            originalResult: pdf.result,
            acceptedDays: input.days,
            decisionNumber: input.decisionNumber,
          }),
        ],
      );
      await db.query("UPDATE stored_files SET lifecycle_status='active' WHERE id=$1", [
        pdf.file_id,
      ]);
    }
    const result = (await db.query("SELECT *,id::text FROM holiday_catalogs WHERE id=$1", [id]))
      .rows[0];
    result.days = await dates(db, id);
    result.document = await catalogDocument(db, result.source_file_id);
    await writeAudit(db, {
      actorUserId: actor.id,
      action: `holiday_catalog.${input.operation}`,
      entityType: "holiday_catalog",
      entityId: id,
      beforeData: prior,
      afterData: result,
      requestId,
    });
    await db.query(
      "INSERT INTO holiday_catalog_requests(actor_user_id,request_key,payload_hash,result) VALUES($1,$2,$3,$4)",
      [actor.id, input.requestKey, hash, result],
    );
    return result;
  });
}

/** Resolve only published immutable sources. Existing manual clients remain compatible. */
export async function validateCalendarSources(db, days, prior = []) {
  const ids = days.filter((d) => d.catalogDayId).map((d) => d.catalogDayId);
  const sources = ids.length
    ? (
        await db.query(
          `SELECT d.id::text,d.holiday_date::text AS date,d.name
    FROM holiday_catalog_days d JOIN holiday_catalogs c ON c.id=d.catalog_id WHERE d.id=ANY($1::bigint[]) AND c.status='published'`,
          [ids],
        )
      ).rows
    : [];
  return days.map((d) => {
    const old = prior.find((p) => p.date === d.date);
    if (old?.catalogDayId && !d.catalogDayId && old.name !== d.name)
      throw new ServiceError(
        "INVALID_CATALOG_SOURCE",
        "Nama resmi tidak dapat diubah. Hapus tanggal mendatang sebelum menggantinya.",
        400,
        { days: "Periksa asal tanggal." },
      );
    const sourceId = d.catalogDayId || (old?.name === d.name ? old.catalogDayId : null);
    if (sourceId && sourceId !== old?.catalogDayId) {
      const source = sources.find((s) => s.id === sourceId);
      if (!source || source.date !== d.date || source.name !== d.name)
        throw new ServiceError(
          "INVALID_CATALOG_SOURCE",
          "Tanggal katalog tidak sesuai. Pilih kembali dari katalog terbit.",
          400,
          { days: "Periksa asal tanggal." },
        );
    } else if (sourceId && old && old.name !== d.name) {
      throw new ServiceError(
        "INVALID_CATALOG_SOURCE",
        "Nama resmi tidak dapat diubah. Gunakan tanggal tambahan organisasi.",
        400,
      );
    }
    return { ...d, catalogDayId: sourceId || null };
  });
}

async function catalogDocument(db, fileId) {
  if (!fileId) return null;
  return (
    (
      await db.query(
        "SELECT id::text,original_name,size_bytes,mime_type,sha256 FROM stored_files WHERE id=$1 AND ownership_scope='platform' AND deleted_at IS NULL",
        [fileId],
      )
    ).rows[0] || null
  );
}
