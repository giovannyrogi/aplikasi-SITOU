import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { scanUploadBuffer } from "@/lib/files/malwareScanner";
import {
  getPrivateUploadRoot,
  purgeLocalObjects,
  quarantineLocalObjects,
  resolvePrivateObjectPath,
  restoreLocalObjects,
} from "@/lib/files/localLifecycle.mjs";

const IMAGE_MIMES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const PDF_MIMES = new Map([["application/pdf", "pdf"]]);
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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
  lampiran_cuti: {
    folder: ["cuti_izin"],
    category: "leave_attachment",
    max: 10 * 1024 * 1024,
    mimes: new Map([...IMAGE_MIMES, ...PDF_MIMES]),
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
    mimes: PDF_MIMES,
  },
  employee_import: {
    folder: ["imports", "pegawai"],
    category: "employee_import_source",
    organizationScoped: true,
    max: 10 * 1024 * 1024,
    mimes: new Map([[XLSX_MIME, "xlsx"]]),
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
  return getPrivateUploadRoot();
}

function resolveStoredObjectPath(objectKey) {
  try {
    return resolvePrivateObjectPath(objectKey);
  } catch {
    throw new ServiceError("FILE_PATH_INVALID", "Lokasi file tidak valid.", 500);
  }
}

export async function quarantineStoredFiles(storedFiles) {
  try {
    return await quarantineLocalObjects(storedFiles, "profile-files");
  } catch {
    throw new ServiceError(
      "FILE_QUARANTINE_FAILED",
      "File belum dapat dihapus dari penyimpanan. Silakan coba kembali.",
      500,
    );
  }
}

export async function restoreQuarantinedFiles(entries) {
  await restoreLocalObjects(entries);
}

export async function purgeQuarantinedFiles(entries) {
  await purgeLocalObjects(entries);
}

/** Membentuk path tanpa data pribadi agar file tetap tertata dan aman dari traversal. */
function buildObjectKey({ organizationId, employeeId, fileKind, extension }) {
  const year = String(new Date().getFullYear());
  const config = FILE_KINDS[fileKind];
  if (config.organizationScoped)
    return path.posix.join(
      `org_${organizationId}`,
      ...config.folder,
      year,
      `${randomUUID()}.${extension}`,
    );
  return path.posix.join(
    `org_${organizationId}`,
    "pegawai",
    `employee_${employeeId}`,
    ...config.folder,
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
  if (IMAGE_MIMES.has(detected.mime)) {
    let metadata;
    try {
      metadata = await sharp(buffer, { limitInputPixels: 40_000_000, sequentialRead: true }).metadata();
    } catch {
      throw new ServiceError("IMAGE_INVALID", "Gambar rusak atau dimensinya terlalu besar.", 415);
    }
    if (!metadata.width || !metadata.height || metadata.width > 12_000 ||
        metadata.height > 12_000 || metadata.width * metadata.height > 40_000_000)
      throw new ServiceError(
        "IMAGE_DIMENSIONS_INVALID",
        "Dimensi gambar maksimal 12.000 piksel per sisi dan 40 megapiksel.",
        413,
      );
  }
  const malwareScan = await scanUploadBuffer(buffer);
  return { buffer, mimeType: detected.mime, extension, config, malwareScan };
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
       size_bytes,sha256,category,is_confidential,uploaded_by_user_id,
       malware_scan_status,malware_scanned_at,malware_scan_engine)
     VALUES ($1,$2,'local_private',$3,$4,$5,$6,$7,$8,true,$9,$10,
       CASE WHEN $10='clean' THEN now() ELSE NULL END,$11)
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
      prepared.malwareScan.status,
      prepared.malwareScan.engine,
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

/**
 * Menjalankan upload dan mutasi domain dalam satu transaksi metadata.
 * Byte baru dibersihkan bila validasi bisnis atau transaksi database gagal.
 */
export async function commitPreparedEmployeeFile(
  { file, fileKind, employeeId, organizationId, actor, requestId },
  operation,
) {
  const prepared = file
    ? await prepareEmployeeFileUpload({ file, fileKind, employeeId, organizationId })
    : null;
  try {
    return await withTransaction(async (client) => {
      let stored = null;
      if (prepared) {
        await finalizePreparedEmployeeFile(prepared);
        stored = await insertPreparedEmployeeFile(client, prepared, {
          employeeId,
          organizationId,
          actor,
          requestId,
        });
      }
      return operation(client, stored);
    });
  } catch (error) {
    if (prepared) await discardPreparedEmployeeFile(prepared);
    throw error;
  }
}

/** Menjalankan beberapa upload dan mutasi domain dalam satu transaksi metadata. */
export async function commitPreparedEmployeeFiles(
  { uploads, employeeId, organizationId, actor, requestId },
  operation,
) {
  const preparedFiles = [];
  try {
    for (const upload of uploads || [])
      preparedFiles.push(
        await prepareEmployeeFileUpload({
          file: upload.file,
          fileKind: upload.fileKind,
          employeeId,
          organizationId,
        }),
      );
    return await withTransaction(async (client) => {
      const storedFiles = [];
      for (const prepared of preparedFiles) {
        await finalizePreparedEmployeeFile(prepared);
        storedFiles.push(
          await insertPreparedEmployeeFile(client, prepared, {
            employeeId,
            organizationId,
            actor,
            requestId,
          }),
        );
      }
      return operation(client, storedFiles);
    });
  } catch (error) {
    await Promise.all(preparedFiles.map(discardPreparedEmployeeFile));
    throw error;
  }
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
           size_bytes,sha256,category,is_confidential,uploaded_by_user_id,
           malware_scan_status,malware_scanned_at,malware_scan_engine)
         VALUES ($1,$2,'local_private',$3,$4,$5,$6,$7,$8,true,$9,$10,
           CASE WHEN $10='clean' THEN now() ELSE NULL END,$11)
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
          inspected.malwareScan.status,
          inspected.malwareScan.engine,
        ],
      );
      if (fileKind === "pas_foto") {
        await client.query(
          `UPDATE stored_files SET lifecycle_status='deleted',deleted_at=now()
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
            `UPDATE stored_files file SET lifecycle_status='deleted',deleted_at=now()
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

const DEFAULT_DRAFT_SLOTS = Object.freeze({
  pas_foto: "profile_photo",
  ktp: "ktp",
  pendidikan: "education:0",
  kontrak: "contract",
  sk_penempatan: "assignment_decree",
});

function resolveDraftSlot(fileKind, draftSlot) {
  const slot = String(draftSlot || DEFAULT_DRAFT_SLOTS[fileKind] || "").trim();
  if (!/^[a-z][a-z0-9_]*(?::[a-z0-9_-]+)*$/i.test(slot) || slot.length > 100)
    throw new ServiceError("DRAFT_SLOT_INVALID", "Slot file draft tidak valid.", 400);
  return slot;
}

async function enqueuePurgeJobs(client, files, organizationId) {
  for (const file of files || []) {
    if (!file?.id || !file?.object_key) continue;
    await client.query(
      `INSERT INTO file_purge_jobs (organization_id,stored_file_id,object_key)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [organizationId, file.id, file.object_key],
    );
  }
}

export async function stageStoredFilesForDeletion(
  client,
  storedFiles,
  { organizationId, actorId = null, reasonCode },
) {
  const files = (storedFiles || []).filter((file) => file?.id && file?.object_key);
  const fileIds = files.map((file) => String(file.id));
  if (fileIds.length) {
    await client.query(
      `UPDATE stored_files
       SET lifecycle_status='deleted',deleted_at=COALESCE(deleted_at,now()),
           deleted_by_user_id=COALESCE(deleted_by_user_id,$3),
           deletion_reason_code=COALESCE(deletion_reason_code,$4)
       WHERE organization_id=$1 AND id=ANY($2::bigint[])
         AND lifecycle_status IN ('draft','active')`,
      [organizationId, fileIds, actorId, reasonCode],
    );
    await enqueuePurgeJobs(client, files, organizationId);
  }
  return { fileIds, organizationId };
}

export async function restoreStagedStoredFiles() {}
export async function purgeStagedStoredFiles() {}

export async function discardDraftFiles(
  client,
  { draftId, organizationId, actorId = null, reasonCode },
) {
  const files = await client.query(
    `SELECT id::text,object_key FROM stored_files
     WHERE organization_id=$1 AND onboarding_draft_id=$2
       AND lifecycle_status='draft' FOR UPDATE`,
    [organizationId, draftId],
  );
  const fileIds = files.rows.map((file) => file.id);
  if (fileIds.length) {
    await client.query(
      `UPDATE stored_files
       SET lifecycle_status='deleted',deleted_at=now(),deleted_by_user_id=$3,
           deletion_reason_code=$4
       WHERE organization_id=$1 AND onboarding_draft_id=$2
         AND lifecycle_status='draft'`,
      [organizationId, draftId, actorId, reasonCode],
    );
    await enqueuePurgeJobs(client, files.rows, organizationId);
  }
  return { fileIds, organizationId };
}

export async function restoreDraftFiles() {}
export async function purgeDraftFiles() {}
/** Menyimpan satu file draft dan mengganti isi slot yang sama secara transaksional. */
export async function storeEmployeeDraftFile({
  file,
  fileKind,
  draftSlot,
  draftId,
  organizationId,
  actor,
  requestId,
}) {
  if (!Object.hasOwn(DEFAULT_DRAFT_SLOTS, fileKind))
    throw new ServiceError("FILE_KIND_INVALID", "Kategori file draft tidak didukung.", 400);

  const slot = resolveDraftSlot(fileKind, draftSlot);
  const inspected = await inspectUpload(file, fileKind);
  const objectKey = buildDraftObjectKey({
    organizationId,
    draftId,
    fileKind,
    extension: inspected.extension,
  });
  const finalPath = path.join(getUploadRoot(), ...objectKey.split("/"));
  const tempPath = `${finalPath}.${randomUUID()}.tmp`;
  const prepared = {
    ...inspected,
    fileKind,
    objectKey,
    finalPath,
    tempPath,
    originalName: String(file.name || "file").slice(0, 255),
    sha256: createHash("sha256").update(inspected.buffer).digest("hex"),
  };
  await mkdir(path.dirname(finalPath), { recursive: true });
  await writeFile(tempPath, inspected.buffer, { flag: "wx" });
  await finalizePreparedEmployeeFile(prepared);

  let committed = false;
  let replacedIds = [];
  try {
    const stored = await withTransaction(async (client) => {
      const draft = await client.query(
        `SELECT id FROM employee_onboarding_drafts
         WHERE id=$1 AND organization_id=$2 AND created_by_user_id=$3
           AND status='active' AND expires_at>now() FOR UPDATE`,
        [draftId, organizationId, actor.id],
      );
      if (!draft.rows[0])
        throw new ServiceError("DRAFT_NOT_FOUND", "Draft pegawai tidak ditemukan.", 404);

      const previous = await client.query(
        `SELECT id::text,object_key FROM stored_files
         WHERE organization_id=$1 AND onboarding_draft_id=$2
           AND draft_slot=$3 AND lifecycle_status='draft'
         FOR UPDATE`,
        [organizationId, draftId, slot],
      );
      replacedIds = previous.rows.map((item) => item.id);
      if (replacedIds.length) {
        await client.query(
          `UPDATE stored_files
           SET lifecycle_status='deleted',deleted_at=now(),deleted_by_user_id=$4,
               deletion_reason_code='replaced'
           WHERE organization_id=$1 AND onboarding_draft_id=$2
             AND draft_slot=$3 AND lifecycle_status='draft'`,
          [organizationId, draftId, slot, actor.id],
        );
        await enqueuePurgeJobs(client, previous.rows, organizationId);
      }

      const inserted = await client.query(
        `INSERT INTO stored_files
          (organization_id,onboarding_draft_id,storage_provider,object_key,original_name,mime_type,
           size_bytes,sha256,category,is_confidential,uploaded_by_user_id,lifecycle_status,draft_slot,
           malware_scan_status,malware_scanned_at,malware_scan_engine)
         VALUES ($1,$2,'local_private',$3,$4,$5,$6,$7,$8,true,$9,'draft',$10,$11,
           CASE WHEN $11='clean' THEN now() ELSE NULL END,$12)
         RETURNING id::text,original_name,mime_type,size_bytes,category,draft_slot,created_at`,
        [
          organizationId,
          draftId,
          objectKey,
          prepared.originalName,
          prepared.mimeType,
          prepared.buffer.length,
          prepared.sha256,
          prepared.config.category,
          actor.id,
          slot,
          prepared.malwareScan.status,
          prepared.malwareScan.engine,
        ],
      );
      await writeAudit(client, {
        organizationId,
        actorUserId: actor.id,
        action: "employee_draft.file_replace",
        entityType: "stored_file",
        entityId: inserted.rows[0].id,
        afterData: {
          draftId: String(draftId),
          category: prepared.config.category,
          draftSlot: slot,
          replacedFileIds: replacedIds,
        },
        requestId,
      });
      return inserted.rows[0];
    });

    committed = true;
    return stored;
  } catch (error) {
    if (!committed) await discardPreparedEmployeeFile(prepared);
    throw error;
  }
}

/** Memuat metadata berizin tanpa pernah mengembalikan object_key ke browser. */
export async function getStoredFile(fileId, organizationId, database = pool) {
  const result = await database.query(
    `SELECT id::text,organization_id::text,employee_id::text,onboarding_draft_id::text,object_key,original_name,
      mime_type,size_bytes,category,created_at,malware_scan_status FROM stored_files
     WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL`,
    [fileId, organizationId],
  );
  if (!result.rows[0]) throw new ServiceError("FILE_NOT_FOUND", "File tidak ditemukan.", 404);
  if (process.env.NODE_ENV === "production" && result.rows[0].malware_scan_status !== "clean")
    throw new ServiceError(
      "FILE_SCAN_REQUIRED",
      "File belum lolos pemeriksaan keamanan dan belum dapat dibuka.",
      423,
    );
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



/** Menghapus file draft dengan karantina sehingga transaksi gagal dapat dipulihkan. */
export async function softDeleteDraftFile(fileId, draftId, organizationId, actor, requestId) {
  await withTransaction(async (client) => {
    const found = await client.query(
      `SELECT file.id::text,file.category,file.object_key
       FROM stored_files file
       JOIN employee_onboarding_drafts draft
         ON draft.organization_id=file.organization_id AND draft.id=file.onboarding_draft_id
       WHERE file.id=$1 AND file.organization_id=$2 AND file.onboarding_draft_id=$3
         AND file.lifecycle_status='draft' AND draft.created_by_user_id=$4
         AND draft.status='active'
       FOR UPDATE OF file,draft`,
      [fileId, organizationId, draftId, actor.id],
    );
    if (!found.rows[0]) throw new ServiceError("FILE_NOT_FOUND", "File tidak ditemukan.", 404);
    await stageStoredFilesForDeletion(client, found.rows, {
      organizationId,
      actorId: actor.id,
      reasonCode: "removed_by_user",
    });
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "employee_draft.file_delete",
      entityType: "stored_file",
      entityId: fileId,
      beforeData: { draftId: String(draftId), category: found.rows[0].category },
      requestId,
    });
  });
}/** Mengalihkan kepemilikan file staging ke pegawai dan merapikan object key secara best effort. */
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
        `UPDATE stored_files SET object_key=$4,employee_id=$3,onboarding_draft_id=NULL,
           lifecycle_status='active',draft_slot=NULL
         WHERE id=$1 AND organization_id=$2`,
        [file.id, organizationId, employeeId, nextKey],
      );
    } catch (error) {
      await rename(nextPath, currentPath).catch(() => {});
      await pool.query(
        `UPDATE stored_files SET employee_id=$3,onboarding_draft_id=NULL,
           lifecycle_status='active',draft_slot=NULL
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
  return Readable.toWeb(createReadStream(/* turbopackIgnore: true */ absolutePath));
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

/** Endpoint umum hanya menghapus upload baru yang belum pernah diklaim data domain. */
export async function softDeleteStoredFile(fileId, organizationId, actor, requestId) {
  let staged = null;
  try {
    await withTransaction(async (client) => {
      const fileResult = await client.query(
        `SELECT id::text,organization_id::text,employee_id::text,onboarding_draft_id::text,
          object_key,original_name,mime_type,size_bytes,category,lifecycle_status,
          uploaded_by_user_id::text,created_at
         FROM stored_files
         WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL FOR UPDATE`,
        [fileId, organizationId],
      );
      const file = fileResult.rows[0];
      if (!file) throw new ServiceError("FILE_NOT_FOUND", "File tidak ditemukan.", 404);
      if (
        file.lifecycle_status !== "active" ||
        String(file.uploaded_by_user_id || "") !== String(actor.id) ||
        Date.now() - new Date(file.created_at).getTime() > 24 * 60 * 60 * 1000
      )
        throw new ServiceError(
          "FILE_DELETE_NOT_ALLOWED",
          "Hanya upload baru yang belum digunakan yang dapat dihapus melalui endpoint ini.",
          409,
        );

      const references = await client.query(
        `SELECT 1 FROM employees WHERE organization_id=$1 AND profile_photo_file_id=$2
         UNION ALL SELECT 1 FROM employee_documents WHERE organization_id=$1 AND file_id=$2
         UNION ALL SELECT 1 FROM employee_identifiers WHERE organization_id=$1 AND document_file_id=$2
         UNION ALL SELECT 1 FROM employee_educations WHERE organization_id=$1 AND certificate_file_id=$2
         UNION ALL SELECT 1 FROM employee_certifications WHERE organization_id=$1 AND certificate_file_id=$2
         UNION ALL SELECT 1 FROM employment_contracts WHERE organization_id=$1 AND document_file_id=$2
         UNION ALL SELECT 1 FROM employment_contract_document_versions WHERE organization_id=$1 AND file_id=$2
         UNION ALL SELECT 1 FROM employee_assignments WHERE organization_id=$1 AND document_file_id=$2
         UNION ALL SELECT 1 FROM employee_assignment_document_versions WHERE organization_id=$1 AND file_id=$2
         UNION ALL SELECT 1 FROM disciplinary_actions WHERE organization_id=$1 AND document_file_id=$2
         UNION ALL SELECT 1 FROM leave_request_attachments WHERE organization_id=$1 AND file_id=$2
         UNION ALL SELECT 1 FROM employee_import_batches WHERE organization_id=$1 AND source_file_id=$2
         LIMIT 1`,
        [organizationId, fileId],
      );
      if (references.rows[0])
        throw new ServiceError(
          "FILE_IN_USE",
          "File sudah digunakan dan tidak dapat dihapus melalui endpoint umum.",
          409,
        );

      staged = await stageStoredFilesForDeletion(client, [file], {
        organizationId,
        actorId: actor.id,
        reasonCode: "upload_abandoned",
      });
      await writeAudit(client, {
        organizationId,
        actorUserId: actor.id,
        action: "private_file.delete_unclaimed",
        entityType: "stored_file",
        entityId: fileId,
        beforeData: { employeeId: file.employee_id, category: file.category },
        requestId,
      });
    });
  } catch (error) {
    await restoreStagedStoredFiles(staged).catch(() => {});
    throw error;
  }
  await purgeStagedStoredFiles(staged);
}

/** Nama download disanitasi agar tidak menyisipkan header atau path. */
export function sanitizeDownloadName(name) {
  return String(name || "dokumen")
    .replace(/[\r\n"\\/]/g, "_")
    .slice(0, 180);
}
