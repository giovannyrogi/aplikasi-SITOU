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
import {
  storageMaintenanceActionSchema,
  storageMaintenanceCleanupSchema,
} from "../lib/storage-maintenance/schemas.js";

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
      "employee_assignment_document_versions.file_id",
      "employee_assignments.document_file_id",
      "employee_certifications.certificate_file_id",
      "employee_documents.file_id",
      "employee_educations.certificate_file_id",
      "employee_identifiers.document_file_id",
      "employee_import_batches.source_file_id",
      "employees.profile_photo_file_id",
      "employment_contract_document_versions.file_id",
      "employment_contracts.document_file_id",
      "inventory_items.photo_file_id",
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

test("catatan tanpa referensi tetap dapat dibersihkan meski status aktif", async () => {
  const result = await inspectDeletedProfileFile(
    { query: async () => ({ rows: [] }) },
    uploadRoot,
    { ...baseFile, deleted_at: null },
  );
  assert.equal(result.status, "eligible");
  assert.equal(result.reasonCode, "unreferenced_content_missing");
});

test("satu referensi bisnis saja membuat file perlu ditinjau", async () => {
  const database = {
    query: async (sql) => ({
      rows: sql.includes("FROM employees") ? [{ exists: 1 }] : [],
    }),
  };
  const result = await inspectDeletedProfileFile(database, uploadRoot, baseFile);
  assert.equal(result.status, "needs_review");
  assert.equal(result.reasonCode, "active_content_missing");
  assert.deepEqual(result.references, ["Pas foto pegawai"]);
});

test("object key yang dipakai metadata aktif tidak dapat dibersihkan", async () => {
  const database = {
    query: async (sql) => ({ rows: sql.includes("FROM stored_files") ? [{ exists: 1 }] : [] }),
  };
  const result = await inspectDeletedProfileFile(database, uploadRoot, baseFile);
  assert.equal(result.reasonCode, "active_object_key");
});

test("dokumen tanpa referensi dapat dibersihkan tetapi path lintas organisasi ditolak", async () => {
  const database = { query: async () => ({ rows: [] }) };
  const official = await inspectDeletedProfileFile(database, uploadRoot, {
    ...baseFile,
    category: "contract",
  });
  assert.equal(official.reasonCode, "unreferenced_content_missing");
  assert.equal(official.status, "eligible");

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

test("pemindahan temuan ke pembersihan memerlukan alasan dan konfirmasi", () => {
  assert.equal(
    storageMaintenanceActionSchema.safeParse({
      organizationId: 1,
      action: "stage_cleanup",
      reason: "tidak ada",
      confirmationAccepted: true,
    }).success,
    false,
  );
  assert.equal(
    storageMaintenanceActionSchema.safeParse({
      organizationId: 1,
      action: "stage_cleanup",
      reason: "File telah diverifikasi tidak digunakan.",
      confirmationAccepted: true,
    }).success,
    true,
  );
});

test("NIP hanya tersedia dalam bentuk masking pada hasil maintenance", () => {
  assert.equal(maskEmployeeNumber("20250194003"), "20*******03");
  assert.equal(maskEmployeeNumber("1234"), "****");
});

test("service API membuang NIP mentah dan mapper publik tidak membocorkan path atau hash", async () => {
  const source = await readFile(
    new URL("../lib/storage-maintenance/service.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /employee_no: employeeNumber/);
  const mapper = source.slice(
    source.indexOf("const mapItem"),
    source.indexOf("async function ensureOrganization"),
  );
  assert.doesNotMatch(mapper, /row\.(object_key|sha256|quarantine_object_key)/);
});

test("PM2 menjalankan web, worker pembersihan, dan worker kedaluwarsa backup", async () => {
  const source = await readFile(new URL("../ecosystem.config.js", import.meta.url), "utf8");
  assert.match(source, /name: "sitou-file-cleanup-worker"/);
  assert.match(source, /args: "run worker:file-cleanup"/);
  assert.match(source, /instances: 1/);
  assert.match(source, /name: "sitou-backup-expiry-worker"/);
  assert.match(source, /args: "run worker:backup-expiry"/);
  assert.equal((source.match(/NODE_ENV: "production"/g) || []).length, 3);
});

test("halaman membedakan antrean worker dari proses yang sedang berjalan", async () => {
  const source = await readFile(
    new URL("../app/(protected)/system/storage-maintenance/page.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Menunggu worker/);
  assert.match(source, /Batalkan antrean/);
  assert.match(source, /sitou-file-cleanup-worker aktif di server/);
  assert.match(source, /Integritas & pemulihan/);
  assert.match(source, /Ancaman keamanan/);
  assert.match(source, /Lihat file/);
  assert.match(source, /Lihat hubungan file/);
  assert.match(source, /Hubungan dengan data bisnis/);
  assert.match(source, /Pulihkan status file/);
  assert.match(source, /Pindahkan ke pembersihan/);
  assert.match(source, /Selesaikan pembersihan/);
  assert.match(source, /minHeight: 44/);
  assert.match(source, /alignItems: "center"/);
  assert.match(source, /background: theme\.palette\.info\.main/);
  assert.match(source, /background: theme\.palette\.success\.main/);
  assert.match(source, /background: theme\.palette\.warning\.main/);
  assert.match(source, /"& \.MuiAlert-icon": \{/);
  assert.match(source, /"& \.MuiAlert-message": \{/);
  assert.match(source, /tone="brand"/);
  assert.match(source, /tone="danger"/);
  assert.match(source, /tone="success"/);
  assert.match(source, /tone="warning"/);
  assert.doesNotMatch(source, /Buka detail pegawai/);
});

test("aturan visual menetapkan warna semantik tombol dan alignment ikon", async () => {
  const agents = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
  assert.match(agents, /batalkan proses, dan tindakan destruktif memakai danger merah/);
  assert.match(agents, /Ikon dan teks di dalam tombol wajib disusun `inline-flex`/);
});

test("temuan integritas memakai modal hubungan dan tidak mengarahkan Superadmin ke profil", async () => {
  const service = await readFile(
    new URL("../lib/storage-maintenance/service.js", import.meta.url),
    "utf8",
  );
  const mapper = service.slice(
    service.indexOf("const mapItem"),
    service.indexOf("async function ensureOrganization"),
  );
  assert.match(mapper, /availableActions\.unshift\("view_relationships"\)/);
  assert.doesNotMatch(mapper, /open_employee/);
  assert.match(mapper, /metadata_status_invalid/);
  assert.match(mapper, /restore_metadata/);
});

test("migration karantina melindungi histori dan menyimpan tenggat pemulihan", async () => {
  const migration = await readFile(
    new URL("../database/migrations/20260929_036_storage_review_quarantine.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE file_quarantine_items/);
  assert.match(migration, /PROTECTED_OFFICIAL_HISTORY/);
  assert.match(migration, /'retained','quarantined'/);
  assert.match(migration, /purge_after/);
});

test("pemulihan byte hilang memverifikasi hash, MIME, ukuran, dan ClamAV", async () => {
  const service = await readFile(
    new URL("../lib/storage-maintenance/service.js", import.meta.url),
    "utf8",
  );
  const route = await readFile(
    new URL(
      "../app/api/system/storage-maintenance/runs/[id]/items/[itemId]/recovery/route.js",
      import.meta.url,
    ),
    "utf8",
  );
  const recovery = service.slice(
    service.indexOf("export async function recoverMaintenanceItemContent"),
  );
  assert.match(recovery, /active_content_missing/);
  assert.match(recovery, /currentHash !== expectedHash/);
  assert.match(recovery, /detectedMime !== expectedMime/);
  assert.match(recovery, /scanUploadBuffer\(buffer\)/);
  assert.match(recovery, /scan\.status !== "clean"/);
  assert.match(route, /storage_maintenance\.manage/);
  assert.match(route, /parseMultipartToPrivateTemp/);
});
