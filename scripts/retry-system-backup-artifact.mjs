import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { verifyArchive } from "../lib/system-backup/archive.mjs";
import {
  artifactPath,
  backupPaths,
  packagePath,
  assertBackupJobDirectory,
} from "../lib/system-backup/paths.mjs";
import { createEncryptedZip, pairedManifest } from "../lib/system-backup/artifacts.mjs";

dotenv.config({
  path:
    process.env.ENV_FILE ||
    (process.env.NODE_ENV === "production" ? ".env.production" : ".env.development"),
  quiet: true,
});
const [jobId, kind] = process.argv.slice(2);
if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId || "") ||
  !["database_zip", "uploads_zip"].includes(kind)
)
  throw new Error("Permintaan ZIP tidak valid.");

let password = "";
for await (const chunk of process.stdin) {
  password += chunk.toString("utf8");
  if (Buffer.byteLength(password) > 1024) throw new Error("Kata sandi terlalu panjang.");
}
password = password.replace(/[\r\n]+$/, "");
const { backupRoot, snapshotRoot } = backupPaths();
const pool = new pg.Pool({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
});
let temporary;
let stage = "verify";
let lastProgressWrite = 0;
async function reportProgress(done, total, force = false) {
  const now = Date.now();
  if (!force && now - lastProgressWrite < 1000) return;
  lastProgressWrite = now;
  const result = await pool.query(
    `UPDATE system_backup_artifacts SET
    progress_done=GREATEST(progress_done,$3),progress_total=$4,
    progress_updated_at=now(),updated_at=now()
    WHERE job_id=$1 AND kind=$2 AND status='creating'`,
    [jobId, kind, done, total],
  );
  if (result.rowCount !== 1) throw new Error("Pembuatan ZIP sudah tidak aktif.");
}
const heartbeat = setInterval(
  () =>
    pool
      .query(
        `UPDATE system_backup_artifacts SET updated_at=now()
  WHERE job_id=$1 AND kind=$2 AND status='creating'`,
        [jobId, kind],
      )
      .catch(() => {}),
  30_000,
);
heartbeat.unref();
try {
  const job = (
    await pool.query(
      `SELECT status,package_sha256,created_at,time_zone FROM system_backup_jobs WHERE id=$1`,
      [jobId],
    )
  ).rows[0];
  if (!job || !["ready", "ready_with_warnings"].includes(job.status))
    throw new Error("Paket utama tidak tersedia.");
  await assertBackupJobDirectory(backupRoot, jobId, job.created_at, { timeZone: job.time_zone });
  const source = packagePath(backupRoot, jobId, job.created_at, job.time_zone);
  const verified = await verifyArchive(source, password);
  stage = "generate";
  temporary = await mkdtemp(path.join(snapshotRoot, `${jobId}-retry-`));
  await verifyArchive(source, password, { extractRoot: temporary });
  const pairingPath = path.join(temporary, "backup-pairing.json");
  await writeFile(
    pairingPath,
    JSON.stringify(pairedManifest(jobId, job.package_sha256.trim(), verified), null, 2),
    { flag: "wx", mode: 0o600 },
  );
  const destination = artifactPath(backupRoot, jobId, kind, job.created_at, job.time_zone);
  await rm(destination, { force: true });
  const uploads = verified.files.filter((file) => file.path.startsWith("uploads/"));
  const total = kind === "uploads_zip" ? uploads.length + 2 : 3;
  await reportProgress(0, total, true);
  const included = verified.files.filter((file) =>
    kind === "database_zip"
      ? [verified.databasePath, "backup-file-issues.json"].includes(file.path)
      : file.path === "backup-file-issues.json",
  );
  const entries = [
    ...(kind === "uploads_zip"
      ? uploads.map((file) => ({
          name: file.path,
          path: path.join(temporary, ...file.path.split("/")),
          sha256: file.sha256,
        }))
      : []),
    ...included.map((file) => ({
      name: file.path,
      path: path.join(temporary, ...file.path.split("/")),
      sha256: file.sha256,
    })),
    { name: "backup-pairing.json", path: pairingPath },
  ];
  const result = await createEncryptedZip(destination, password, entries, (done) =>
    reportProgress(done, total, done === entries.length),
  );
  if ((await stat(destination)).size !== result.size) throw new Error("ZIP tidak lengkap.");
  const current = (await pool.query(`SELECT status FROM system_backup_jobs WHERE id=$1`, [jobId]))
    .rows[0];
  if (!current || !["ready", "ready_with_warnings"].includes(current.status)) {
    await rm(destination, { force: true });
    throw new Error("Paket utama tidak tersedia lagi.");
  }
  await pool.query(
    `UPDATE system_backup_artifacts SET status='ready',size_bytes=$3,sha256=$4,
    internal_path=$5,error_message=NULL,updated_at=now() WHERE job_id=$1 AND kind=$2`,
    [jobId, kind, result.size, result.sha256, destination],
  );
} catch (error) {
  await pool
    .query(
      `UPDATE system_backup_artifacts SET status='failed',
    error_message=$3,updated_at=now() WHERE job_id=$1 AND kind=$2`,
      [
        jobId,
        kind,
        stage === "verify"
          ? "Paket tidak dapat dibuka. Periksa kata sandi atau unduh ulang paket utama."
          : "ZIP belum dapat dibuat. Coba lagi atau periksa ruang penyimpanan server.",
      ],
    )
    .catch(() => {});
  console.error("[system_backup.artifact_retry_failed]", {
    jobId,
    kind,
    code: error.code || "RETRY_FAILED",
  });
} finally {
  clearInterval(heartbeat);
  if (temporary?.startsWith(snapshotRoot + path.sep))
    await rm(temporary, { recursive: true, force: true }).catch(() => {});
  await pool.end();
}
