import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import formidable from "formidable";

const MAX_JSON_BYTES = 256 * 1024;
const multipartError = (code, message, status) =>
  Object.assign(new Error(message), { code, status });

function limitsFor(request) {
  const pathname = new URL(request.url).pathname;
  if (pathname.endsWith("/profile"))
    return { maxFiles: 100, maxTotalFileSize: 110 * 1024 * 1024 };
  if (pathname === "/api/leave-requests")
    return { maxFiles: 5, maxTotalFileSize: 51 * 1024 * 1024 };
  if (pathname.startsWith("/api/employees/") && pathname.split("/").length === 4)
    return { maxFiles: 2, maxTotalFileSize: 11 * 1024 * 1024 };
  return { maxFiles: 1, maxTotalFileSize: 11 * 1024 * 1024 };
}

export async function parseMultipartToPrivateTemp(request) {
  const contentType = String(request.headers.get("content-type") || "");
  if (!contentType.toLowerCase().startsWith("multipart/form-data;"))
    throw multipartError("MULTIPART_REQUIRED", "Formulir harus menggunakan multipart.", 415);
  if (!request.body)
    throw multipartError("INVALID_MULTIPART_PAYLOAD", "Formulir multipart kosong.", 400);

  const uploadDir = path.resolve(
    process.env.UPLOAD_ROOT || path.join(process.cwd(), "uploads"),
    ".tmp",
    "multipart",
  );
  await mkdir(uploadDir, { recursive: true });
  const limits = limitsFor(request);
  const parser = formidable({
    uploadDir,
    maxFiles: limits.maxFiles,
    maxFileSize: 10 * 1024 * 1024,
    maxTotalFileSize: limits.maxTotalFileSize,
    maxFields: 110,
    maxFieldsSize: MAX_JSON_BYTES,
    allowEmptyFiles: false,
    minFileSize: 1,
    keepExtensions: false,
    filename: () => randomUUID(),
  });
  const temporaryPaths = new Set();
  const cleanupTimers = new Map();
  const removeTemporaryPath = async (filePath) => {
    const timer = cleanupTimers.get(filePath);
    if (timer) clearTimeout(timer);
    cleanupTimers.delete(filePath);
    temporaryPaths.delete(filePath);
    await unlink(filePath).catch(() => {});
  };
  const cleanup = async () => {
    await Promise.all([...temporaryPaths].map(removeTemporaryPath));
  };

  parser.on("fileBegin", (_name, file) => {
    if (file.filepath) temporaryPaths.add(file.filepath);
  });
  parser.on("file", (_name, file) => temporaryPaths.add(file.filepath));
  const nodeRequest = Readable.fromWeb(request.body);
  nodeRequest.headers = Object.fromEntries(request.headers.entries());
  if (!nodeRequest.headers["content-length"] && !nodeRequest.headers["transfer-encoding"])
    nodeRequest.headers["transfer-encoding"] = "chunked";
  nodeRequest.method = request.method;
  nodeRequest.url = request.url;
  let fields;
  let files;
  try {
    [fields, files] = await parser.parse(nodeRequest);
  } catch (error) {
    await cleanup();
    const tooLarge = error?.httpCode === 413;
    throw multipartError(
      tooLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_MULTIPART_PAYLOAD",
      tooLarge ? "Ukuran atau jumlah file melebihi batas." : "Formulir multipart tidak valid.",
      tooLarge ? 413 : 400,
    );
  }
  const values = new Map();
  const add = (key, value) => values.set(key, [...(values.get(key) || []), value]);
  for (const [key, entries] of Object.entries(fields))
    for (const value of Array.isArray(entries) ? entries : [entries]) add(key, value);

  for (const [key, entries] of Object.entries(files))
    for (const entry of Array.isArray(entries) ? entries : [entries]) {
      let cached = null;
      const timer = setTimeout(() => removeTemporaryPath(entry.filepath), 10 * 60 * 1000);
      timer.unref?.();
      cleanupTimers.set(entry.filepath, timer);
      add(key, {
        name: String(entry.originalFilename || "file").slice(0, 255),
        type: entry.mimetype || "application/octet-stream",
        size: Number(entry.size || 0),
        async arrayBuffer() {
          if (!cached) {
            cached = await readFile(entry.filepath);
            await removeTemporaryPath(entry.filepath);
          }
          return cached.buffer.slice(cached.byteOffset, cached.byteOffset + cached.byteLength);
        },
      });
    }

  return {
    get: (key) => values.get(key)?.[0] ?? null,
    getAll: (key) => values.get(key) || [],
    keys: () => values.keys(),
    cleanup,
  };
}
