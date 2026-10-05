import path from "node:path";
import pg from "pg";
import { FILE_CATEGORY_LABELS, STORED_FILE_REFERENCES } from "../storage-maintenance/policy.mjs";

const ownerExpressions = {
  employees: "r.id",
  employee_identifiers: "r.employee_id",
  employee_educations: "r.employee_id",
  employee_certifications: "r.employee_id",
  employee_documents: "r.employee_id",
  employment_contracts: "r.employee_id",
  employee_assignments: "r.employee_id",
  employment_contract_document_versions: "contract.employee_id",
  employee_assignment_document_versions: "assignment.employee_id",
  attendance_events: "r.employee_id",
  leave_request_attachments: "leave_request.employee_id",
  disciplinary_actions: "r.employee_id",
};
const ownerJoins = {
  employment_contract_document_versions:
    "JOIN employment_contracts contract ON contract.organization_id=r.organization_id AND contract.id=r.employment_contract_id",
  employee_assignment_document_versions:
    "JOIN employee_assignments assignment ON assignment.organization_id=r.organization_id AND assignment.id=r.employee_assignment_id",
  leave_request_attachments:
    "JOIN leave_requests leave_request ON leave_request.organization_id=r.organization_id AND leave_request.id=r.leave_request_id",
};
const documentNames = { ktp: "KTP", kk: "Kartu Keluarga", npwp: "NPWP" };

export function maskBackupNip(value) {
  const nip = String(value || "");
  if (!nip) return null;
  return nip.length <= 4 ? "•".repeat(nip.length) : `${nip.slice(0, 2)}••••${nip.slice(-2)}`;
}

export function backupFileLabel(file, relationships) {
  const documentType = relationships.find((entry) => entry.documentType)?.documentType;
  if (documentType) return documentNames[documentType.toLowerCase()] ||
    (file.category === "identity" ? "Dokumen identitas" : FILE_CATEGORY_LABELS[file.category] || "File lainnya");
  return FILE_CATEGORY_LABELS[file.category] || "File lainnya";
}

export async function collectBackupMetadata(client) {
  const referenceSql = STORED_FILE_REFERENCES.map(({ table, column, label }) =>
    `SELECT r.organization_id,r.${column} AS file_id,${pg.escapeLiteral(label)} AS source,
       ${ownerExpressions[table] || "NULL::bigint"} AS employee_id,
       ${table === "employee_documents" ? "r.document_type" : "NULL::varchar"} AS document_type
     FROM ${table} r ${ownerJoins[table] || ""} WHERE r.${column} IS NOT NULL`
  ).join(" UNION ALL ");
  const [files, references] = await Promise.all([
    client.query(
      `SELECT f.id::text AS file_id,f.organization_id::text,org.name AS organization_name,
         f.employee_id::text,f.category,f.lifecycle_status,f.storage_provider,f.size_bytes,
         draft.status AS draft_status,
         COALESCE(f.sha256,q.sha256) AS sha256,f.content_purged_at,
         CASE WHEN f.lifecycle_status='quarantined' THEN q.quarantine_object_key
              ELSE f.object_key END AS object_key,
         employee.full_name AS employee_name,employee.employee_no
       FROM stored_files f JOIN organizations org ON org.id=f.organization_id
       LEFT JOIN employees employee ON employee.organization_id=f.organization_id AND employee.id=f.employee_id
       LEFT JOIN employee_onboarding_drafts draft ON draft.organization_id=f.organization_id
         AND draft.id=f.onboarding_draft_id
       LEFT JOIN file_quarantine_items q ON q.organization_id=f.organization_id
         AND q.stored_file_id=f.id AND q.status='quarantined'
       ORDER BY f.organization_id,f.id`,
    ),
    client.query(
      `SELECT ref.organization_id::text,ref.file_id::text,ref.source,
         ref.employee_id::text,ref.document_type,employee.full_name AS employee_name,
         employee.employee_no FROM (${referenceSql}) ref
       LEFT JOIN employees employee ON employee.organization_id=ref.organization_id
         AND employee.id=ref.employee_id`,
    ),
  ]);
  const byFile = new Map();
  for (const row of references.rows) {
    const key = `${row.organization_id}:${row.file_id}`;
    const group = byFile.get(key) || [];
    group.push(row);
    byFile.set(key, group);
  }
  return { files: files.rows, references: byFile };
}

/** Mengembalikan satu temuan per metadata file, tanpa object key atau path privat. */
export async function inspectBackupFiles(metadata, snapshotRoot, snapshotFiles, digestFile) {
  const available = new Set(snapshotFiles.map((file) => file.path.replaceAll("\\", "/")));
  const issues = [];
  for (const file of metadata.files) {
    const relations = metadata.references.get(`${file.organization_id}:${file.file_id}`) || [];
    if (file.lifecycle_status === "purged" && !relations.length) continue;
    if (file.content_purged_at && !relations.length) continue;
    if (file.storage_provider !== "local_private")
      throw new Error("Ada file pada penyimpanan eksternal yang belum didukung backup ini.");
    const key = String(file.object_key || "");
    const target = path.resolve(snapshotRoot, ...key.split("/"));
    if (!key || !target.startsWith(snapshotRoot + path.sep) ||
        key.split("/").some((part) => !part || part === "." || part === ".." || part.includes("\\")))
      throw new Error("Ada lokasi file yang tidak aman.");
    let issueType;
    if (!available.has(key)) issueType = "missing";
    else {
      const actual = await digestFile(target); // Kesalahan baca bukan file hilang yang boleh dilewati.
      if (actual.size !== Number(file.size_bytes)) issueType = "size_mismatch";
      else if (file.sha256 && actual.sha256 !== file.sha256.trim()) issueType = "hash_mismatch";
    }
    if (!issueType) continue;
    const owner = relations.find((entry) => entry.employee_id && entry.employee_name) ||
      (file.employee_id && file.employee_name ? file : null);
    const uniqueRelations = [...new Map(relations.map((entry) =>
      [`${entry.source}:${entry.employee_id || ""}:${entry.document_type || ""}`, {
        source: entry.source, employeeId: entry.employee_id || null,
        employeeName: entry.employee_name || null,
        nipMasked: maskBackupNip(entry.employee_no),
        documentType: entry.document_type || null,
      }])).values()];
    issues.push({
      organizationId: file.organization_id, organizationName: file.organization_name,
      storedFileId: file.file_id, employeeId: owner?.employee_id || null,
      employeeName: owner?.employee_name || null,
      employeeNoMasked: maskBackupNip(owner?.employee_no),
      fileLabel: backupFileLabel(file, uniqueRelations), issueType,
      priority: relations.length || ["active", "finalizing"].includes(file.draft_status)
        ? "restore" : "cleanup_review",
      relationships: uniqueRelations,
    });
  }
  return issues;
}
