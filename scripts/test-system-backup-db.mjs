import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readdir, readFile, rename, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader } from "@zip.js/zip.js";
import { verifyArchive } from "../lib/system-backup/archive.mjs";
import { artifactPath, packagePath, backupJobDirectory } from "../lib/system-backup/paths.mjs";
import { reconcileStalledBackups } from "../lib/system-backup/health.mjs";

// PostgreSQL dapat mencetak cast array literal setara dengan dua bentuk berbeda.
function canonicalConstraint(row) {
  if (typeof row.definition !== "string") return row;
  return {
    ...row,
    definition: row.definition
      .replace(/\('([^']*)'::character varying\)::text/g, "'$1'::character varying")
      .replace(/\((ARRAY\[[^\]]+\])\)::text\[\]/g, "$1"),
  };
}

dotenv.config({ path: ".env.development", quiet: true });
if (!process.env.PGDATABASE || /prod/i.test(process.env.PGDATABASE))
  throw new Error("Test backup hanya boleh memakai konfigurasi database development.");

const name = `sitou_backup_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const root = await mkdtemp(path.join(os.tmpdir(), "sitou-backup-db-"));
const uploadRoot = path.join(root, "uploads");
const backupRoot = path.join(root, "backups");
const snapshotRoot = path.join(root, "snapshots");
const connection = {
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
};
const admin = new pg.Client({
  ...connection,
  database: process.env.PGADMIN_DATABASE || "postgres",
});
let database;
let created = false;
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  database = new pg.Client({ ...connection, database: name });
  await database.connect();
  await database.query(await readFile(new URL("../sitou_schema_v3.sql", import.meta.url), "utf8"));
  const upgraded = new pg.Client({ ...connection, database: process.env.PGDATABASE });
  await upgraded.connect();
  try {
    for (const sql of [
      `SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns
       WHERE table_schema='public' AND table_name='system_backup_jobs' ORDER BY column_name`,
      `SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint
       WHERE conrelid='public.system_backup_jobs'::regclass ORDER BY conname`,
      `SELECT indexname,indexdef FROM pg_indexes
       WHERE schemaname='public' AND tablename='system_backup_jobs' ORDER BY indexname`,
      `SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns
       WHERE table_schema='public' AND table_name='system_backup_file_issues' ORDER BY column_name`,
      `SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint
       WHERE conrelid='public.system_backup_file_issues'::regclass ORDER BY conname`,
      `SELECT indexname,indexdef FROM pg_indexes
       WHERE schemaname='public' AND tablename='system_backup_file_issues' ORDER BY indexname`,
      `SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns
       WHERE table_schema='public' AND table_name='system_backup_artifacts' ORDER BY column_name`,
      `SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint
       WHERE conrelid='public.system_backup_artifacts'::regclass ORDER BY conname`,
      `SELECT indexname,indexdef FROM pg_indexes
       WHERE schemaname='public' AND tablename='system_backup_artifacts' ORDER BY indexname`,
    ]) {
      const [fresh, existing] = await Promise.all([database.query(sql), upgraded.query(sql)]);
      if (sql.includes("FROM pg_indexes") && sql.includes("system_backup_jobs")) {
        // PostgreSQL dapat menulis ulang cast enum status pada predikat index setelah CHECK diganti.
        const canonical = (rows) =>
          rows.map(({ indexname, indexdef }) => ({
            indexname,
            indexdef: ["uq_system_backup_active", "ix_system_backup_stale"].includes(indexname)
              ? indexdef.split(" WHERE ")[0]
              : indexdef,
          }));
        assert.deepEqual(
          canonical(fresh.rows),
          canonical(existing.rows),
          "Index bootstrap backup harus sama dengan migration lokal.",
        );
        for (const row of [...fresh.rows, ...existing.rows].filter((item) =>
          ["uq_system_backup_active", "ix_system_backup_stale"].includes(item.indexname),
        ))
          for (const status of ["queued", "copying", "securing", "verifying"])
            assert(row.indexdef.includes(status));
      } else
        assert.deepEqual(
          fresh.rows.map(canonicalConstraint),
          existing.rows.map(canonicalConstraint),
          "Schema bootstrap backup harus sama dengan migration lokal.",
        );
    }
  } finally {
    await upgraded.end();
  }
  const actor = (
    await database.query(
      `INSERT INTO users(username,password_hash) VALUES('backup-test','test-only') RETURNING id`,
    )
  ).rows[0].id;
  const organizationIds = [];
  const storedPaths = [];
  for (const [index, content] of ["logo-one", "logo-two"].entries()) {
    const org = (
      await database.query(`INSERT INTO organizations(code,name) VALUES($1,$2) RETURNING id`, [
        `B${index + 1}`,
        `Organisasi ${index + 1}`,
      ])
    ).rows[0].id;
    organizationIds.push(org);
    const key = `org_${org}/branding/${randomUUID()}.png`;
    const filePath = path.join(uploadRoot, ...key.split("/"));
    storedPaths.push(filePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    const bytes = Buffer.from(content);
    await writeFile(filePath, bytes);
    const file = (
      await database.query(
        `INSERT INTO stored_files(organization_id,object_key,original_name,mime_type,size_bytes,sha256,category,malware_scan_status)
       VALUES($1,$2,$3,'image/png',$4,$5,'logo','clean') RETURNING id`,
        [
          org,
          key,
          `logo-${index + 1}.png`,
          bytes.length,
          createHash("sha256").update(bytes).digest("hex"),
        ],
      )
    ).rows[0].id;
    await database.query(
      `INSERT INTO organization_branding(organization_id,logo_file_id) VALUES($1,$2)`,
      [org, file],
    );
    if (index === 1) {
      const quarantineKey = `.trash/storage-maintenance/quarantine/org_${org}/${randomUUID()}.png`;
      const quarantinePath = path.join(uploadRoot, ...quarantineKey.split("/"));
      await mkdir(path.dirname(quarantinePath), { recursive: true });
      await rename(filePath, quarantinePath);
      await database.query(
        `UPDATE stored_files SET lifecycle_status='quarantined',quarantined_at=now(),
          malware_scan_status='infected' WHERE id=$1`,
        [file],
      );
      await database.query(
        `INSERT INTO file_quarantine_items(organization_id,stored_file_id,reason,
           original_object_key,quarantine_object_key,original_name,mime_type,size_bytes,
           sha256,malware_scan_status,purge_after)
         VALUES($1,$2,'malware',$3,$4,'logo-2.png','image/png',$5,$6,'infected',now()+interval '7 days')`,
        [
          org,
          file,
          key,
          quarantineKey,
          bytes.length,
          createHash("sha256").update(bytes).digest("hex"),
        ],
      );
      storedPaths[index] = quarantinePath;
    }
  }
  const jobId = randomUUID();
  await database.query(
    `INSERT INTO system_backup_jobs(id,requested_by_user_id,request_id,time_zone) VALUES($1,$2,$3,'Asia/Makassar')`,
    [jobId, actor, randomUUID()],
  );
  const password = randomBytes(24).toString("hex");
  const pgDumpPath =
    process.env.PG_DUMP_PATH ||
    (process.platform === "win32"
      ? "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe"
      : "pg_dump");
  let sawWorkerStart = false;
  const workerLog = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/run-system-backup.mjs", jobId], {
      cwd: process.cwd(),
      stdio: ["pipe", "ignore", "pipe", "ipc"],
      windowsHide: true,
      env: {
        ...process.env,
        PGDATABASE: name,
        UPLOAD_ROOT: uploadRoot,
        BACKUP_ROOT: backupRoot,
        BACKUP_SNAPSHOT_ROOT: snapshotRoot,
        PG_DUMP_PATH: pgDumpPath,
      },
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8").slice(0, 1000);
    });
    child.on("message", (message) => {
      if (message?.type === "backup-started") sawWorkerStart = true;
    });
    child.stdin.end(password + "\n");
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve(stderr) : reject(new Error(stderr || `Worker exit ${code}`)),
    );
  });
  assert(sawWorkerStart, "Worker harus mengonfirmasi proses benar-benar dimulai.");
  const status = (
    await database.query(
      `SELECT status,error_code,error_message,file_count,organization_count,
    created_at,time_zone,progress_stage,progress_done,progress_total,progress_updated_at
    FROM system_backup_jobs WHERE id=$1`,
      [jobId],
    )
  ).rows[0];
  assert.equal(
    status.status,
    "ready",
    `${status.error_message || status.error_code || "Belum diproses"}. ${workerLog}`,
  );
  assert.equal(status.organization_count, 2);
  assert.equal(Number(status.file_count), 2);
  assert.equal(status.progress_stage, "complete");
  assert.equal(Number(status.progress_done), 1);
  assert.equal(Number(status.progress_total), 1);
  assert(status.progress_updated_at);
  assert.equal(
    (await readdir(backupJobDirectory(backupRoot, jobId, status.created_at, status.time_zone)))
      .length,
    3,
  );
  const manifest = await verifyArchive(
    packagePath(backupRoot, jobId, status.created_at, status.time_zone),
    password,
  );
  assert.equal(manifest.fileCount, 2);
  assert.equal(manifest.format, 3);
  assert.equal(manifest.timeZone, "Asia/Makassar");
  assert.ok(manifest.databasePath.endsWith("_WITA.dump"));
  assert.equal(manifest.issueCount, 0);
  assert.equal(manifest.files[1].path, "backup-file-issues.json");
  assert(
    manifest.files.some((file) =>
      file.path.startsWith(`uploads/org_${organizationIds[0]}/branding/`),
    ),
  );
  assert(
    manifest.files.some((file) =>
      file.path.startsWith(
        `uploads/.trash/storage-maintenance/quarantine/org_${organizationIds[1]}/`,
      ),
    ),
  );
  const artifacts = (
    await database.query(
      `SELECT kind,status,size_bytes,progress_done,progress_total
    FROM system_backup_artifacts
    WHERE job_id=$1 ORDER BY kind`,
      [jobId],
    )
  ).rows;
  assert.deepEqual(
    artifacts.map((item) => item.status),
    ["ready", "ready"],
    workerLog,
  );
  for (const item of artifacts)
    assert.equal(Number(item.progress_done), Number(item.progress_total));
  for (const item of artifacts)
    assert(
      (
        await readFile(
          artifactPath(backupRoot, jobId, item.kind, status.created_at, status.time_zone),
        )
      ).length > 0,
    );
  const databaseZip = new ZipReader(
    new Uint8ArrayReader(
      await readFile(
        artifactPath(backupRoot, jobId, "database_zip", status.created_at, status.time_zone),
      ),
    ),
  );
  try {
    const entries = await databaseZip.getEntries();
    assert.deepEqual(
      entries.map((entry) => entry.filename),
      [manifest.databasePath, "backup-file-issues.json", "backup-pairing.json"],
    );
    assert(entries.every((entry) => entry.encrypted && !entry.zipCrypto));
    const dump = await entries[0].getData(new Uint8ArrayWriter(), { password });
    assert.equal(Buffer.from(dump).subarray(0, 5).toString("ascii"), "PGDMP");
  } finally {
    await databaseZip.close();
  }
  const uploadsZip = new ZipReader(
    new Uint8ArrayReader(
      await readFile(
        artifactPath(backupRoot, jobId, "uploads_zip", status.created_at, status.time_zone),
      ),
    ),
  );
  try {
    const entries = await uploadsZip.getEntries();
    assert(entries.every((entry) => entry.encrypted && !entry.zipCrypto));
    assert(!entries.some((entry) => entry.filename.endsWith(".zip")));
    assert(entries.some((entry) => entry.filename.startsWith("uploads/org_")));
    assert(entries.some((entry) => entry.filename.includes("/quarantine/")));
    for (const entry of entries.filter((entry) => entry.filename.startsWith("uploads/"))) {
      const bytes = await entry.getData(new Uint8ArrayWriter(), { password });
      const expected = manifest.files.find((file) => file.path === entry.filename);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), expected.sha256);
    }
  } finally {
    await uploadsZip.close();
  }
  await database.query(
    `UPDATE system_backup_artifacts SET status='failed',internal_path=NULL,
    error_message='Simulasi gagal' WHERE job_id=$1 AND kind='uploads_zip'`,
    [jobId],
  );
  await rm(artifactPath(backupRoot, jobId, "uploads_zip", status.created_at, status.time_zone));
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["scripts/retry-system-backup-artifact.mjs", jobId, "uploads_zip"],
      {
        cwd: process.cwd(),
        stdio: ["pipe", "ignore", "ignore"],
        windowsHide: true,
        env: {
          ...process.env,
          PGDATABASE: name,
          UPLOAD_ROOT: uploadRoot,
          BACKUP_ROOT: backupRoot,
          BACKUP_SNAPSHOT_ROOT: snapshotRoot,
        },
      },
    );
    child.stdin.end("salah\n");
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`Retry ZIP exit ${code}`)),
    );
  });
  assert.equal(
    (
      await database.query(
        `SELECT status FROM system_backup_artifacts
    WHERE job_id=$1 AND kind='uploads_zip'`,
        [jobId],
      )
    ).rows[0].status,
    "failed",
  );
  await database.query(
    `UPDATE system_backup_artifacts SET status='creating',progress_done=0,
    progress_total=NULL,progress_updated_at=NULL WHERE job_id=$1 AND kind='uploads_zip'`,
    [jobId],
  );
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["scripts/retry-system-backup-artifact.mjs", jobId, "uploads_zip"],
      {
        cwd: process.cwd(),
        stdio: ["pipe", "ignore", "ignore"],
        windowsHide: true,
        env: {
          ...process.env,
          PGDATABASE: name,
          UPLOAD_ROOT: uploadRoot,
          BACKUP_ROOT: backupRoot,
          BACKUP_SNAPSHOT_ROOT: snapshotRoot,
        },
      },
    );
    child.stdin.end(password + "\n");
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`Retry ZIP exit ${code}`)),
    );
  });
  assert.equal(
    (
      await database.query(
        `SELECT status FROM system_backup_artifacts
    WHERE job_id=$1 AND kind='uploads_zip'`,
        [jobId],
      )
    ).rows[0].status,
    "ready",
  );
  const permissionRoles = (
    await database.query(
      `SELECT role.code FROM permissions permission JOIN role_permissions mapping ON mapping.permission_id=permission.id
     JOIN roles role ON role.id=mapping.role_id WHERE permission.code='system_backup.manage' ORDER BY role.code`,
    )
  ).rows.map((row) => row.code);
  assert.deepEqual(permissionRoles, ["superadmin"]);
  assert.equal(
    (await database.query(`SELECT expires_at FROM system_backup_jobs WHERE id=$1`, [jobId])).rows[0]
      .expires_at,
    null,
  );
  await database.query(
    `UPDATE system_backup_jobs SET expires_at=now()-interval '1 second' WHERE id=$1`,
    [jobId],
  );
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/expire-system-backups.mjs", "--once"], {
      cwd: process.cwd(),
      stdio: "ignore",
      windowsHide: true,
      env: {
        ...process.env,
        PGDATABASE: name,
        UPLOAD_ROOT: uploadRoot,
        BACKUP_ROOT: backupRoot,
        BACKUP_SNAPSHOT_ROOT: snapshotRoot,
      },
    });
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`Worker kedaluwarsa exit ${code}`)),
    );
  });
  assert.equal(
    (await database.query(`SELECT status FROM system_backup_jobs WHERE id=$1`, [jobId])).rows[0]
      .status,
    "ready",
  );
  const retainedFiles = [
    packagePath(backupRoot, jobId, status.created_at, status.time_zone),
    artifactPath(backupRoot, jobId, "database_zip", status.created_at, status.time_zone),
    artifactPath(backupRoot, jobId, "uploads_zip", status.created_at, status.time_zone),
  ];
  for (const file of retainedFiles) assert((await readFile(file)).length > 0);
  await database.query(
    `UPDATE system_backup_jobs SET status='deleted',deleted_at=now(),
    deleted_by_user_id=$2,package_path=NULL WHERE id=$1`,
    [jobId, actor],
  );
  await database.query(
    `UPDATE system_backup_artifacts SET status='deleted',internal_path=NULL WHERE job_id=$1`,
    [jobId],
  );
  const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
  for (const file of retainedFiles) await utimes(file, old, old);
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/expire-system-backups.mjs", "--once"], {
      cwd: process.cwd(),
      stdio: "ignore",
      windowsHide: true,
      env: {
        ...process.env,
        PGDATABASE: name,
        UPLOAD_ROOT: uploadRoot,
        BACKUP_ROOT: backupRoot,
        BACKUP_SNAPSHOT_ROOT: snapshotRoot,
      },
    });
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`Worker pembersihan exit ${code}`)),
    );
  });
  for (const file of retainedFiles) await assert.rejects(() => readFile(file), { code: "ENOENT" });
  await rm(storedPaths[0]);
  await rm(storedPaths[1]);
  const employeeId = (
    await database.query(
      `INSERT INTO employees(organization_id,employee_no,full_name,national_id,employment_status)
     VALUES($1,'000123','Pegawai Uji Backup','1234567890123456','active') RETURNING id`,
      [organizationIds[0]],
    )
  ).rows[0].id;
  const photoKey = `org_${organizationIds[0]}/pegawai/employee_${employeeId}/pas_foto/2026/${randomUUID()}.jpg`;
  const photoId = (
    await database.query(
      `INSERT INTO stored_files(organization_id,employee_id,object_key,original_name,mime_type,size_bytes,category)
     VALUES($1,$2,$3,'foto-uji.jpg','image/jpeg',12,'employee_photo') RETURNING id`,
      [organizationIds[0], employeeId, photoKey],
    )
  ).rows[0].id;
  await database.query(`UPDATE employees SET profile_photo_file_id=$2 WHERE id=$1`, [
    employeeId,
    photoId,
  ]);
  const ktpKey = `org_${organizationIds[0]}/pegawai/employee_${employeeId}/identitas/ktp/2026/${randomUUID()}.jpg`;
  const ktpId = (
    await database.query(
      `INSERT INTO stored_files(organization_id,employee_id,object_key,original_name,mime_type,size_bytes,category)
     VALUES($1,$2,$3,'ktp-uji.jpg','image/jpeg',12,'identity') RETURNING id`,
      [organizationIds[0], employeeId, ktpKey],
    )
  ).rows[0].id;
  await database.query(
    `INSERT INTO employee_documents(organization_id,employee_id,document_type,file_id)
     VALUES($1,$2,'ktp',$3)`,
    [organizationIds[0], employeeId, ktpId],
  );
  const unusedKey = `org_${organizationIds[0]}/pegawai/employee_${employeeId}/pendidikan/2026/${randomUUID()}.jpg`;
  await database.query(
    `INSERT INTO stored_files(organization_id,employee_id,object_key,original_name,mime_type,size_bytes,category)
     VALUES($1,$2,$3,'lama.jpg','image/jpeg',12,'education')`,
    [organizationIds[0], employeeId, unusedKey],
  );
  const draftId = (
    await database.query(
      `INSERT INTO employee_onboarding_drafts(organization_id,created_by_user_id)
     VALUES($1,$2) RETURNING id`,
      [organizationIds[0], actor],
    )
  ).rows[0].id;
  await database.query(
    `INSERT INTO stored_files(organization_id,onboarding_draft_id,draft_slot,object_key,original_name,mime_type,size_bytes,category,lifecycle_status)
     VALUES($1,$2,'profile_photo',$3,'draft.jpg','image/jpeg',12,'employee_photo','draft')`,
    [organizationIds[0], draftId, `org_${organizationIds[0]}/drafts/${randomUUID()}.jpg`],
  );
  await database.query(
    `INSERT INTO stored_files(organization_id,object_key,original_name,mime_type,size_bytes,category,lifecycle_status,deleted_at,content_purged_at)
     VALUES($1,$2,'purged.jpg','image/jpeg',12,'other','purged',now(),now())`,
    [
      organizationIds[0],
      `org_${organizationIds[0]}/pegawai/employee_${employeeId}/dokumen_lain/2026/${randomUUID()}.jpg`,
    ],
  );
  const changedKey = `org_${organizationIds[0]}/pegawai/employee_${employeeId}/pas_foto/2026/${randomUUID()}.jpg`;
  const changedPath = path.join(uploadRoot, ...changedKey.split("/"));
  await mkdir(path.dirname(changedPath), { recursive: true });
  await writeFile(changedPath, "abc");
  await database.query(
    `INSERT INTO stored_files(organization_id,employee_id,object_key,original_name,mime_type,size_bytes,sha256,category)
     VALUES($1,$2,$3,'ubah.jpg','image/jpeg',3,$4,'employee_photo')`,
    [organizationIds[0], employeeId, changedKey, createHash("sha256").update("xyz").digest("hex")],
  );
  const missingJobId = randomUUID();
  await database.query(
    `INSERT INTO system_backup_jobs(id,requested_by_user_id,request_id) VALUES($1,$2,$3)`,
    [missingJobId, actor, randomUUID()],
  );
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/run-system-backup.mjs", missingJobId], {
      cwd: process.cwd(),
      stdio: ["pipe", "ignore", "ignore"],
      windowsHide: true,
      env: {
        ...process.env,
        PGDATABASE: name,
        UPLOAD_ROOT: uploadRoot,
        BACKUP_ROOT: backupRoot,
        BACKUP_SNAPSHOT_ROOT: snapshotRoot,
        PG_DUMP_PATH: pgDumpPath,
      },
    });
    child.stdin.end(password + "\n");
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`Worker exit ${code}`)),
    );
  });
  const missingStatus = (
    await database.query(`SELECT status,error_message FROM system_backup_jobs WHERE id=$1`, [
      missingJobId,
    ])
  ).rows[0];
  assert.equal(missingStatus.status, "ready_with_warnings");
  assert.deepEqual(
    (
      await database.query(
        `SELECT status FROM system_backup_artifacts
    WHERE job_id=$1 ORDER BY kind`,
        [missingJobId],
      )
    ).rows.map((row) => row.status),
    ["ready", "ready"],
  );
  const missingManifest = await verifyArchive(
    packagePath(
      backupRoot,
      missingJobId,
      (
        await database.query("SELECT created_at FROM system_backup_jobs WHERE id=$1", [
          missingJobId,
        ])
      ).rows[0].created_at,
    ),
    password,
  );
  assert.equal(missingManifest.issueCount, 7);
  assert.equal(missingManifest.fileCount, 1);
  const extracted = path.join(root, "extracted");
  await verifyArchive(
    packagePath(
      backupRoot,
      missingJobId,
      (
        await database.query("SELECT created_at FROM system_backup_jobs WHERE id=$1", [
          missingJobId,
        ])
      ).rows[0].created_at,
    ),
    password,
    { extractRoot: extracted },
  );
  const portableReport = JSON.parse(
    await readFile(path.join(extracted, "backup-file-issues.json"), "utf8"),
  );
  assert.equal(portableReport.issues.length, 7);
  assert(!JSON.stringify(portableReport).includes(changedKey));
  const issue = (
    await database.query(
      `SELECT organization_name,employee_name,employee_no_masked,file_label,issue_type,priority
     FROM system_backup_file_issues WHERE job_id=$1 ORDER BY stored_file_id`,
      [missingJobId],
    )
  ).rows;
  assert.equal(issue.length, 7);
  assert(
    issue.some((row) => row.organization_name === "Organisasi 2" && row.file_label === "Logo"),
  );
  assert(
    issue.some(
      (row) =>
        row.employee_name === "Pegawai Uji Backup" &&
        row.file_label === "KTP" &&
        row.employee_no_masked === "00••••23" &&
        row.priority === "restore",
    ),
  );
  assert(
    issue.some(
      (row) =>
        row.file_label === "Pendidikan atau sertifikasi" && row.priority === "cleanup_review",
    ),
  );
  assert(
    issue.some(
      (row) =>
        row.file_label === "Pas foto" && row.employee_name === null && row.priority === "restore",
    ),
  );
  assert(issue.some((row) => row.issue_type === "hash_mismatch"));
  await database.query(
    `UPDATE system_backup_jobs SET expires_at=now()-interval '1 second' WHERE id=$1`,
    [missingJobId],
  );
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/expire-system-backups.mjs", "--once"], {
      cwd: process.cwd(),
      stdio: "ignore",
      windowsHide: true,
      env: {
        ...process.env,
        PGDATABASE: name,
        UPLOAD_ROOT: uploadRoot,
        BACKUP_ROOT: backupRoot,
        BACKUP_SNAPSHOT_ROOT: snapshotRoot,
      },
    });
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`Worker kedaluwarsa exit ${code}`)),
    );
  });
  assert.equal(
    (await database.query(`SELECT status FROM system_backup_jobs WHERE id=$1`, [missingJobId]))
      .rows[0].status,
    "ready_with_warnings",
  );
  assert(
    (
      await readFile(
        packagePath(
          backupRoot,
          missingJobId,
          (
            await database.query("SELECT created_at FROM system_backup_jobs WHERE id=$1", [
              missingJobId,
            ])
          ).rows[0].created_at,
        ),
      )
    ).length > 0,
  );
  assert.equal(
    (
      await database.query(
        `SELECT count(*)::int AS count FROM system_backup_file_issues WHERE job_id=$1`,
        [missingJobId],
      )
    ).rows[0].count,
    7,
  );
  const staleJobId = randomUUID();
  await database.query(
    `INSERT INTO system_backup_jobs(id,requested_by_user_id,request_id,created_at,heartbeat_at)
     VALUES($1,$2,$3,now()-interval '1 hour',now()-interval '11 minutes')`,
    [staleJobId, actor, randomUUID()],
  );
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/expire-system-backups.mjs", "--once"], {
      cwd: process.cwd(),
      stdio: "ignore",
      windowsHide: true,
      env: {
        ...process.env,
        PGDATABASE: name,
        UPLOAD_ROOT: uploadRoot,
        BACKUP_ROOT: backupRoot,
        BACKUP_SNAPSHOT_ROOT: snapshotRoot,
      },
    });
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`Worker kedaluwarsa exit ${code}`)),
    );
  });
  assert.equal(
    (await database.query(`SELECT status FROM system_backup_jobs WHERE id=$1`, [staleJobId]))
      .rows[0].status,
    "failed",
  );
  const orphanJobId = randomUUID();
  await database.query(
    `INSERT INTO system_backup_jobs(id,requested_by_user_id,request_id,created_at)
    VALUES($1,$2,$3,now()-interval '2 minutes')`,
    [orphanJobId, actor, randomUUID()],
  );
  assert.equal(await reconcileStalledBackups(database), 1);
  const orphan = (
    await database.query(`SELECT status,error_code FROM system_backup_jobs WHERE id=$1`, [
      orphanJobId,
    ])
  ).rows[0];
  assert.equal(orphan.status, "failed");
  assert.equal(orphan.error_code, "WORKER_START_TIMEOUT");
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/run-system-backup.mjs", orphanJobId], {
      cwd: process.cwd(),
      stdio: ["pipe", "ignore", "ignore"],
      windowsHide: true,
      env: {
        ...process.env,
        PGDATABASE: name,
        UPLOAD_ROOT: uploadRoot,
        BACKUP_ROOT: backupRoot,
        BACKUP_SNAPSHOT_ROOT: snapshotRoot,
        PG_DUMP_PATH: pgDumpPath,
      },
    });
    child.stdin.end(password + "\n");
    child.once("error", reject);
    child.once("close", resolve);
  });
  assert.equal(
    (await database.query(`SELECT status FROM system_backup_jobs WHERE id=$1`, [orphanJobId]))
      .rows[0].status,
    "failed",
    "Worker lama tidak boleh menghidupkan pekerjaan gagal.",
  );
  console.log("Backup database dan dua organisasi berhasil dibuat serta diverifikasi.");
} finally {
  if (database) await database.end().catch(() => {});
  if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`).catch(() => {});
  await admin.end().catch(() => {});
  if (root.startsWith(path.resolve(os.tmpdir()) + path.sep))
    await rm(root, { recursive: true, force: true });
}
