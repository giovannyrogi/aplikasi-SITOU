import { createCipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { appendFile, link, lstat, mkdir, mkdtemp, opendir, realpath, rm, stat, statfs, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import dotenv from "dotenv";
import pg from "pg";
import { artifactPath, backupPaths, packagePath } from "../lib/system-backup/paths.mjs";
import { createEncryptedZip, createPlainZip, pairedManifest } from "../lib/system-backup/artifacts.mjs";
import { describeBackupFailure } from "../lib/system-backup/diagnostics.mjs";
import { collectBackupMetadata, inspectBackupFiles } from "../lib/system-backup/file-issues.mjs";
import { verifyArchive } from "../lib/system-backup/archive.mjs";
import { safeBackupCategory } from "../lib/system-backup/progress.mjs";
import { parsePgDumpMajorVersion } from "../lib/system-backup/postgres-version.mjs";

dotenv.config({
  path: process.env.ENV_FILE || (process.env.NODE_ENV === "production" ? ".env.production" : ".env.development"),
  quiet: true,
});

const jobId = process.argv[2];
if (!/^[0-9a-f-]{36}$/i.test(jobId || "")) throw new Error("ID pekerjaan backup tidak valid.");

const connection = {
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT || 5432),
};
const pool = new pg.Pool({ ...connection, max: 2 });
const paths = backupPaths();
const MAX_PAUSE_MS = 120_000;
const MAGIC = Buffer.from("SITOU-BACKUP-1\n");

/** Kata sandi diterima melalui pipe privat, dibatasi, dan tidak pernah ditulis ke log. */
async function readPassword() {
  let bytes = 0;
  let value = "";
  const timer = setTimeout(() => process.stdin.destroy(new Error("Kata sandi tidak diterima tepat waktu.")), 15_000);
  try {
    for await (const chunk of process.stdin) {
      bytes += chunk.length;
      if (bytes > 1024) throw new Error("Kata sandi backup terlalu panjang.");
      value += chunk.toString("utf8");
    }
  } finally {
    clearTimeout(timer);
  }
  if (!value.endsWith("\n")) throw new Error("Kata sandi backup tidak diterima.");
  return value.slice(0, -1);
}

async function runCommand(binary, args, env, timeoutMs, outputPath, onOutputBytes) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { env, windowsHide: true, stdio: ["ignore", outputPath ? "pipe" : "pipe", "pipe"] });
    let stderr = "";
    let stdout = "";
    const timer = setTimeout(() => child.kill(), timeoutMs);
    const output = outputPath ? createWriteStream(outputPath, { flags: "wx", mode: 0o600 }) : null;
    if (output) {
      output.once("error", (error) => { error.source = "backup_output"; reject(error); });
      if (onOutputBytes) child.stdout.on("data", (chunk) => onOutputBytes(chunk.length));
      child.stdout.pipe(output);
    }
    else child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8").slice(0, 200); });
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk.toString("utf8")).slice(0, 2048); });
    child.once("error", (error) => { clearTimeout(timer); error.source = "pg_dump"; reject(error); });
    child.once("close", async (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const failure = new Error(`Perintah database gagal (${code}).`);
        failure.code = "PG_DUMP_FAILED";
        failure.commandStderr = stderr;
        reject(failure);
      }
      else {
        if (output && !output.writableFinished)
          await new Promise((done, fail) => { output.once("finish", done); output.once("error", fail); }).catch(reject);
        resolve(stdout);
      }
    });
  });
}

/** Hardlink mempertahankan inode saat file sumber di-rename/purge; symlink ditolak. */
async function snapshotFiles(source, destination, prefix = "") {
  const files = [];
  await mkdir(destination, { recursive: true, mode: 0o700 });
  const directory = await opendir(source);
  for await (const entry of directory) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    const metadata = await lstat(sourcePath);
    if (metadata.isSymbolicLink() || (!metadata.isDirectory() && !metadata.isFile()))
      throw new Error("Jenis objek di UPLOAD_ROOT tidak didukung.");
    if (metadata.isDirectory()) files.push(...await snapshotFiles(sourcePath, destinationPath, relative));
    else {
      await link(sourcePath, destinationPath);
      files.push({ path: relative, absolutePath: destinationPath, size: metadata.size });
    }
  }
  return files;
}

async function digestFile(filePath) {
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
    size += chunk.length;
  }
  return { sha256: hash.digest("hex"), size };
}

/** Membatasi seluruh mutasi PostgreSQL selama snapshot file dan dump dibuat. */
let snapshotLockActive = false;
async function consistentSnapshot(snapshotDirectory, dumpPath, onPhase, onDumpBytes) {
  const client = await pool.connect();
  let keeper;
  let inTransaction = false;
  let keeperTransaction = false;
  let primaryReleased = false;
  try {
    const tables = await client.query(
      `SELECT quote_ident(n.nspname)||'.'||quote_ident(c.relname) AS name
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY name`,
    );
    snapshotLockActive = true;
    await client.query("BEGIN");
    inTransaction = true;
    await client.query("SET LOCAL lock_timeout='120s'");
    await client.query("SET LOCAL statement_timeout='120s'");
    const pauseStarted = Date.now();
    await client.query(`LOCK TABLE ${tables.rows.map((row) => row.name).join(",")} IN SHARE MODE`);
    const snapshotId = (await client.query("SELECT pg_export_snapshot() AS id")).rows[0].id;
    keeper = await pool.connect();
    await keeper.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    keeperTransaction = true;
    await keeper.query(`SET TRANSACTION SNAPSHOT ${pg.escapeLiteral(snapshotId)}`);
    const stableSnapshotId = (await keeper.query("SELECT pg_export_snapshot() AS id")).rows[0].id;
    const files = await snapshotFiles(paths.uploadRoot, snapshotDirectory);
    const elapsed = Date.now() - pauseStarted;
    if (elapsed >= MAX_PAUSE_MS) throw new Error("Penyalinan file melebihi batas jeda dua menit.");
    // Keeper memegang snapshot yang sama tanpa kunci tulis selama pg_dump berlangsung.
    await client.query("COMMIT");
    inTransaction = false;
    snapshotLockActive = false;
    // Sediakan koneksi pool untuk pembaruan progres selama pg_dump; keeper tetap menahan snapshot.
    client.release();
    primaryReleased = true;
    await onPhase("dump");
    const pgDump = process.env.PG_DUMP_PATH || "pg_dump";
    await runCommand(pgDump,
      ["--format=custom", "--no-owner", "--no-acl", `--snapshot=${stableSnapshotId}`,
        "--host", connection.host || "localhost", "--port", String(connection.port),
        "--username", connection.user, "--dbname", connection.database],
      { ...process.env, PGPASSWORD: connection.password || "" }, 2 * 60 * 60 * 1000, dumpPath, onDumpBytes);
    const organizationCount = Number((await keeper.query("SELECT count(*)::int AS count FROM organizations")).rows[0].count);
    const metadata = await collectBackupMetadata(keeper);
    await keeper.query("COMMIT");
    keeperTransaction = false;
    return { files, metadata, organizationCount };
  } finally {
    snapshotLockActive = false;
    if (inTransaction) await client.query("ROLLBACK").catch(() => {});
    if (keeperTransaction) await keeper.query("ROLLBACK").catch(() => {});
    keeper?.release();
    if (!primaryReleased) client.release();
  }
}

async function* archiveContents(manifest, files, onBytes) {
  yield Buffer.from(JSON.stringify(manifest) + "\n", "utf8");
  for (const file of files) {
    const check = createHash("sha256");
    let size = 0;
    for await (const chunk of createReadStream(file.absolutePath)) {
      check.update(chunk);
      size += chunk.length;
      yield chunk;
      if (onBytes) await onBytes(chunk.length, file.path);
    }
    if (size !== file.size || check.digest("hex") !== file.sha256)
      throw new Error("Isi file berubah saat paket dibuat.");
  }
}

async function createPackage(password, archivePath, files, organizationCount, issueCount, postgresMajor, onProgress) {
  const indexed = [];
  for (const file of files) indexed.push({ ...file, ...await digestFile(file.absolutePath) });
  const totalBytes = indexed.reduce((total, file) => total + file.size, 0);
  await onProgress?.(0, totalBytes, null);
  const manifest = {
    format: 2,
    createdAt: new Date().toISOString(),
    postgresMajor,
    appRevision: process.env.SITOU_RELEASE_SHA ||
      (spawnSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8", windowsHide: true }).stdout || "").trim() || null,
    organizationCount,
    fileCount: indexed.length - 2,
    issueCount,
    files: indexed.map(({ path: relative, size, sha256 }) => ({ path: relative, size, sha256 })),
  };
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(password, salt, 32, { N: 32768, maxmem: 64 * 1024 * 1024 });
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  await writeFile(archivePath, Buffer.concat([MAGIC, salt, iv]), { flag: "wx", mode: 0o600 });
  let copiedBytes = 0;
  await pipeline(Readable.from(archiveContents(manifest, indexed, async (count, filePath) => {
    copiedBytes += count;
    await onProgress?.(copiedBytes, totalBytes, safeBackupCategory(filePath));
  })), createGzip(), cipher,
    createWriteStream(archivePath, { flags: "a", mode: 0o600 }));
  await appendFile(archivePath, cipher.getAuthTag());
  key.fill(0);
  return { manifest, ...(await digestFile(archivePath)) };
}

async function mark(status, details = {}) {
  const result = await pool.query(
    `UPDATE system_backup_jobs SET status=$2::varchar,started_at=COALESCE(started_at,now()),
      heartbeat_at=now(),
      organization_count=COALESCE($3,organization_count),file_count=COALESCE($4,file_count),
      issue_count=COALESCE($11,issue_count),
      file_bytes=COALESCE($5,file_bytes),package_bytes=COALESCE($6,package_bytes),
      package_sha256=COALESCE($7,package_sha256),package_path=COALESCE($8,package_path),
      error_code=$9,error_message=$10,
      completed_at=CASE WHEN $2::varchar IN ('ready','ready_with_warnings','failed') THEN now() ELSE completed_at END
     WHERE id=$1 AND status IN ('queued','copying','securing','verifying')`,
    [jobId,status,details.organizationCount ?? null,details.fileCount ?? null,
      details.fileBytes ?? null,details.packageBytes ?? null,details.packageSha256 ?? null,
      details.packagePath ?? null,details.errorCode ?? null,details.errorMessage ?? null,
      details.issueCount ?? null],
  );
  if (result.rowCount !== 1) throw new Error("Pekerjaan backup sudah tidak aktif.");
}

let lastProgressWrite = 0;
let lastProgressStage = "";
async function reportProgress(stage, done = 0, total = null, unit = null, category = null, force = false) {
  const now = Date.now();
  if (!force && stage === lastProgressStage && now - lastProgressWrite < 1000) return;
  const changed = stage !== lastProgressStage;
  lastProgressStage = stage;
  lastProgressWrite = now;
  const result = await pool.query(`UPDATE system_backup_jobs SET
    progress_stage=$2::varchar,progress_done=CASE WHEN progress_stage=$2::varchar
      THEN GREATEST(progress_done,$3::bigint) ELSE $3::bigint END,
    progress_total=$4::bigint,progress_unit=$5::varchar,progress_category=$6::varchar,
    progress_updated_at=now(),heartbeat_at=now(),
    started_at=COALESCE(started_at,now())
    WHERE id=$1 AND status IN ('queued','copying','securing','verifying')`,
  [jobId, stage, done, total, unit, category]);
  if (result.rowCount !== 1) throw new Error("Pekerjaan backup sudah tidak aktif.");
  if (changed) currentPhase = stage;
}

let lastArtifactWrite = 0;
async function reportArtifact(kind, done, total, force = false) {
  const now = Date.now();
  if (!force && now - lastArtifactWrite < 1000) return;
  lastArtifactWrite = now;
  const result = await pool.query(`UPDATE system_backup_artifacts SET
    progress_done=GREATEST(progress_done,$3),progress_total=$4,
    progress_updated_at=now(),updated_at=now()
    WHERE job_id=$1 AND kind=$2 AND status='creating'`, [jobId, kind, done, total]);
  if (result.rowCount !== 1) throw new Error("Pembuatan ZIP sudah tidak aktif.");
}

async function saveIssues(issues) {
  if (!issues.length) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const issue of issues) await client.query(
      `INSERT INTO system_backup_file_issues
       (job_id,organization_id,organization_name,stored_file_id,employee_id,employee_name,
        employee_no_masked,file_label,issue_type,priority,relationships)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
      [jobId,issue.organizationId,issue.organizationName,issue.storedFileId,issue.employeeId,
        issue.employeeName,issue.employeeNoMasked,issue.fileLabel,issue.issueType,issue.priority,
        JSON.stringify(issue.relationships)],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

let workDirectory;
let archivePath;
let currentPhase = "preparation";
const heartbeat = setInterval(() => {
  if (snapshotLockActive) return;
  pool.query(
    `UPDATE system_backup_jobs SET heartbeat_at=now() WHERE id=$1
     AND status IN ('queued','copying','securing','verifying')`, [jobId],
  ).catch(() => {});
  pool.query(`UPDATE system_backup_artifacts SET updated_at=now()
    WHERE job_id=$1 AND status='creating'`, [jobId]).catch(() => {});
}, 30_000);
heartbeat.unref();
try {
  const password = await readPassword();
  await reportProgress("preparing", 0, null, null, null, true);
  process.send?.({ type: "backup-started" });
  await mkdir(paths.uploadRoot, { recursive: true });
  await mkdir(paths.backupRoot, { recursive: true, mode: 0o700 });
  await mkdir(paths.snapshotRoot, { recursive: true, mode: 0o700 });
  const uploadReal = await realpath(paths.uploadRoot);
  const publicReal = await realpath(path.join(process.cwd(), "public"));
  for (const target of [paths.backupRoot, paths.snapshotRoot]) {
    const real = await realpath(target);
    if (real === uploadReal || real.startsWith(uploadReal + path.sep) ||
        real === publicReal || real.startsWith(publicReal + path.sep))
      throw new Error("Lokasi backup tidak privat atau berada di dalam folder upload.");
  }
  const databaseBytes = Number((await pool.query("SELECT pg_database_size(current_database())::bigint AS bytes")).rows[0].bytes);
  const disk = await statfs(paths.backupRoot);
  const freeBytes = Number(disk.bavail) * Number(disk.bsize);
  if (freeBytes < databaseBytes * 2)
    throw new Error("Ruang penyimpanan backup tidak mencukupi.");
  currentPhase = "version";
  const version = await runCommand(process.env.PG_DUMP_PATH || "pg_dump", ["--version"], process.env, 5000);
  const serverVersion = Number((await pool.query("SHOW server_version_num")).rows[0].server_version_num);
  const dumpMajor = parsePgDumpMajorVersion(version);
  if (dumpMajor === null)
    throw new Error("Versi pg_dump tidak dapat dikenali. Periksa program pada PG_DUMP_PATH.");
  if (dumpMajor < Math.floor(serverVersion / 10000))
    throw new Error("Versi pg_dump lebih lama daripada PostgreSQL server.");
  await mark("copying");
  currentPhase = "snapshot";
  await reportProgress("snapshot", 0, null, "files", null, true);
  workDirectory = await mkdtemp(path.join(paths.snapshotRoot, `${jobId}-`));
  const uploadSnapshot = path.join(workDirectory, "uploads");
  const dumpPath = path.join(workDirectory, "database.dump");
  let dumpBytes = 0;
  let pendingDumpProgress = Promise.resolve();
  const { files, metadata, organizationCount } = await consistentSnapshot(uploadSnapshot, dumpPath,
    (phase) => reportProgress(phase, 0, null, "bytes", null, true),
    (bytes) => {
      dumpBytes += bytes;
      pendingDumpProgress = pendingDumpProgress.then(() =>
        reportProgress("dump", dumpBytes, null, "bytes")).catch(() => {});
    });
  await pendingDumpProgress;
  await reportProgress("inspect", 0, null, "files", null, true);
  if (freeBytes < databaseBytes + files.reduce((total, file) => total + file.size, 0))
    throw new Error("Ruang penyimpanan backup tidak mencukupi.");
  currentPhase = "validation";
  const issues = await inspectBackupFiles(metadata, uploadSnapshot, files, digestFile,
    (done, total, filePath) => reportProgress("inspect", done, total, "files",
      filePath ? safeBackupCategory(filePath) : null, done === total));
  await saveIssues(issues);
  const reportPath = path.join(workDirectory, "backup-file-issues.json");
  await writeFile(reportPath, JSON.stringify({ format: 1, jobId, issues }, null, 2),
    { flag: "wx", mode: 0o600 });
  await mark("securing", { organizationCount, fileCount: files.length,
    fileBytes: files.reduce((n, file) => n + file.size, 0), issueCount: issues.length });
  await reportProgress("package", 0, null, "bytes", null, true);
  archivePath = packagePath(paths.backupRoot, jobId);
  currentPhase = "package";
  const result = await createPackage(password, archivePath,
    [{ path: "database.dump", absolutePath: dumpPath },
      { path: "backup-file-issues.json", absolutePath: reportPath },
      ...files.map((file) => ({ ...file, path: `uploads/${file.path}` }))], organizationCount, issues.length,
    Math.floor(serverVersion / 10000),
    (done, total, category) => reportProgress("package", done, total, "bytes", category, done === total));
  await mark("verifying");
  currentPhase = "verify";
  await reportProgress("verify", 0, null, null, null, true);
  if ((await stat(archivePath)).size !== result.size)
    throw new Error("Ukuran paket backup tidak sesuai.");
  await verifyArchive(archivePath, password);
  await reportProgress("complete", 1, 1, "files", null, true);
  await mark(issues.length ? "ready_with_warnings" : "ready",
    { packageBytes: result.size, packageSha256: result.sha256, packagePath: archivePath });
  await pool.query(
    `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,after_data,request_id)
     SELECT requested_by_user_id,$2,'system_backup_job',id::text,
       jsonb_build_object('fileCount',file_count,'issueCount',issue_count,'packageBytes',package_bytes),request_id
     FROM system_backup_jobs WHERE id=$1`, [jobId,
      issues.length ? "system_backup.ready_with_warnings" : "system_backup.ready"]);
  try {
    for (const kind of ["database_zip", "uploads_zip"])
      await pool.query(`INSERT INTO system_backup_artifacts(job_id,kind,status)
        VALUES($1,$2,'pending') ON CONFLICT (job_id,kind) DO NOTHING`, [jobId, kind]);
    const pairingPath = path.join(workDirectory, "backup-pairing.json");
    await writeFile(pairingPath, JSON.stringify(pairedManifest(jobId, result.sha256, result.manifest), null, 2),
      { flag: "wx", mode: 0o600 });
    const fileHashes = new Map(result.manifest.files.map((file) => [file.path, file.sha256]));
    for (const kind of ["database_zip", "uploads_zip"]) {
      await pool.query(`UPDATE system_backup_artifacts SET status='creating',updated_at=now()
        WHERE job_id=$1 AND kind=$2`, [jobId, kind]);
      lastArtifactWrite = 0;
      const uploadOffset = kind === "uploads_zip" ? files.length : 0;
      const artifactTotal = uploadOffset + 3;
      await reportArtifact(kind, 0, artifactTotal, true);
      const destination = artifactPath(paths.backupRoot, jobId, kind);
      const innerZip = path.join(workDirectory, "uploads-inner.zip");
      try {
        if (kind === "uploads_zip")
          await createPlainZip(innerZip, files.map((file) => ({ name: `uploads/${file.path}`,
            path: file.absolutePath, sha256: fileHashes.get(`uploads/${file.path}`) })),
          (done) => reportArtifact(kind, done, artifactTotal, done === uploadOffset));
        const entries = kind === "database_zip"
          ? [{ name: "database.dump", path: dumpPath, sha256: fileHashes.get("database.dump") },
            { name: "backup-file-issues.json", path: reportPath },
            { name: "backup-pairing.json", path: pairingPath }]
          : [{ name: "uploads.zip", path: innerZip },
            { name: "backup-file-issues.json", path: reportPath },
            { name: "backup-pairing.json", path: pairingPath }];
        const zipped = await createEncryptedZip(destination, password, entries,
          (done) => reportArtifact(kind, uploadOffset + done, artifactTotal, done === entries.length));
        await pool.query(`UPDATE system_backup_artifacts SET status='ready',size_bytes=$3,
          sha256=$4,internal_path=$5,error_message=NULL,updated_at=now()
          WHERE job_id=$1 AND kind=$2`, [jobId, kind, zipped.size, zipped.sha256, destination]);
      } catch (error) {
        await pool.query(`UPDATE system_backup_artifacts SET status='failed',
          error_message='ZIP belum dapat dibuat. Coba lagi selama paket utama tersedia.',updated_at=now()
          WHERE job_id=$1 AND kind=$2`, [jobId, kind]).catch(() => {});
        console.error("[system_backup.artifact_failed]", { jobId, kind, code: error.code || "ZIP_FAILED" });
      } finally {
        if (kind === "uploads_zip") await rm(innerZip, { force: true }).catch(() => {});
      }
    }
  } catch (error) {
    await pool.query(`UPDATE system_backup_artifacts SET status='failed',
      error_message='ZIP belum dapat dibuat. Coba lagi selama paket utama tersedia.',updated_at=now()
      WHERE job_id=$1 AND status IN ('pending','creating')`, [jobId]).catch(() => {});
    console.error("[system_backup.artifacts_failed]", { jobId, code: error.code || "ZIP_FAILED" });
  }
} catch (error) {
  const failure = describeBackupFailure(error, currentPhase);
  console.error("[system_backup.failed]", { jobId, code: failure.code });
  let markedFailed = false;
  try {
    await mark("failed", { errorCode: failure.code, errorMessage: failure.message });
    markedFailed = true;
  } catch { /* Pekerjaan mungkin sudah ditutup pengawas; jangan tulis audit gagal kedua. */ }
  if (markedFailed) await pool.query(
    `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,after_data,request_id)
     SELECT requested_by_user_id,'system_backup.failed','system_backup_job',id::text,
       jsonb_build_object('errorCode',error_code),request_id
     FROM system_backup_jobs WHERE id=$1 AND status='failed'`, [jobId]).catch(() => {});
  if (archivePath) await rm(archivePath, { force: true }).catch(() => {});
} finally {
  clearInterval(heartbeat);
  if (workDirectory?.startsWith(paths.snapshotRoot + path.sep))
    await rm(workDirectory, { recursive: true, force: true }).catch(() => {});
  await pool.end();
}
