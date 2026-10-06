import path from "node:path";
import { backupClock } from "./timezone.mjs";
import { lstat, realpath, mkdir, rmdir, rm } from "node:fs/promises";

/** Backup sementara berada di luar upload agar tidak mencadangkan dirinya sendiri. */
export function backupPaths() {
  const uploadRoot = path.resolve(
    /* turbopackIgnore: true */ process.env.UPLOAD_ROOT || path.join(process.cwd(), "uploads"),
  );
  const backupRoot = path.resolve(
    /* turbopackIgnore: true */ process.env.BACKUP_ROOT ||
      path.join(process.cwd(), ".sitou-backups"),
  );
  const snapshotRoot = path.resolve(
    /* turbopackIgnore: true */ process.env.BACKUP_SNAPSHOT_ROOT ||
      path.join(path.dirname(uploadRoot), ".sitou-backup-snapshots"),
  );
  const publicRoot = path.resolve(process.cwd(), "public");
  for (const target of [backupRoot, snapshotRoot]) {
    if (target === uploadRoot || target.startsWith(uploadRoot + path.sep))
      throw new Error("Direktori backup harus berada di luar UPLOAD_ROOT.");
    if (target === publicRoot || target.startsWith(publicRoot + path.sep))
      throw new Error("Direktori backup tidak boleh berada di folder public.");
  }
  if (uploadRoot === path.parse(uploadRoot).root)
    throw new Error("UPLOAD_ROOT tidak boleh berupa root volume.");
  return { uploadRoot, backupRoot, snapshotRoot };
}

/** Nama paket hanya diturunkan dari UUID yang tervalidasi, bukan input path browser. */
export function backupNames(id, createdAt, timeZone = "UTC") {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw new Error("ID backup tidak valid.");
  const date = new Date(createdAt);
  if (!createdAt || !Number.isFinite(date.getTime()))
    throw new Error("Tanggal backup tidak valid.");
  const { day, clock, label } = backupClock(createdAt, timeZone);
  const stamp = `${day.replaceAll("-", "")}_${clock.replaceAll("-", "")}_${label}`;
  return {
    folder: `backup_${day}_${clock}_${label}_${id.toLowerCase()}`,
    package: `sitou_full_backup_${stamp}.sitou-backup`,
    database_zip: `sitou_db_backup_${stamp}.zip`,
    uploads_zip: `sitou_uploads_backup_${stamp}.zip`,
    database: `sitou_db_backup_${stamp}.dump`,
  };
}

export function backupJobDirectory(root, id, createdAt, timeZone = "UTC") {
  return path.join(root, backupNames(id, createdAt, timeZone).folder);
}

export function packagePath(root, id, createdAt, timeZone = "UTC") {
  return path.join(
    backupJobDirectory(root, id, createdAt, timeZone),
    backupNames(id, createdAt, timeZone).package,
  );
}

export function artifactPath(root, id, kind, createdAt, timeZone = "UTC") {
  if (!["database_zip", "uploads_zip"].includes(kind))
    throw new Error("ID atau jenis artefak backup tidak valid.");
  return path.join(
    backupJobDirectory(root, id, createdAt, timeZone),
    backupNames(id, createdAt, timeZone)[kind],
  );
}

/** Membatasi semua akses artefak ke folder pekerjaan yang nyata, tanpa symlink. */
export async function assertBackupJobDirectory(
  root,
  id,
  createdAt,
  { create = false, timeZone = "UTC" } = {},
) {
  const directory = backupJobDirectory(root, id, createdAt, timeZone);
  if (create) await mkdir(directory, { mode: 0o700 });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Folder backup tidak aman.");
  const [rootReal, directoryReal] = await Promise.all([realpath(root), realpath(directory)]);
  if (path.dirname(directoryReal) !== rootReal) throw new Error("Folder backup keluar dari root.");
  return directory;
}

/** Hanya menghapus tiga artefak dikenal; file asing membuat folder tetap tersedia. */
export async function cleanupBackupJobFiles(
  root,
  id,
  createdAt,
  kinds = ["package", "database_zip", "uploads_zip"],
  timeZone = "UTC",
) {
  let directory;
  try {
    directory = await assertBackupJobDirectory(root, id, createdAt, { timeZone });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  const names = backupNames(id, createdAt, timeZone);
  for (const kind of kinds) {
    if (!["package", "database_zip", "uploads_zip"].includes(kind))
      throw new Error("Jenis artefak tidak valid.");
    const target = path.join(directory, names[kind]);
    try {
      const info = await lstat(target);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error("Artefak backup tidak aman.");
      await rm(target, { force: true });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  try {
    await rmdir(directory);
  } catch (error) {
    if (!["ENOTEMPTY", "EEXIST", "ENOENT"].includes(error.code)) throw error;
  }
}
