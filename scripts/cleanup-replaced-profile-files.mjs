import { randomUUID } from "node:crypto";
import { access, mkdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({
  path:
    process.env.ENV_FILE ||
    (process.env.NODE_ENV === "production" ? ".env.production" : ".env.development"),
  quiet: true,
});

const apply = process.argv.includes("--apply");
const categories = ["employee_photo", "identity", "education"];
const root = path.resolve(process.env.UPLOAD_ROOT || path.join(process.cwd(), "uploads"));
const trashRoot = path.join(root, ".trash", "profile-cleanup");
const pool = new pg.Pool({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT || 5432),
});

const candidateSql = `SELECT file.id::text,file.category,file.object_key
  FROM stored_files file
 WHERE file.deleted_at IS NOT NULL
   AND file.storage_provider='local_private'
   AND file.category=ANY($1::varchar[])
   AND file.object_key LIKE ('org_' || file.organization_id::text || '/%')
   AND NOT EXISTS (
     SELECT 1 FROM stored_files active_file
      WHERE active_file.object_key=file.object_key AND active_file.deleted_at IS NULL
   )
   AND NOT EXISTS (
     SELECT 1 FROM employment_contracts contract
      WHERE contract.organization_id=file.organization_id AND contract.document_file_id=file.id
   )
   AND NOT EXISTS (
     SELECT 1 FROM employee_assignments assignment
      WHERE assignment.organization_id=file.organization_id AND assignment.document_file_id=file.id
   )
   AND NOT EXISTS (
     SELECT 1 FROM disciplinary_actions action
      WHERE action.organization_id=file.organization_id AND action.document_file_id=file.id
   )
   AND NOT EXISTS (
     SELECT 1 FROM leave_request_attachments attachment
      WHERE attachment.organization_id=file.organization_id AND attachment.file_id=file.id
   )
 ORDER BY file.category,file.id`;

function resolveSafePath(objectKey) {
  const candidate = path.resolve(root, ...String(objectKey || "").split("/"));
  if (!candidate.startsWith(`${root}${path.sep}`))
    throw new Error("Path file berada di luar root.");
  return candidate;
}

async function inspectCandidates(database) {
  const result = await database.query(candidateSql, [categories]);
  const summary = Object.fromEntries(
    categories.map((category) => [category, { metadata: 0, bytesOnDisk: 0 }]),
  );
  for (const file of result.rows) {
    summary[file.category].metadata += 1;
    try {
      await access(resolveSafePath(file.object_key));
      summary[file.category].bytesOnDisk += 1;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return { files: result.rows, summary };
}

async function quarantine(files) {
  await mkdir(trashRoot, { recursive: true });
  const entries = [];
  try {
    for (const file of files) {
      const originalPath = resolveSafePath(file.object_key);
      const quarantinePath = path.join(
        trashRoot,
        `${randomUUID()}${path.extname(originalPath).slice(0, 12)}`,
      );
      try {
        await rename(originalPath, quarantinePath);
        entries.push({ originalPath, quarantinePath });
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    return entries;
  } catch (error) {
    for (const entry of entries.reverse())
      await rename(entry.quarantinePath, entry.originalPath).catch(() => {});
    throw error;
  }
}

const client = await pool.connect();
let quarantined = [];
let committed = false;
try {
  const inspected = await inspectCandidates(client);
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...inspected.summary }, null, 2));
  if (!apply) process.exitCode = 0;
  else {
    await client.query("BEGIN");
    const locked = await client.query(`${candidateSql} FOR UPDATE OF file`, [categories]);
    quarantined = await quarantine(locked.rows);
    const ids = locked.rows.map((file) => file.id);
    if (ids.length) {
      await client.query(
        "UPDATE employees SET profile_photo_file_id=NULL WHERE profile_photo_file_id=ANY($1::bigint[])",
        [ids],
      );
      await client.query(
        "UPDATE employee_identifiers SET document_file_id=NULL WHERE document_file_id=ANY($1::bigint[])",
        [ids],
      );
      await client.query(
        "UPDATE employee_educations SET certificate_file_id=NULL WHERE certificate_file_id=ANY($1::bigint[])",
        [ids],
      );
      await client.query(
        "UPDATE employee_certifications SET certificate_file_id=NULL WHERE certificate_file_id=ANY($1::bigint[])",
        [ids],
      );
      await client.query("DELETE FROM employee_documents WHERE file_id=ANY($1::bigint[])", [ids]);
    }
    await client.query("COMMIT");
    committed = true;
    let purged = 0;
    for (const entry of quarantined) {
      await unlink(entry.quarantinePath);
      purged += 1;
    }
    console.log(JSON.stringify({ checkedMetadata: ids.length, purgedBytes: purged }, null, 2));
  }
} catch (error) {
  if (!committed) {
    await client.query("ROLLBACK").catch(() => {});
    for (const entry of quarantined.reverse()) {
      await mkdir(path.dirname(entry.originalPath), { recursive: true });
      await rename(entry.quarantinePath, entry.originalPath).catch(() => {});
    }
  }
  throw error;
} finally {
  client.release();
  await pool.end();
}
