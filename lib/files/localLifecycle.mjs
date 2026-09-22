import { randomUUID } from "node:crypto";
import { mkdir, rename, unlink } from "node:fs/promises";
import path from "node:path";

export function getPrivateUploadRoot() {
  return path.resolve(
    /* turbopackIgnore: true */ process.env.UPLOAD_ROOT || path.join(process.cwd(), "uploads"),
  );
}

export function resolvePrivateObjectPath(objectKey) {
  const root = getPrivateUploadRoot();
  const absolutePath = path.resolve(root, ...String(objectKey || "").split("/"));
  if (!absolutePath.startsWith(`${root}${path.sep}`)) {
    const error = new Error("Object key keluar dari root upload.");
    error.code = "FILE_PATH_INVALID";
    throw error;
  }
  return absolutePath;
}

export async function quarantineLocalObjects(storedFiles, namespace = "lifecycle") {
  const quarantineRoot = path.join(getPrivateUploadRoot(), ".trash", namespace);
  const entries = [];
  try {
    await mkdir(quarantineRoot, { recursive: true });
    for (const storedFile of storedFiles || []) {
      const originalPath = resolvePrivateObjectPath(storedFile.object_key);
      const extension = path.extname(originalPath).slice(0, 12);
      const organizationSegment = String(storedFile.object_key || "").split("/")[0];
      const scopedRoot = /^org_\d+$/.test(organizationSegment)
        ? path.join(quarantineRoot, organizationSegment)
        : quarantineRoot;
      await mkdir(scopedRoot, { recursive: true });
      const quarantinePath = path.join(scopedRoot, `${randomUUID()}${extension}`);
      try {
        await rename(originalPath, quarantinePath);
        entries.push({ originalPath, quarantinePath, missing: false });
      } catch (error) {
        if (error?.code === "ENOENT") {
          entries.push({ originalPath, quarantinePath: null, missing: true });
          continue;
        }
        throw error;
      }
    }
    return entries;
  } catch (error) {
    await restoreLocalObjects(entries);
    throw error;
  }
}

export async function restoreLocalObjects(entries) {
  for (const entry of [...(entries || [])].reverse()) {
    if (entry.missing || !entry.quarantinePath) continue;
    await mkdir(path.dirname(entry.originalPath), { recursive: true });
    await rename(entry.quarantinePath, entry.originalPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
}

export async function purgeLocalObjects(entries) {
  for (const entry of entries || []) {
    if (entry.missing || !entry.quarantinePath) continue;
    await unlink(entry.quarantinePath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
}

