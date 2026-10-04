import path from "node:path";

/** Backup sementara berada di luar upload agar tidak mencadangkan dirinya sendiri. */
export function backupPaths() {
  const uploadRoot = path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_ROOT || path.join(process.cwd(), "uploads"));
  const backupRoot = path.resolve(/* turbopackIgnore: true */ process.env.BACKUP_ROOT || path.join(process.cwd(), ".sitou-backups"));
  const snapshotRoot = path.resolve(
    /* turbopackIgnore: true */ process.env.BACKUP_SNAPSHOT_ROOT || path.join(path.dirname(uploadRoot), ".sitou-backup-snapshots"),
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
export function packagePath(root, id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("ID backup tidak valid.");
  return path.join(root, `${id}.sitou-backup`);
}
