import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { verifyArchive } from "../lib/system-backup/archive.mjs";
import { artifactPath, backupPaths, packagePath } from "../lib/system-backup/paths.mjs";
import { createEncryptedZip, createPlainZip, pairedManifest } from "../lib/system-backup/artifacts.mjs";

dotenv.config({ path: process.env.ENV_FILE || (process.env.NODE_ENV === "production" ? ".env.production" : ".env.development"), quiet: true });
const [jobId, kind] = process.argv.slice(2);
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId || "") ||
    !["database_zip", "uploads_zip"].includes(kind)) throw new Error("Permintaan ZIP tidak valid.");

let password = "";
for await (const chunk of process.stdin) {
  password += chunk.toString("utf8");
  if (Buffer.byteLength(password) > 1024) throw new Error("Kata sandi terlalu panjang.");
}
password = password.replace(/[\r\n]+$/, "");
const { backupRoot, snapshotRoot } = backupPaths();
const pool = new pg.Pool({ user: process.env.PGUSER, password: process.env.PGPASSWORD,
  host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432), database: process.env.PGDATABASE });
let temporary;
let stage = "verify";
const heartbeat = setInterval(() => pool.query(`UPDATE system_backup_artifacts SET updated_at=now()
  WHERE job_id=$1 AND kind=$2 AND status='creating'`, [jobId, kind]).catch(() => {}), 30_000);
heartbeat.unref();
try {
  const job = (await pool.query(`SELECT status,package_sha256 FROM system_backup_jobs WHERE id=$1`, [jobId])).rows[0];
  if (!job || !["ready", "ready_with_warnings"].includes(job.status))
    throw new Error("Paket utama tidak tersedia.");
  const source = packagePath(backupRoot, jobId);
  const verified = await verifyArchive(source, password);
  stage = "generate";
  temporary = await mkdtemp(path.join(snapshotRoot, `${jobId}-retry-`));
  await verifyArchive(source, password, { extractRoot: temporary });
  const pairingPath = path.join(temporary, "backup-pairing.json");
  await writeFile(pairingPath, JSON.stringify(pairedManifest(jobId, job.package_sha256.trim(), verified), null, 2),
    { flag: "wx", mode: 0o600 });
  const destination = artifactPath(backupRoot, jobId, kind);
  await rm(destination, { force: true });
  const innerZip = path.join(temporary, "uploads-inner.zip");
  if (kind === "uploads_zip")
    await createPlainZip(innerZip, verified.files.filter((file) => file.path.startsWith("uploads/"))
      .map((file) => ({ name: file.path,
        path: path.join(temporary, ...file.path.split("/")), sha256: file.sha256 })));
  const included = verified.files.filter((file) => kind === "database_zip"
    ? ["database.dump", "backup-file-issues.json"].includes(file.path)
    : file.path === "backup-file-issues.json");
  const entries = [...(kind === "uploads_zip" ? [{ name: "uploads.zip", path: innerZip }] : []),
    ...included.map((file) => ({ name: file.path,
      path: path.join(temporary, ...file.path.split("/")), sha256: file.sha256 })),
    { name: "backup-pairing.json", path: pairingPath }];
  const result = await createEncryptedZip(destination, password, entries);
  if ((await stat(destination)).size !== result.size) throw new Error("ZIP tidak lengkap.");
  const current = (await pool.query(`SELECT status FROM system_backup_jobs WHERE id=$1`, [jobId])).rows[0];
  if (!current || !["ready", "ready_with_warnings"].includes(current.status)) {
    await rm(destination, { force: true });
    throw new Error("Paket utama tidak tersedia lagi.");
  }
  await pool.query(`UPDATE system_backup_artifacts SET status='ready',size_bytes=$3,sha256=$4,
    internal_path=$5,error_message=NULL,updated_at=now() WHERE job_id=$1 AND kind=$2`,
  [jobId, kind, result.size, result.sha256, destination]);
} catch (error) {
  await pool.query(`UPDATE system_backup_artifacts SET status='failed',
    error_message=$3,updated_at=now() WHERE job_id=$1 AND kind=$2`,
  [jobId, kind, stage === "verify" ? "Paket tidak dapat dibuka. Periksa kata sandi atau unduh ulang paket utama." :
    "ZIP belum dapat dibuat. Coba lagi atau periksa ruang penyimpanan server."]).catch(() => {});
  console.error("[system_backup.artifact_retry_failed]", { jobId, kind, code: error.code || "RETRY_FAILED" });
} finally {
  clearInterval(heartbeat);
  if (temporary?.startsWith(snapshotRoot + path.sep))
    await rm(temporary, { recursive: true, force: true }).catch(() => {});
  await pool.end();
}
