import { createCipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { appendFile, link, lstat, mkdir, mkdtemp, opendir, realpath, rm, stat, statfs, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import dotenv from "dotenv";
import pg from "pg";
import { backupPaths, packagePath } from "../lib/system-backup/paths.mjs";
import { STORED_FILE_REFERENCES } from "../lib/storage-maintenance/policy.mjs";
import { verifyArchive } from "../lib/system-backup/archive.mjs";

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

async function runCommand(binary, args, env, timeoutMs, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { env, windowsHide: true, stdio: ["ignore", outputPath ? "pipe" : "pipe", "pipe"] });
    let stderr = "";
    let stdout = "";
    const timer = setTimeout(() => child.kill(), timeoutMs);
    const output = outputPath ? createWriteStream(outputPath, { flags: "wx", mode: 0o600 }) : null;
    if (output) {
      output.once("error", reject);
      child.stdout.pipe(output);
    }
    else child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8").slice(0, 200); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8").slice(0, 300); });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", async (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`Perintah database gagal (${code}): ${stderr.slice(0, 200)}`));
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

/** Referensi domain nyata harus tersedia dalam snapshot dan sesuai metadata. */
async function collectReferencedFiles(client) {
  const references = STORED_FILE_REFERENCES.map(({ table, column }) =>
    `SELECT organization_id,${column} AS file_id FROM ${table} WHERE ${column} IS NOT NULL`
  ).join(" UNION ");
  return (await client.query(
    `SELECT CASE WHEN f.lifecycle_status='quarantined' THEN
       q.quarantine_object_key ELSE f.object_key END AS object_key,
       COALESCE(f.sha256,q.sha256) AS sha256,f.size_bytes,f.storage_provider
     FROM (${references}) ref JOIN stored_files f
       ON f.organization_id=ref.organization_id AND f.id=ref.file_id
     LEFT JOIN file_quarantine_items q ON q.organization_id=f.organization_id
       AND q.stored_file_id=f.id AND q.status='quarantined'`,
  )).rows;
}

async function validateReferencedFiles(references, snapshotDirectory) {
  for (const file of references) {
    if (file.storage_provider !== "local_private")
      throw new Error("Ada file aktif di storage eksternal yang belum didukung backup ini.");
    const relative = String(file.object_key || "").replaceAll("/", path.sep);
    const target = path.resolve(snapshotDirectory, relative);
    if (!target.startsWith(snapshotDirectory + path.sep))
      throw new Error("Ada lokasi file aktif yang tidak aman.");
    const actual = await digestFile(target).catch(() => null);
    if (!actual || actual.size !== Number(file.size_bytes) ||
        (file.sha256 && actual.sha256 !== file.sha256.trim()))
      throw new Error("Ada file yang masih digunakan tetapi hilang atau berubah. Periksa menu Penyimpanan File.");
  }
}

/** Membatasi seluruh mutasi PostgreSQL selama snapshot file dan dump dibuat. */
async function consistentSnapshot(snapshotDirectory, dumpPath) {
  const client = await pool.connect();
  let keeper;
  let inTransaction = false;
  let keeperTransaction = false;
  try {
    const tables = await client.query(
      `SELECT quote_ident(n.nspname)||'.'||quote_ident(c.relname) AS name
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY name`,
    );
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
    const pgDump = process.env.PG_DUMP_PATH || "pg_dump";
    await runCommand(pgDump,
      ["--format=custom", "--no-owner", "--no-acl", `--snapshot=${stableSnapshotId}`,
        "--host", connection.host || "localhost", "--port", String(connection.port),
        "--username", connection.user, "--dbname", connection.database],
      { ...process.env, PGPASSWORD: connection.password || "" }, 2 * 60 * 60 * 1000, dumpPath);
    const organizationCount = Number((await keeper.query("SELECT count(*)::int AS count FROM organizations")).rows[0].count);
    const references = await collectReferencedFiles(keeper);
    await keeper.query("COMMIT");
    keeperTransaction = false;
    return { files, references, organizationCount };
  } finally {
    if (inTransaction) await client.query("ROLLBACK").catch(() => {});
    if (keeperTransaction) await keeper.query("ROLLBACK").catch(() => {});
    keeper?.release();
    client.release();
  }
}

async function* archiveContents(manifest, files) {
  yield Buffer.from(JSON.stringify(manifest) + "\n", "utf8");
  for (const file of files) {
    const check = createHash("sha256");
    let size = 0;
    for await (const chunk of createReadStream(file.absolutePath)) {
      check.update(chunk);
      size += chunk.length;
      yield chunk;
    }
    if (size !== file.size || check.digest("hex") !== file.sha256)
      throw new Error("Isi file berubah saat paket dibuat.");
  }
}

async function createPackage(password, archivePath, files, organizationCount) {
  const indexed = [];
  for (const file of files) indexed.push({ ...file, ...await digestFile(file.absolutePath) });
  const manifest = {
    format: 1,
    createdAt: new Date().toISOString(),
    organizationCount,
    fileCount: indexed.length - 1,
    files: indexed.map(({ path: relative, size, sha256 }) => ({ path: relative, size, sha256 })),
  };
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(password, salt, 32, { N: 32768, maxmem: 64 * 1024 * 1024 });
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  await writeFile(archivePath, Buffer.concat([MAGIC, salt, iv]), { flag: "wx", mode: 0o600 });
  await pipeline(Readable.from(archiveContents(manifest, indexed)), createGzip(), cipher,
    createWriteStream(archivePath, { flags: "a", mode: 0o600 }));
  await appendFile(archivePath, cipher.getAuthTag());
  key.fill(0);
  return { manifest, ...(await digestFile(archivePath)) };
}

async function mark(status, details = {}) {
  await pool.query(
    `UPDATE system_backup_jobs SET status=$2::varchar,started_at=COALESCE(started_at,now()),
      heartbeat_at=now(),
      organization_count=COALESCE($3,organization_count),file_count=COALESCE($4,file_count),
      file_bytes=COALESCE($5,file_bytes),package_bytes=COALESCE($6,package_bytes),
      package_sha256=COALESCE($7,package_sha256),package_path=COALESCE($8,package_path),
      error_code=$9,error_message=$10,
      completed_at=CASE WHEN $2::varchar IN ('ready','failed') THEN now() ELSE completed_at END,
      expires_at=CASE WHEN $2::varchar='ready' THEN now()+interval '24 hours' ELSE expires_at END
     WHERE id=$1`,
    [jobId,status,details.organizationCount ?? null,details.fileCount ?? null,
      details.fileBytes ?? null,details.packageBytes ?? null,details.packageSha256 ?? null,
      details.packagePath ?? null,details.errorCode ?? null,details.errorMessage ?? null],
  );
}

let workDirectory;
let archivePath;
const heartbeat = setInterval(() => {
  pool.query(
    `UPDATE system_backup_jobs SET heartbeat_at=now() WHERE id=$1
     AND status IN ('queued','copying','securing','verifying')`, [jobId],
  ).catch(() => {});
}, 30_000);
heartbeat.unref();
try {
  const password = await readPassword();
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
  const version = await runCommand(process.env.PG_DUMP_PATH || "pg_dump", ["--version"], process.env, 5000);
  const serverVersion = Number((await pool.query("SHOW server_version_num")).rows[0].server_version_num);
  const dumpMajor = Number(version.match(/(\d+)(?:\.\d+)?\s*$/)?.[1]);
  if (!Number.isFinite(dumpMajor) || dumpMajor < Math.floor(serverVersion / 10000))
    throw new Error("Versi pg_dump lebih lama daripada PostgreSQL server.");
  await mark("copying");
  workDirectory = await mkdtemp(path.join(paths.snapshotRoot, `${jobId}-`));
  const uploadSnapshot = path.join(workDirectory, "uploads");
  const dumpPath = path.join(workDirectory, "database.dump");
  const { files, references, organizationCount } = await consistentSnapshot(uploadSnapshot, dumpPath);
  if (freeBytes < databaseBytes + files.reduce((total, file) => total + file.size, 0))
    throw new Error("Ruang penyimpanan backup tidak mencukupi.");
  await validateReferencedFiles(references, uploadSnapshot);
  await mark("securing", { organizationCount, fileCount: files.length,
    fileBytes: files.reduce((n, file) => n + file.size, 0) });
  archivePath = packagePath(paths.backupRoot, jobId);
  const result = await createPackage(password, archivePath,
    [{ path: "database.dump", absolutePath: dumpPath },
      ...files.map((file) => ({ ...file, path: `uploads/${file.path}` }))], organizationCount);
  await mark("verifying");
  if ((await stat(archivePath)).size !== result.size)
    throw new Error("Ukuran paket backup tidak sesuai.");
  await verifyArchive(archivePath, password);
  await mark("ready", { packageBytes: result.size, packageSha256: result.sha256, packagePath: archivePath });
  await pool.query(
    `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,after_data,request_id)
     SELECT requested_by_user_id,'system_backup.ready','system_backup_job',id::text,
       jsonb_build_object('fileCount',file_count,'packageBytes',package_bytes),request_id
     FROM system_backup_jobs WHERE id=$1`, [jobId]);
} catch (error) {
  const message = /file.*digunakan|file.*berubah/i.test(error.message)
    ? "Ada file yang masih digunakan tetapi hilang atau berubah. Periksa menu Penyimpanan File."
    : /pg_dump|PostgreSQL/i.test(error.message)
      ? "Pencadangan database gagal. Periksa pg_dump dan log server."
      : /jeda|120/i.test(error.message)
        ? "Jeda perubahan melebihi dua menit. Coba lagi saat sistem lebih sepi."
        : /ruang penyimpanan/i.test(error.message)
          ? "Ruang penyimpanan server tidak cukup untuk membuat backup."
        : "Backup gagal. Periksa ruang penyimpanan dan log server.";
  console.error("[system_backup.failed]", { jobId, code: error.code || "BACKUP_FAILED" });
  await mark("failed", { errorCode: error.code || "BACKUP_FAILED", errorMessage: message }).catch(() => {});
  await pool.query(
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
