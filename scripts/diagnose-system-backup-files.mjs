import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { opendir } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { backupPaths } from "../lib/system-backup/paths.mjs";
import { collectBackupMetadata, inspectBackupFiles } from "../lib/system-backup/file-issues.mjs";

dotenv.config({
  path: process.env.ENV_FILE || (process.env.NODE_ENV === "production" ? ".env.production" : ".env.development"),
  quiet: true,
});

async function listFiles(root, relative = "") {
  const files = [];
  for await (const entry of await opendir(path.join(root, relative))) {
    const item = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(root, item));
    else if (entry.isFile()) files.push({ path: item });
    else throw new Error("Ada objek yang tidak aman di folder upload.");
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
  return { size, sha256: hash.digest("hex") };
}

const client = new pg.Client();
try {
  await client.connect();
  const uploadRoot = backupPaths().uploadRoot;
  const [metadata, files] = await Promise.all([collectBackupMetadata(client), listFiles(uploadRoot)]);
  const issues = await inspectBackupFiles(metadata, uploadRoot, files, digestFile);
  const countBy = (field) => Object.fromEntries([...new Set(issues.map((issue) => issue[field]))]
    .map((value) => [value, issues.filter((issue) => issue[field] === value).length]));
  console.log(JSON.stringify({ fileDalamFolder: files.length, fileBermasalah: issues.length,
    masalah: countBy("issueType"), jenisFile: countBy("fileLabel"), prioritas: countBy("priority"),
    contoh: issues.slice(0, 10).map((issue) => ({ organisasiId: issue.organizationId,
      fileId: issue.storedFileId, jenisFile: issue.fileLabel, masalah: issue.issueType })),
    ...(process.argv.includes("--details") ? { rincian: issues } : {}) }, null, 2));
} finally {
  await client.end();
}
