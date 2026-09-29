import path from "node:path";
import { STORED_FILE_REFERENCES } from "./policy.mjs";

export function resolveMaintenancePath(uploadRoot, file) {
  const root = path.resolve(uploadRoot);
  const expectedPrefix = `org_${file.organization_id}/`;
  if (!String(file.object_key || "").startsWith(expectedPrefix))
    return { valid: false, reasonCode: "organization_mismatch" };
  const absolutePath = path.resolve(root, ...String(file.object_key).split("/"));
  if (!absolutePath.startsWith(`${root}${path.sep}`))
    return { valid: false, reasonCode: "invalid_storage_path" };
  return { valid: true, absolutePath };
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
