import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileTypeFromBuffer } from "file-type";
import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";

const IMAGE_MIMES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const PDF_MIMES = new Map([["application/pdf", "pdf"]]);
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Konfigurasi kategori menjadi satu sumber kebenaran untuk folder, limit, dan metadata. */
export const FILE_KINDS = Object.freeze({
  pas_foto: {
    folder: ["pas_foto"],
    category: "employee_photo",
    max: 5 * 1024 * 1024,
    mimes: IMAGE_MIMES,
  },
  ktp: {
    folder: ["identitas", "ktp"],
    category: "identity",
    documentType: "ktp",
    replaceExisting: true,
    max: 5 * 1024 * 1024,
    mimes: IMAGE_MIMES,
  },
  kk: {
    folder: ["identitas", "kk"],
    category: "identity",
    documentType: "kk",
    replaceExisting: true,
    max: 5 * 1024 * 1024,
    mimes: IMAGE_MIMES,
  },
  npwp: {
    folder: ["identitas", "npwp"],
    category: "identity",
    documentType: "npwp",
    replaceExisting: true,
    max: 5 * 1024 * 1024,
    mimes: IMAGE_MIMES,
  },
  bpjs_kesehatan: {
    folder: ["identitas", "bpjs_kesehatan"],
    category: "identity",
    documentType: "bpjs_health",
    replaceExisting: true,
    max: 5 * 1024 * 1024,
    mimes: IMAGE_MIMES,
  },
  bpjs_ketenagakerjaan: {
    folder: ["identitas", "bpjs_ketenagakerjaan"],
    category: "identity",
    documentType: "bpjs_employment",
    replaceExisting: true,
    max: 5 * 1024 * 1024,
    mimes: IMAGE_MIMES,
  },
  identitas_lain: {
    folder: ["identitas", "lainnya"],
    category: "identity",
    documentType: "identity_other",
    max: 5 * 1024 * 1024,
    mimes: IMAGE_MIMES,
  },
  kontrak: { folder: ["kontrak"], category: "contract", max: 10 * 1024 * 1024, mimes: PDF_MIMES },
  sk_penempatan: {
    folder: ["penempatan", "sk"],
    category: "assignment_decree",
    max: 10 * 1024 * 1024,
    mimes: PDF_MIMES,
  },
  pendidikan: {
    folder: ["pendidikan"],
    category: "education",
    documentType: "ijazah",
    max: 5 * 1024 * 1024,
    mimes: IMAGE_MIMES,
  },
  sertifikasi: {
    folder: ["sertifikasi"],
    category: "education",
    documentType: "sertifikasi",
    max: 5 * 1024 * 1024,
    mimes: IMAGE_MIMES,
  },
  sanksi_sp1: {
    folder: ["sanksi", "sp1"],
    category: "discipline_letter",
    max: 10 * 1024 * 1024,
    mimes: PDF_MIMES,
  },
  sanksi_sp2: {
    folder: ["sanksi", "sp2"],
    category: "discipline_letter",
    max: 10 * 1024 * 1024,
    mimes: PDF_MIMES,
  },
  sanksi_sp3: {
    folder: ["sanksi", "sp3"],
    category: "discipline_letter",
    max: 10 * 1024 * 1024,
    mimes: PDF_MIMES,
  },
  sanksi_lainnya: {
    folder: ["sanksi", "lainnya"],
    category: "discipline_letter",
    max: 10 * 1024 * 1024,
    mimes: new Map([...PDF_MIMES, [DOCX_MIME, "docx"]]),
  },
  dokumen_lain: {
    folder: ["dokumen_lain"],
    category: "other",
    max: 10 * 1024 * 1024,
    mimes: new Map([...PDF_MIMES, [DOCX_MIME, "docx"]]),
  },
});

/** Root upload selalu dinormalisasi ke path absolut privat di luar public. */
export function getUploadRoot() {
  return path.resolve(
    /* turbopackIgnore: true */ process.env.UPLOAD_ROOT || path.join(process.cwd(), "uploads"),
  );
}

/** Menyelesaikan object key privat dan menolak path yang keluar dari root upload. */
function resolveStoredObjectPath(objectKey) {
  const root = getUploadRoot();
  const absolutePath = path.resolve(root, ...String(objectKey || "").split("/"));
  if (!absolutePath.startsWith(`${root}${path.sep}`))
    throw new ServiceError("FILE_PATH_INVALID", "Lokasi file tidak valid.", 500);
  return absolutePath;
}

/**
 * Memindahkan file yang akan dihapus ke karantina sebelum transaksi database selesai.
 * File dapat dipulihkan bila transaksi gagal dan tidak lagi tersedia melalui object key aktif.
 */
export async function quarantineStoredFiles(storedFiles) {
  const root = getUploadRoot();
  const quarantineRoot = path.join(root, ".trash", "profile-files");
  const entries = [];

  try {
    await mkdir(quarantineRoot, { recursive: true });
    for (const storedFile of storedFiles) {
      const originalPath = resolveStoredObjectPath(storedFile.object_key);
      const extension = path.extname(originalPath).slice(0, 12);
      const quarantinePath = path.join(quarantineRoot, `${randomUUID()}${extension}`);
      try {
        await rename(originalPath, quarantinePath);
        entries.push({ originalPath, quarantinePath, missing: false });
      } catch (error) {
        if (error?.code === "ENOENT") {
          entries.push({ originalPath, quarantinePath: null, missing: true });
          continue;
        }
        throw error;
      }
    }
    return entries;
  } catch (error) {
    await restoreQuarantinedFiles(entries);
    throw new ServiceError(
      "FILE_QUARANTINE_FAILED",
      "File belum dapat dihapus dari penyimpanan. Silakan coba kembali.",
      500,
    );
  }
}

/** Mengembalikan file karantina ketika transaksi database dibatalkan. */
export async function restoreQuarantinedFiles(entries) {
  for (const entry of [...entries].reverse()) {
    if (entry.missing || !entry.quarantinePath) continue;
    await mkdir(path.dirname(entry.originalPath), { recursive: true });
    await rename(entry.quarantinePath, entry.originalPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
}

/** Menghapus byte karantina secara permanen setelah transaksi database berhasil. */
export async function purgeQuarantinedFiles(entries) {
  for (const entry of entries) {
    if (entry.missing || !entry.quarantinePath) continue;
    await unlink(entry.quarantinePath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
}

/** Membentuk path tanpa data pribadi agar file tetap tertata dan aman dari traversal. */
function buildObjectKey({ organizationId, employeeId, fileKind, extension }) {
  const year = String(new Date().getFullYear());
  return path.posix.join(
    `org_${organizationId}`,
    "pegawai",
    `employee_${employeeId}`,
    ...FILE_KINDS[fileKind].folder,
    year,
    `${randomUUID()}.${extension}`,
  );
}

/** Membentuk lokasi staging privat tanpa nama atau identitas pribadi pegawai. */
function buildDraftObjectKey({ organizationId, draftId, fileKind, extension }) {
  const year = String(new Date().getFullYear());
  return path.posix.join(
    `org_${organizationId}`,
    "pegawai",
    "drafts",
    `draft_${draftId}`,
    ...FILE_KINDS[fileKind].folder,
    year,
    `${randomUUID()}.${extension}`,
  );
}

/** Menentukan MIME dari signature byte; nama dan Content-Type klien tidak dipercaya. */
async function inspectUpload(file, fileKind) {
  const config = FILE_KINDS[fileKind];
  if (!config) throw new ServiceError("FILE_KIND_INVALID", "Kategori dokumen tidak didukung.", 400);
  if (!file || typeof file.arrayBuffer !== "function")
    throw new ServiceError("FILE_REQUIRED", "Pilih file yang akan diunggah.", 400);
  if (file.size <= 0 || file.size > config.max)
    throw new ServiceError(
      "FILE_SIZE_INVALID",
      `Ukuran file harus lebih dari 0 dan maksimal ${config.max / 1024 / 1024} MB.`,
      413,
    );
  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(buffer);
  const extension = detected && config.mimes.get(detected.mime);
  if (!extension)
    throw new ServiceError(
      "FILE_TYPE_INVALID",
      "Isi file tidak sesuai format yang diizinkan.",
      415,
    );
  return { buffer, mimeType: detected.mime, extension, config };
}

/** Menyiapkan byte file di lokasi sementara tanpa membuat metadata database. */
export async function prepareEmployeeFileUpload({ file, fileKind, employeeId, organizationId }) {
  const inspected = await inspectUpload(file, fileKind);
  const objectKey = buildObjectKey({
    organizationId,
    employeeId,
    fileKind,
    extension: inspected.extension,
  });
  const finalPath = path.join(/* turbopackIgnore: true */ getUploadRoot(), ...objectKey.split("/"));
  const tempPath = `${finalPath}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(finalPath), { recursive: true });
  await writeFile(tempPath, inspected.buffer, { flag: "wx" });
  return {
    ...inspected,
    fileKind,
    objectKey,
    finalPath,
    tempPath,
    originalName: String(file.name || "file").slice(0, 255),
    sha256: createHash("sha256").update(inspected.buffer).digest("hex"),
  };
}

/** Pemindahan atomik dilakukan saat transaksi profil siap dicatat. */
export async function finalizePreparedEmployeeFile(prepared) {
  await rename(prepared.tempPath, prepared.finalPath);
  prepared.finalized = true;
}

/** Membersihkan file baru ketika validasi atau transaksi profil gagal. */
export async function discardPreparedEmployeeFile(prepared) {
  await unlink(prepared.tempPath).catch(() => {});
  if (prepared.finalized) await unlink(prepared.finalPath).catch(() => {});
}

/** Metadata file baru dicatat oleh transaksi pemilik workflow. */
export async function insertPreparedEmployeeFile(
  client,
  prepared,
  { employeeId, organizationId, actor, requestId },
) {
  const inserted = await client.query(
    `INSERT INTO stored_files
      (organization_id,employee_id,storage_provider,object_key,original_name,mime_type,
       size_bytes,sha256,category,is_confidential,uploaded_by_user_id)
     VALUES ($1,$2,'local_private',$3,$4,$5,$6,$7,$8,true,$9)
     RETURNING id::text,employee_id::text,original_name,mime_type,size_bytes,category,created_at`,
    [
      organizationId,
      employeeId,
      prepared.objectKey,
      prepared.originalName,
      prepared.mimeType,
      prepared.buffer.length,
      prepared.sha256,
      prepared.config.category,
      actor.id,
    ],
  );
  await writeAudit(client, {
    organizationId,
    actorUserId: actor.id,
    action: "private_file.upload",
    entityType: "stored_file",
    entityId: inserted.rows[0].id,
    afterData: { employeeId: String(employeeId), category: prepared.config.category },
    requestId,
  });
  return inserted.rows[0];
}

/** Menulis file sementara lalu memindahkannya atomik sebelum metadata dicatat. */
export async function storeEmployeeFile({
  file,
  fileKind,
  employeeId,
  organizationId,
  actor,
  requestId,
}) {
  const employee = await pool.query(
    "SELECT id,profile_photo_file_id FROM employees WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL",
    [employeeId, organizationId],
  );
  if (!employee.rows[0])
    throw new ServiceError("EMPLOYEE_INVALID", "Pegawai tidak ditemukan.", 404);
  const inspected = await inspectUpload(file, fileKind);
  const objectKey = buildObjectKey({
    organizationId,
    employeeId,
    fileKind,
    extension: inspected.extension,
  });
  const finalPath = path.join(/* turbopackIgnore: true */ getUploadRoot(), ...objectKey.split("/"));
  const tempPath = `${finalPath}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(finalPath), { recursive: true });
  await writeFile(tempPath, inspected.buffer, { flag: "wx" });
  await rename(tempPath, finalPath);

  try {
    return await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO stored_files
          (organization_id,employee_id,storage_provider,object_key,original_name,mime_type,
           size_bytes,sha256,category,is_confidential,uploaded_by_user_id)
         VALUES ($1,$2,'local_private',$3,$4,$5,$6,$7,$8,true,$9)
         RETURNING id::text,employee_id::text,original_name,mime_type,size_bytes,category,created_at`,
        [
          organizationId,
          employeeId,
          objectKey,
          String(file.name || "dokumen").slice(0, 255),
          inspected.mimeType,
          inspected.buffer.length,
          createHash("sha256").update(inspected.buffer).digest("hex"),
          inspected.config.category,
          actor.id,
        ],
      );
      if (fileKind === "pas_foto") {
        await client.query(
          `UPDATE stored_files SET deleted_at=now()
           WHERE organization_id=$1 AND employee_id=$2 AND category='employee_photo'
             AND id<>$3 AND deleted_at IS NULL`,
          [organizationId, employeeId, inserted.rows[0].id],
        );
        await client.query(
          "UPDATE employees SET profile_photo_file_id=$3 WHERE id=$1 AND organization_id=$2",
          [employeeId, organizationId, inserted.rows[0].id],
        );
      } else if (inspected.config.documentType) {
        // Dokumen identitas tunggal diganti secara logis, sedangkan ijazah/sertifikasi menyimpan histori.
        if (inspected.config.replaceExisting)
          await client.query(
            `UPDATE stored_files file SET deleted_at=now()
             FROM employee_documents document
             WHERE document.organization_id=$1 AND document.employee_id=$2
               AND document.document_type=$3 AND document.file_id=file.id
               AND file.organization_id=document.organization_id
               AND file.id<>$4 AND file.deleted_at IS NULL`,
            [organizationId, employeeId, inspected.config.documentType, inserted.rows[0].id],
          );
        await client.query(
          `INSERT INTO employee_documents (organization_id,employee_id,document_type,file_id)
           VALUES ($1,$2,$3,$4)`,
          [organizationId, employeeId, inspected.config.documentType, inserted.rows[0].id],
        );
      }
      await writeAudit(client, {
        organizationId,
        actorUserId: actor.id,
        action: "private_file.upload",
        entityType: "stored_file",
        entityId: inserted.rows[0].id,
        afterData: { employeeId: String(employeeId), category: inspected.config.category },
        requestId,
      });
      return inserted.rows[0];
    });
  } catch (error) {
    await unlink(finalPath).catch(() => {});
    throw error;
  }
}

/** Menyimpan satu file staging dan mengganti file lama pada kategori draft yang sama. */
export async function storeEmployeeDraftFile({
  file,
  fileKind,
  draftId,
  organizationId,
  actor,
  requestId,
}) {
  if (!["pas_foto", "ktp", "pendidikan", "kontrak", "sk_penempatan"].includes(fileKind))
    throw new ServiceError("FILE_KIND_INVALID", "Kategori file draft tidak didukung.", 400);
  const inspected = await inspectUpload(file, fileKind);
  const objectKey = buildDraftObjectKey({
    organizationId,
    draftId,
    fileKind,
    extension: inspected.extension,
  });
  const finalPath = path.join(/* turbopackIgnore: true */ getUploadRoot(), ...objectKey.split("/"));
  const tempPath = `${finalPath}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(finalPath), { recursive: true });
  await writeFile(tempPath, inspected.buffer, { flag: "wx" });
  await rename(tempPath, finalPath);

  try {
    return await withTransaction(async (client) => {
      const draft = await client.query(
        `SELECT id FROM employee_onboarding_drafts
         WHERE id=$1 AND organization_id=$2 AND created_by_user_id=$3
           AND status='active' AND expires_at>now() FOR UPDATE`,
        [draftId, organizationId, actor.id],
      );
      if (!draft.rows[0])
        throw new ServiceError("DRAFT_NOT_FOUND", "Draft pegawai tidak ditemukan.", 404);
      await client.query(
        `UPDATE stored_files SET deleted_at=now()
         WHERE organization_id=$1 AND onboarding_draft_id=$2 AND category=$3
           AND deleted_at IS NULL`,
        [organizationId, draftId, inspected.config.category],
      );
      const inserted = await client.query(
        `INSERT INTO stored_files
          (organization_id,onboarding_draft_id,storage_provider,object_key,original_name,mime_type,
           size_bytes,sha256,category,is_confidential,uploaded_by_user_id)
         VALUES ($1,$2,'local_private',$3,$4,$5,$6,$7,$8,true,$9)
         RETURNING id::text,original_name,mime_type,size_bytes,category,created_at`,
        [
          organizationId,
          draftId,
          objectKey,
          String(file.name || "dokumen.pdf").slice(0, 255),
          inspected.mimeType,
          inspected.buffer.length,
          createHash("sha256").update(inspected.buffer).digest("hex"),
          inspected.config.category,
          actor.id,
        ],
      );
      await writeAudit(client, {
        organizationId,
        actorUserId: actor.id,
        action: "employee_draft.file_upload",
        entityType: "stored_file",
        entityId: inserted.rows[0].id,
        afterData: { draftId: String(draftId), category: inspected.config.category },
        requestId,
      });
      return inserted.rows[0];
    });
  } catch (error) {
    await unlink(finalPath).catch(() => {});
    throw error;
  }
}

/** Memuat metadata berizin tanpa pernah mengembalikan object_key ke browser. */
export async function getStoredFile(fileId, organizationId, database = pool) {
  const result = await database.query(
    `SELECT id::text,organization_id::text,employee_id::text,onboarding_draft_id::text,object_key,original_name,
      mime_type,size_bytes,category,created_at FROM stored_files
     WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL`,
    [fileId, organizationId],
  );
  if (!result.rows[0]) throw new ServiceError("FILE_NOT_FOUND", "File tidak ditemukan.", 404);
  return result.rows[0];
}

/** Memuat file aktif milik draft tanpa mengirim object key ke browser. */
export async function listEmployeeDraftFiles(draftId, organizationId, actorId, database = pool) {
  const result = await database.query(
    `SELECT file.id::text,file.original_name,file.mime_type,file.size_bytes,file.category,file.created_at
     FROM stored_files file
     JOIN employee_onboarding_drafts draft
       ON draft.organization_id=file.organization_id AND draft.id=file.onboarding_draft_id
     WHERE file.organization_id=$1 AND file.onboarding_draft_id=$2
       AND draft.created_by_user_id=$3 AND file.deleted_at IS NULL
     ORDER BY file.created_at DESC`,
    [organizationId, draftId, actorId],
  );
  return result.rows;
}

/** Menandai file staging terhapus setelah memastikan draft dimiliki actor. */
export async function softDeleteDraftFile(fileId, draftId, organizationId, actor, requestId) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE stored_files file SET deleted_at=now()
       FROM employee_onboarding_drafts draft
       WHERE file.id=$1 AND file.organization_id=$2 AND file.onboarding_draft_id=$3
         AND file.deleted_at IS NULL AND draft.id=file.onboarding_draft_id
         AND draft.organization_id=file.organization_id AND draft.created_by_user_id=$4
         AND draft.status='active'
       RETURNING file.id::text,file.category`,
      [fileId, organizationId, draftId, actor.id],
    );
    if (!result.rows[0]) throw new ServiceError("FILE_NOT_FOUND", "File tidak ditemukan.", 404);
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "employee_draft.file_delete",
      entityType: "stored_file",
      entityId: fileId,
      beforeData: { draftId: String(draftId), category: result.rows[0].category },
      requestId,
    });
  });
}

/** Mengalihkan kepemilikan file staging ke pegawai dan merapikan object key secara best effort. */
export async function promoteEmployeeDraftFiles(files, organizationId, draftId, employeeId) {
  for (const file of files) {
    const fileKind =
      {
        employee_photo: "pas_foto",
        identity: "ktp",
        contract: "kontrak",
        assignment_decree: "sk_penempatan",
        education: "pendidikan",
      }[file.category] || null;
    if (!fileKind) continue;
    const extension = FILE_KINDS[fileKind].mimes.get(file.mime_type);
    const nextKey = buildObjectKey({ organizationId, employeeId, fileKind, extension });
    const currentPath = path.join(
      /* turbopackIgnore: true */ getUploadRoot(),
      ...file.object_key.split("/"),
    );
    const nextPath = path.join(/* turbopackIgnore: true */ getUploadRoot(), ...nextKey.split("/"));
    try {
      await mkdir(path.dirname(nextPath), { recursive: true });
      await rename(currentPath, nextPath);
      await pool.query(
        `UPDATE stored_files SET object_key=$4,employee_id=$3,onboarding_draft_id=NULL
         WHERE id=$1 AND organization_id=$2`,
        [file.id, organizationId, employeeId, nextKey],
      );
    } catch (error) {
      await rename(nextPath, currentPath).catch(() => {});
      await pool.query(
        `UPDATE stored_files SET employee_id=$3,onboarding_draft_id=NULL
         WHERE id=$1 AND organization_id=$2`,
        [file.id, organizationId, employeeId],
      );
      console.error("[employee-draft.file-promote]", { fileId: file.id, error: error.message });
    }
  }
}

/** Menampilkan metadata file pegawai tanpa object_key agar browser hanya mengenal file ID. */
export async function listEmployeeFiles(employeeId, organizationId, database = pool) {
  const result = await database.query(
    `SELECT file.id::text,file.employee_id::text,file.original_name,file.mime_type,file.size_bytes,
      file.category,file.created_at,document.document_type
     FROM stored_files file
     LEFT JOIN LATERAL (
       SELECT employee_document.document_type
       FROM employee_documents employee_document
       WHERE employee_document.organization_id=file.organization_id
         AND employee_document.employee_id=file.employee_id
         AND employee_document.file_id=file.id
       ORDER BY employee_document.id DESC LIMIT 1
     ) document ON true
     WHERE file.organization_id=$1 AND file.employee_id=$2 AND file.deleted_at IS NULL
     ORDER BY file.created_at DESC,file.id DESC LIMIT 100`,
    [organizationId, employeeId],
  );
  return result.rows;
}

const EMPLOYEE_DOCUMENT_SLOTS = Object.freeze([
  ["pas_foto", "Pas foto"],
  ["ktp", "KTP"],
  ["kk", "Kartu Keluarga"],
  ["npwp", "NPWP"],
  ["bpjs_health", "BPJS Kesehatan"],
  ["bpjs_employment", "BPJS Ketenagakerjaan"],
  ["kontrak", "Kontrak kerja"],
  ["sk_penempatan", "SK penempatan"],
  ["ijazah", "Ijazah"],
  ["sertifikasi", "Sertifikasi"],
  ["identity_other", "Identitas administratif lainnya"],
]);

/** Menyusun checklist dokumen berdasarkan relasi bisnis, bukan nama folder penyimpanan. */
export async function getEmployeeDocumentChecklist(employeeId, organizationId, database = pool) {
  const result = await database.query(
    `SELECT related_file.id::text,related_file.original_name,related_file.mime_type,
      related_file.size_bytes,related_file.created_at,related_file.document_kind
     FROM (
       SELECT file.*, 'pas_foto'::text AS document_kind
       FROM employees employee
       JOIN stored_files file ON file.organization_id=employee.organization_id
         AND file.id=employee.profile_photo_file_id AND file.deleted_at IS NULL
       WHERE employee.organization_id=$1 AND employee.id=$2

       UNION ALL

       SELECT file.*, document.document_type AS document_kind
       FROM employee_documents document
       JOIN stored_files file ON file.organization_id=document.organization_id
         AND file.id=document.file_id AND file.deleted_at IS NULL
       JOIN employees employee ON employee.organization_id=document.organization_id
         AND employee.id=document.employee_id
       WHERE document.organization_id=$1 AND document.employee_id=$2
         AND document.document_type='ktp' AND employee.national_id IS NOT NULL

       UNION ALL

       SELECT file.*,
         CASE identifier.identifier_type
           WHEN 'family_card' THEN 'kk'
           WHEN 'tax_npwp' THEN 'npwp'
           WHEN 'bpjs_health' THEN 'bpjs_health'
           WHEN 'bpjs_employment' THEN 'bpjs_employment'
           ELSE 'identity_other'
         END AS document_kind
       FROM employee_identifiers identifier
       JOIN stored_files file ON file.organization_id=identifier.organization_id
         AND file.id=identifier.document_file_id AND file.deleted_at IS NULL
       WHERE identifier.organization_id=$1 AND identifier.employee_id=$2

       UNION ALL

       SELECT file.*, 'kontrak'::text AS document_kind
       FROM employment_contracts contract
       JOIN stored_files file ON file.organization_id=contract.organization_id
         AND file.id=contract.document_file_id AND file.deleted_at IS NULL
       WHERE contract.organization_id=$1 AND contract.employee_id=$2

       UNION ALL

       SELECT file.*, 'sk_penempatan'::text AS document_kind
       FROM employee_assignments assignment
       JOIN stored_files file ON file.organization_id=assignment.organization_id
         AND file.id=assignment.document_file_id AND file.deleted_at IS NULL
       WHERE assignment.organization_id=$1 AND assignment.employee_id=$2

       UNION ALL

       SELECT file.*, 'ijazah'::text AS document_kind
       FROM employee_educations education
       JOIN stored_files file ON file.organization_id=education.organization_id
         AND file.id=education.certificate_file_id AND file.deleted_at IS NULL
       WHERE education.organization_id=$1 AND education.employee_id=$2

       UNION ALL

       SELECT file.*, 'sertifikasi'::text AS document_kind
       FROM employee_certifications certification
       JOIN stored_files file ON file.organization_id=certification.organization_id
         AND file.id=certification.certificate_file_id AND file.deleted_at IS NULL
       WHERE certification.organization_id=$1 AND certification.employee_id=$2
     ) related_file
     ORDER BY related_file.created_at DESC,related_file.id DESC`,
    [organizationId, employeeId],
  );
  const grouped = new Map();
  for (const file of result.rows) {
    const files = grouped.get(file.document_kind) || [];
    files.push(file);
    grouped.set(file.document_kind, files);
  }
  return {
    checklist: EMPLOYEE_DOCUMENT_SLOTS.map(([kind, label]) => ({
      kind,
      label,
      status: grouped.has(kind) ? "available" : "missing",
      count: grouped.get(kind)?.length || 0,
      latestUploadedAt: grouped.get(kind)?.[0]?.created_at || null,
    })),
  };
}

/** Membuka stream lokal setelah metadata dan permission diverifikasi oleh route. */
export function createStoredFileStream(storedFile) {
  const absolutePath = resolveStoredObjectPath(storedFile.object_key);
  return Readable.toWeb(createReadStream(absolutePath));
}

/** Memastikan byte masih tersedia sebelum header response dikirim ke browser. */
export async function assertStoredFileAvailable(storedFile) {
  const absolutePath = resolveStoredObjectPath(storedFile.object_key);
  try {
    await access(absolutePath);
  } catch {
    throw new ServiceError(
      "FILE_CONTENT_MISSING",
      "Berkas tidak tersedia pada penyimpanan. Hubungi administrator sistem.",
      404,
    );
  }
}

/** Soft delete mempertahankan byte untuk retention dan bukti aktif. */
export async function softDeleteStoredFile(fileId, organizationId, actor, requestId) {
  return withTransaction(async (client) => {
    const file = await getStoredFile(fileId, organizationId, client);
    const usedByActiveAction = await client.query(
      "SELECT 1 FROM disciplinary_actions WHERE organization_id=$1 AND document_file_id=$2 AND status='active'",
      [organizationId, fileId],
    );
    if (usedByActiveAction.rows[0])
      throw new ServiceError("FILE_IN_USE", "Bukti sanksi aktif tidak dapat dihapus.", 409);
    const usedByLifecycle = await client.query(
      `SELECT 1 FROM employment_contracts WHERE organization_id=$1 AND document_file_id=$2
       UNION ALL
       SELECT 1 FROM employee_assignments WHERE organization_id=$1 AND document_file_id=$2
       LIMIT 1`,
      [organizationId, fileId],
    );
    if (usedByLifecycle.rows[0])
      throw new ServiceError("FILE_IN_USE", "Dokumen yang digunakan tidak dapat dihapus.", 409);

    // Referensi profil dilepas bersama soft delete agar form yang dibuka ulang tidak memuat ID usang.
    await client.query(
      `UPDATE employees SET profile_photo_file_id=NULL
       WHERE organization_id=$1 AND profile_photo_file_id=$2`,
      [organizationId, fileId],
    );
    await client.query(
      `UPDATE employee_identifiers SET document_file_id=NULL
       WHERE organization_id=$1 AND document_file_id=$2`,
      [organizationId, fileId],
    );
    await client.query(
      `UPDATE employee_educations SET certificate_file_id=NULL
       WHERE organization_id=$1 AND certificate_file_id=$2`,
      [organizationId, fileId],
    );
    await client.query(
      `UPDATE employee_certifications SET certificate_file_id=NULL
       WHERE organization_id=$1 AND certificate_file_id=$2`,
      [organizationId, fileId],
    );
    await client.query(`DELETE FROM employee_documents WHERE organization_id=$1 AND file_id=$2`, [
      organizationId,
      fileId,
    ]);
    await client.query(
      "UPDATE stored_files SET deleted_at=now() WHERE id=$1 AND organization_id=$2",
      [fileId, organizationId],
    );
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "private_file.soft_delete",
      entityType: "stored_file",
      entityId: fileId,
      beforeData: { employeeId: file.employee_id, category: file.category },
      requestId,
    });
  });
}

/** Nama download disanitasi agar tidak menyisipkan header atau path. */
export function sanitizeDownloadName(name) {
  return String(name || "dokumen")
    .replace(/[\r\n"\\/]/g, "_")
    .slice(0, 180);
}
