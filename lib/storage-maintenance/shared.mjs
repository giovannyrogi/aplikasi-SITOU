import path from "node:path";
import { lstat } from "node:fs/promises";
import { STORED_FILE_REFERENCES } from "./policy.mjs";

export function resolveMaintenancePath(uploadRoot, file) {
  const root = path.resolve(uploadRoot);
  if (
    String(file.object_key || "").includes("\\") ||
    String(file.object_key || "")
      .split("/")
      .includes("..")
  )
    return { valid: false, reasonCode: "invalid_storage_path" };
  const expectedPrefix = `org_${file.organization_id}/`;
  if (!String(file.object_key || "").startsWith(expectedPrefix))
    return { valid: false, reasonCode: "organization_mismatch" };
  const absolutePath = path.resolve(root, ...String(file.object_key).split("/"));
  if (!absolutePath.startsWith(`${root}${path.sep}`))
    return { valid: false, reasonCode: "invalid_storage_path" };
  return { valid: true, absolutePath };
}

/** Reject symlinks in every path component; only ENOENT means missing content. */
export async function inspectMaintenancePath(uploadRoot, file) {
  const resolved = resolveMaintenancePath(uploadRoot, file);
  if (!resolved.valid) return resolved;
  return inspectPrivateStoragePath(uploadRoot, file.object_key);
}

/** Internal quarantine paths receive the same traversal/symlink checks as original files. */
export async function inspectPrivateStoragePath(uploadRoot, objectKey) {
  const root = path.resolve(uploadRoot);
  const key = String(objectKey || "");
  const absolutePath = path.resolve(root, ...key.split("/"));
  if (
    !key ||
    key.includes("\\") ||
    key.split("/").includes("..") ||
    !absolutePath.startsWith(root + path.sep)
  )
    return { valid: false, reasonCode: "invalid_storage_path" };
  const resolved = { valid: true, absolutePath };
  let current = path.resolve(uploadRoot);
  // An absent/unmounted upload root is an infrastructure failure, not a missing file.
  try {
    const rootDetails = await lstat(current);
    if (rootDetails.isSymbolicLink() || !rootDetails.isDirectory())
      return { valid: false, reasonCode: "invalid_storage_path" };
  } catch {
    return { valid: false, reasonCode: "storage_unavailable" };
  }
  try {
    const parts = path.relative(current, resolved.absolutePath).split(path.sep);
    for (const part of parts) {
      current = path.join(current, part);
      const details = await lstat(current);
      if (details.isSymbolicLink()) return { valid: false, reasonCode: "invalid_storage_path" };
    }
    const details = await lstat(current);
    if (!details.isFile()) return { valid: false, reasonCode: "invalid_storage_path" };
    return { ...resolved, exists: true, details };
  } catch (error) {
    if (error.code === "ENOENT") return { ...resolved, exists: false };
    return { valid: false, reasonCode: "storage_unavailable" };
  }
}

/** Short deletion transaction blocks concurrent reference writes, including FK key-share inserts. */
export async function lockFileReferences(database) {
  await database.query("SET LOCAL lock_timeout='3s'");
  const tables = [
    ...new Set(STORED_FILE_REFERENCES.map(({ table }) => table)),
    "stored_files",
    "employee_onboarding_drafts",
  ].sort();
  await database.query(`LOCK TABLE ${tables.join(",")} IN SHARE ROW EXCLUSIVE MODE`);
}

/** Classification is based on usage; category and antivirus do not protect unused bytes. */
export async function inspectFileUsage(database, uploadRoot, file) {
  if (file.lifecycle_status === "quarantined") return null;
  if (file.lifecycle_status === "draft" && file.onboarding_draft_id) {
    const draft = await database.query(
      "SELECT 1 FROM employee_onboarding_drafts WHERE id=$1 AND organization_id=$2 AND status IN ('active','finalizing')",
      [file.onboarding_draft_id, file.organization_id],
    );
    if (draft.rows.length) return null;
  }
  const references = await findStoredFileReferences(database, file.organization_id, file.id);
  const issue = (reasonCode) => ({
    status: "needs_review",
    itemKind: "issue",
    reasonCode,
    references,
  });
  if (file.storage_provider !== "local_private") return issue("unsupported_provider");
  const physical = await inspectMaintenancePath(uploadRoot, file);
  if (!physical.valid) return issue(physical.reasonCode);
  if (file.malware_scan_status === "infected") return issue("malware_infected");
  if (references.length) {
    if (!physical.exists) return issue("active_content_missing");
    if (
      file.deleted_at ||
      file.lifecycle_status === "purged" ||
      file.lifecycle_status === "retained"
    )
      return issue("metadata_status_invalid");
    if (file.malware_scan_status === "scan_error") return issue("malware_scan_error");
    return null;
  }
  const duplicate = await database.query(
    "SELECT 1 FROM stored_files WHERE storage_provider=$1 AND object_key=$2 AND id<>$3 LIMIT 1",
    [file.storage_provider, file.object_key, file.id],
  );
  if (duplicate.rows.length) return issue("active_object_key");
  if (file.lifecycle_status === "purged" && !physical.exists) return null;
  if (
    !file.deleted_at &&
    file.created_at &&
    Date.now() - new Date(file.created_at).getTime() < 86400000
  )
    return null;
  return {
    status: "eligible",
    itemKind: "candidate",
    reasonCode: physical.exists ? "unused_file" : "unreferenced_content_missing",
    references: [],
  };
}

export async function findStoredFileReferences(database, organizationId, fileId) {
  const references = [];
  for (const reference of STORED_FILE_REFERENCES) {
    const result = await database.query(
      `SELECT 1 FROM ${reference.table}
       WHERE organization_id=$1 AND ${reference.column}=$2 LIMIT 1`,
      [organizationId, fileId],
    );
    if (result.rows[0]) references.push(reference.label);
  }
  return references;
}
