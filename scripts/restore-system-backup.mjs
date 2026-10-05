import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, realpath, rename, rm, statfs, writeFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { backupPaths } from "../lib/system-backup/paths.mjs";
import { verifyArchive } from "../lib/system-backup/archive.mjs";

const options = Object.fromEntries(process.argv.slice(2).filter((value) => value.startsWith("--") && value.includes("="))
  .map((value) => { const index = value.indexOf("="); return [value.slice(2, index), value.slice(index + 1)]; }));
const apply = process.argv.includes("--apply");
if (!options.package || !options.env || (apply && !options.confirm))
  throw new Error("Gunakan: npm run backup:restore -- --package=PAKET --env=.env.production [--apply --confirm=NAMA_DATABASE] [--accept-version-mismatch]");
const loaded = dotenv.config({ path: path.resolve(options.env), quiet: true, override: true });
if (loaded.error) throw new Error("File konfigurasi tujuan tidak dapat dibaca.");
const source = path.resolve(options.package);
const { uploadRoot } = backupPaths();
const dbName = process.env.PGDATABASE;
if (!dbName || !process.env.PGUSER || !process.env.PGPASSWORD)
  throw new Error("Konfigurasi PostgreSQL tujuan belum lengkap.");
if (apply && options.confirm !== dbName)
  throw new Error("Nama database konfirmasi tidak cocok dengan tujuan.");
const parent = path.dirname(uploadRoot);
const existing = await lstat(uploadRoot).catch((error) => { if (error.code === "ENOENT") return null; throw error; });
if (existing && (!existing.isDirectory() || existing.isSymbolicLink()))
  throw new Error("UPLOAD_ROOT tujuan harus berupa direktori asli, bukan tautan.");
const resolvedParent = await realpath(parent);
if (path.resolve(resolvedParent, path.basename(uploadRoot)) !== uploadRoot)
  throw new Error("Induk UPLOAD_ROOT menggunakan tautan atau path tidak aman.");
const adminDatabase = process.env.PGADMIN_DATABASE || "postgres";
if (dbName === adminDatabase) throw new Error("Database SITOU tidak boleh sama dengan database administrasi.");
console.log(`Tujuan: database ${dbName} pada ${process.env.PGHOST || "localhost"}; file ${uploadRoot}.`);
if (apply) console.log("Clean restore akan mengganti SEMUA data organisasi ke keadaan dalam paket backup.");

async function passwordPrompt() {
  if (!process.stdin.isTTY) {
    let value = "";
    for await (const chunk of process.stdin) value += chunk.toString("utf8");
    return value.replace(/[\r\n]+$/, "");
  }
  process.stdout.write("Kata sandi backup: ");
  return new Promise((resolve, reject) => {
    let value = "";
    process.stdin.setRawMode(true); process.stdin.resume();
    const receive = (buffer) => {
      const chunk = buffer.toString("utf8");
      if (chunk === "\r" || chunk === "\n") finish();
      else if (chunk === "\u0003") finish(new Error("Dibatalkan."));
      else if (chunk === "\u007f" || chunk === "\b") value = value.slice(0, -1);
      else if (!/[\r\n]/.test(chunk) && value.length < 128) value += chunk;
    };
    const finish = (error) => {
      process.stdin.off("data", receive); process.stdin.setRawMode(false); process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error); else resolve(value);
    };
    process.stdin.on("data", receive);
  });
}

function run(binary, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { env, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk.toString("utf8")).slice(-2048); });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`Perintah PostgreSQL gagal (${code}). ${stderr.replace(/password\s*[:=]\s*\S+/gi, "password=[redacted]")}`)));
  });
}

const password = await passwordPrompt();
if (!password) throw new Error("Kata sandi wajib diisi.");
const manifest = await verifyArchive(source, password);
const dumpEntry = manifest.files.find((file) => file.path === "database.dump");
const uploadBytes = manifest.files.filter((file) => file.path.startsWith("uploads/"))
  .reduce((sum, file) => sum + file.size, 0);
const available = await statfs(parent);
if (Number(available.bavail) * Number(available.bsize) < uploadBytes + dumpEntry.size)
  throw new Error("Ruang disk untuk staging file tidak mencukupi.");

const pgRestore = process.env.PG_RESTORE_PATH || "pg_restore";
const version = spawnSync(pgRestore, ["--version"], { encoding: "utf8", windowsHide: true });
if (version.error || version.status !== 0) throw new Error("pg_restore tidak tersedia pada server ini.");
const revision = spawnSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8", windowsHide: true });
const currentRevision = revision.status === 0 ? revision.stdout.trim() : null;
if (apply && (!manifest.appRevision || !currentRevision || manifest.appRevision !== currentRevision) &&
    !process.argv.includes("--accept-version-mismatch"))
  throw new Error("Versi kode tidak dapat dibuktikan cocok dengan backup. Gunakan versi aplikasi saat backup, atau flag --accept-version-mismatch setelah pemeriksaan manual.");

console.log(`Paket: ${manifest.organizationCount} organisasi, ${manifest.fileCount} file, ${manifest.issueCount || 0} temuan.`);
if (!apply) {
  console.log("Pemeriksaan paket selesai. Untuk clean restore, hentikan web dan seluruh worker lalu jalankan dengan --apply dan --confirm=NAMA_DATABASE.");
  process.exit(0);
}

const token = randomUUID().replaceAll("-", "").slice(0, 12);
const stageDb = `sitou_restore_${token}`;
const oldDb = `sitou_before_${token}`;
const oldUploads = `${uploadRoot}.before-${token}`;
const stageRoot = await mkdtemp(path.join(parent, `.sitou-restore-${token}-`));
const stageUploads = path.join(stageRoot, "uploads");
const journal = path.join(stageRoot, "restore-journal.json");
const admin = new pg.Client({ user: process.env.PGUSER, password: process.env.PGPASSWORD,
  host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432), database: adminDatabase });
let stageCreated = false; let oldDatabaseRenamed = false; let newDatabaseRenamed = false;
let oldFilesRenamed = false; let newFilesRenamed = false; let complete = false; let rolledBack = false;
const identifier = pg.escapeIdentifier;
async function phase(name) {
  await writeFile(journal, JSON.stringify({ phase: name, database: dbName, stageDb, oldDb,
    uploadRoot, oldUploads, stageRoot, time: new Date().toISOString() }, null, 2), { mode: 0o600 });
}
try {
  await verifyArchive(source, password, { extractRoot: stageRoot });
  await mkdir(stageUploads, { recursive: true, mode: 0o700 });
  await run(pgRestore, ["--list", path.join(stageRoot, "database.dump")]);
  await admin.connect();
  const targetVersion = Number((await admin.query("SHOW server_version_num")).rows[0].server_version_num);
  const archiveMajor = manifest.postgresMajor;
  if (archiveMajor && archiveMajor !== Math.floor(targetVersion / 10000))
    throw new Error("Versi utama PostgreSQL tujuan tidak sama dengan sumber backup.");
  const active = await admin.query(`SELECT count(*)::int AS count FROM pg_stat_activity
    WHERE datname=$1 AND backend_type='client backend' AND pid<>pg_backend_pid()`, [dbName]);
  if (active.rows[0].count) throw new Error("Aplikasi atau worker masih terhubung ke database. Hentikan semuanya sebelum restore.");
  await phase("staging");
  await admin.query(`CREATE DATABASE ${identifier(stageDb)}`);
  stageCreated = true;
  await run(pgRestore, ["--no-owner", "--no-acl", "--exit-on-error", "--dbname", stageDb,
    "--host", process.env.PGHOST || "localhost", "--port", String(process.env.PGPORT || 5432),
    "--username", process.env.PGUSER, path.join(stageRoot, "database.dump")],
  { ...process.env, PGPASSWORD: process.env.PGPASSWORD });
  const staged = new pg.Client({ user: process.env.PGUSER, password: process.env.PGPASSWORD,
    host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432), database: stageDb });
  try {
    await staged.connect();
    const count = await staged.query("SELECT count(*)::int AS count FROM organizations");
    if (count.rows[0].count !== manifest.organizationCount)
      throw new Error("Jumlah organisasi hasil restore tidak cocok dengan paket.");
  } finally { await staged.end().catch(() => {}); }
  const sessions = await admin.query(`SELECT count(*)::int AS count FROM pg_stat_activity
    WHERE datname=$1 AND backend_type='client backend' AND pid<>pg_backend_pid()`, [dbName]);
  if (sessions.rows[0].count) throw new Error("Koneksi database tujuan muncul kembali. Batalkan cutover dan hentikan layanan.");
  await phase("cutover-database");
  await admin.query(`ALTER DATABASE ${identifier(dbName)} RENAME TO ${identifier(oldDb)}`);
  oldDatabaseRenamed = true;
  await admin.query(`ALTER DATABASE ${identifier(stageDb)} RENAME TO ${identifier(dbName)}`);
  newDatabaseRenamed = true;
  if (process.env.NODE_ENV === "test" && process.env.SITOU_RESTORE_TEST_FAILURE === "after-db")
    throw new Error("Simulasi kegagalan cutover file.");
  await phase("cutover-files");
  if (existing) { await rename(uploadRoot, oldUploads); oldFilesRenamed = true; }
  else await mkdir(oldUploads, { mode: 0o700 });
  await rename(stageUploads, uploadRoot);
  newFilesRenamed = true;
  await phase("complete");
  complete = true;
  console.log(`Restore selesai. Database sebelumnya: ${oldDb}; folder sebelumnya: ${oldUploads}.`);
  if (manifest.format === 2)
    console.log(`Laporan file bermasalah: ${path.join(stageRoot, "backup-file-issues.json")}`);
  console.log("Periksa aplikasi sebelum menghapus data rollback. Perubahan setelah backup tidak ada pada hasil restore.");
} catch (error) {
  try {
    if (newFilesRenamed) await rename(uploadRoot, stageUploads);
    if (oldFilesRenamed) await rename(oldUploads, uploadRoot);
    if (newDatabaseRenamed) await admin.query(`ALTER DATABASE ${identifier(dbName)} RENAME TO ${identifier(stageDb)}`);
    if (oldDatabaseRenamed) await admin.query(`ALTER DATABASE ${identifier(oldDb)} RENAME TO ${identifier(dbName)}`);
    await phase("rolled-back");
    rolledBack = true;
  } catch (rollbackError) {
    console.error("Rollback otomatis belum selesai. Jangan jalankan aplikasi; periksa jurnal restore:", journal);
    throw new AggregateError([error, rollbackError], "Restore dan rollback gagal.");
  }
  throw error;
} finally {
  await admin.end().catch(() => {});
  if (!complete && stageCreated && (!oldDatabaseRenamed || rolledBack)) {
    const cleanup = new pg.Client({ user: process.env.PGUSER, password: process.env.PGPASSWORD,
      host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432), database: adminDatabase });
    try { await cleanup.connect(); await cleanup.query(`DROP DATABASE IF EXISTS ${identifier(stageDb)}`); }
    catch { /* staging dipertahankan untuk inspeksi jika masih digunakan */ }
    finally { await cleanup.end().catch(() => {}); }
  }
  if (complete) await rm(path.join(stageRoot, "database.dump"), { force: true }).catch(() => {});
  else if ((!oldDatabaseRenamed && !newDatabaseRenamed && !oldFilesRenamed && !newFilesRenamed || rolledBack) &&
      stageRoot.startsWith(parent + path.sep))
    await rm(stageRoot, { recursive: true, force: true }).catch(() => {});
}
