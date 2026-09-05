import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import {
  CLEANABLE_PROFILE_CATEGORIES,
  STORED_FILE_REFERENCES,
  maskEmployeeNumber,
} from "../lib/storage-maintenance/policy.mjs";
import {
  findStoredFileReferences,
  inspectDeletedProfileFile,
  resolveMaintenancePath,
} from "../lib/storage-maintenance/worker.mjs";
import { storageMaintenanceCleanupSchema } from "../lib/storage-maintenance/schemas.js";

const uploadRoot = path.resolve(process.cwd(), "uploads");
const oldDate = new Date(Date.now() - 8 * 86_400_000).toISOString();
const baseFile = {
  id: "10",
  organization_id: "1",
  storage_provider: "local_private",
  object_key: "org_1/pegawai/employee_2/pas_foto/2026/example.webp",
  category: "employee_photo",
  size_bytes: 100,
  deleted_at: oldDate,
  content_purged_at: null,
};

test("kategori pembersihan hanya mencakup file profil replaceable", () => {
  assert.deepEqual(CLEANABLE_PROFILE_CATEGORIES, ["employee_photo", "identity", "education"]);
});

test("registry referensi mencakup seluruh pemilik stored_files pada schema saat ini", () => {
  assert.deepEqual(
    STORED_FILE_REFERENCES.map(({ table, column }) => `${table}.${column}`).sort(),
    [
      "attendance_events.photo_file_id",
      "attendance_import_batches.source_file_id",
      "attendance_points.reference_background_file_id",
      "disciplinary_actions.document_file_id",
      "employee_assignments.document_file_id",
      "employee_certifications.certificate_file_id",
      "employee_documents.file_id",
      "employee_educations.certificate_file_id",
      "employee_identifiers.document_file_id",
      "employee_import_batches.source_file_id",
      "employees.profile_photo_file_id",
      "employment_contracts.document_file_id",
      "leave_request_attachments.file_id",
      "locations.logo_file_id",
      "organization_branding.logo_file_id",
    ].sort(),
  );
});

test("pemeriksaan referensi melaporkan setiap tabel yang masih memakai file", async () => {
  for (const expected of STORED_FILE_REFERENCES) {
    const database = {
      query: async (sql) => ({
        rows: sql.includes(`FROM ${expected.table}`) ? [{ exists: 1 }] : [],
      }),
    };
    const labels = await findStoredFileReferences(database, "1", "10");
    assert.deepEqual(labels, [expected.label]);
  }
});

test("file aktif tidak pernah lolos sebagai kandidat pembersihan", async () => {
  const result = await inspectDeletedProfileFile(
    { query: async () => ({ rows: [] }) },
    uploadRoot,
    { ...baseFile, deleted_at: null },
  );
  assert.equal(result.status, "needs_review");
  assert.equal(result.reasonCode, "active_metadata");
});

test("satu referensi bisnis saja membuat file perlu ditinjau", async () => {
  const database = {
    query: async (sql) => ({
      rows: sql.includes("FROM employees") ? [{ exists: 1 }] : [],
    }),
  };
  const result = await inspectDeletedProfileFile(database, uploadRoot, baseFile);
  assert.equal(result.status, "needs_review");
  assert.equal(result.reasonCode, "still_referenced");
  assert.deepEqual(result.references, ["Pas foto pegawai"]);
});

test("object key yang dipakai metadata aktif tidak dapat dibersihkan", async () => {
  const database = {
    query: async (sql) => ({ rows: sql.includes("FROM stored_files") ? [{ exists: 1 }] : [] }),
  };
  const result = await inspectDeletedProfileFile(database, uploadRoot, baseFile);
  assert.equal(result.reasonCode, "active_object_key");
});

test("dokumen resmi dan path organisasi yang tidak sesuai selalu ditolak", async () => {
  const database = { query: async () => ({ rows: [] }) };
  const official = await inspectDeletedProfileFile(database, uploadRoot, {
    ...baseFile,
    category: "contract",
  });
  assert.equal(official.reasonCode, "category_not_allowed");

  const mismatch = resolveMaintenancePath(uploadRoot, {
    ...baseFile,
    object_key: "org_2/pegawai/employee_2/pas_foto/2026/example.webp",
  });
  assert.deepEqual(mismatch, { valid: false, reasonCode: "organization_mismatch" });
});

test("pembersihan memerlukan organisasi, kandidat, dan konfirmasi eksplisit", () => {
  assert.equal(
    storageMaintenanceCleanupSchema.safeParse({ organizationId: 1, itemIds: [2] }).success,
    false,
  );
  assert.equal(
    storageMaintenanceCleanupSchema.safeParse({
      organizationId: 1,
      itemIds: [2, 2],
      confirmationAccepted: true,
    }).success,
    false,
  );
  assert.equal(
    storageMaintenanceCleanupSchema.safeParse({
      organizationId: 1,
      itemIds: [2],
      confirmationAccepted: true,
    }).success,
    true,
  );
});

test("NIP hanya tersedia dalam bentuk masking pada hasil maintenance", () => {
  assert.equal(maskEmployeeNumber("20250194003"), "20*******03");
  assert.equal(maskEmployeeNumber("1234"), "****");
});

test("service API membuang NIP mentah dan tidak memilih path atau hash", async () => {
  const source = await readFile(
    new URL("../lib/storage-maintenance/service.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /employee_no: employeeNumber/);
  assert.doesNotMatch(source, /file\.object_key|file\.sha256/);
});

test("PM2 menjalankan server web dan satu worker pembersihan production", async () => {
  const source = await readFile(new URL("../ecosystem.config.js", import.meta.url), "utf8");
  assert.match(source, /name: "sitou-file-cleanup-worker"/);
  assert.match(source, /args: "run worker:file-cleanup"/);
  assert.match(source, /instances: 1/);
  assert.equal((source.match(/NODE_ENV: "production"/g) || []).length, 2);
});

test("halaman membedakan antrean worker dari proses yang sedang berjalan", async () => {
  const source = await readFile(
    new URL("../app/(protected)/system/storage-maintenance/page.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Menunggu worker/);
  assert.match(source, /Batalkan antrean/);
  assert.match(source, /sitou-file-cleanup-worker aktif di server/);
});
