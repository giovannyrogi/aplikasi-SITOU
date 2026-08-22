import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import yauzl from "yauzl";
import { ServiceError } from "../api/routeHelpers.js";

export const MAX_XLSX_BYTES = 10 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 100 * 1024 * 1024;
const MAX_XLSX_ENTRIES = 5000;
const REQUIRED_ENTRIES = new Set(["[content_types].xml", "xl/workbook.xml"]);
const FORBIDDEN_PATHS = [
  "xl/vbaproject.bin",
  "xl/externallinks/",
  "xl/embeddings/",
  "xl/activex/",
  "customui/",
];

/** Membuka container OOXML secara lazy agar metadata keamanan diperiksa sebelum parsing Excel. */
function openWorkbookContainer(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, decodeStrings: true }, (error, zipFile) =>
      error ? reject(error) : resolve(zipFile),
    );
  });
}

/** Membaca XML relasi berukuran kecil tanpa mengekstrak seluruh workbook ke filesystem. */
function readEntry(zipFile, entry, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error) return reject(error);
      const chunks = [];
      let total = 0;
      stream.on("data", (chunk) => {
        total += chunk.length;
        if (total > maxBytes) stream.destroy(new Error("RELATIONSHIP_TOO_LARGE"));
        else chunks.push(chunk);
      });
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
  });
}

/** Menolak path container yang dapat menyamarkan entry atau keluar dari root workbook. */
function normalizeEntryName(fileName) {
  const normalized = path.posix.normalize(String(fileName || "").replaceAll("\\", "/"));
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    /^[A-Za-z]:/.test(normalized)
  )
    throw new ServiceError(
      "IMPORT_WORKBOOK_PATH_INVALID",
      "Workbook memiliki struktur file yang tidak aman.",
      400,
    );
  return normalized.toLowerCase();
}

/** Memastikan byte adalah XLSX aman tanpa macro, objek tertanam, atau relasi eksternal. */
export async function inspectEmployeeWorkbook(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length <= 0 || buffer.length > MAX_XLSX_BYTES)
    throw new ServiceError("FILE_SIZE_INVALID", "File Excel maksimal 10 MB.", 413);
  const detected = await fileTypeFromBuffer(buffer);
  if (detected?.mime !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    throw new ServiceError("IMPORT_FILE_INVALID", "File harus berupa workbook Excel .xlsx.", 415);

  let zipFile;
  try {
    zipFile = await openWorkbookContainer(buffer);
  } catch {
    throw new ServiceError("IMPORT_WORKBOOK_INVALID", "Workbook Excel tidak dapat dibaca.", 415);
  }

  return new Promise((resolve, reject) => {
    const names = new Set();
    let entryCount = 0;
    let expandedBytes = 0;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      zipFile.close();
      reject(
        error instanceof ServiceError
          ? error
          : new ServiceError("IMPORT_WORKBOOK_INVALID", "Workbook Excel tidak aman.", 400),
      );
    };
    zipFile.on("error", fail);
    zipFile.on("entry", async (entry) => {
      try {
        entryCount += 1;
        if (entryCount > MAX_XLSX_ENTRIES)
          throw new ServiceError(
            "IMPORT_WORKBOOK_TOO_COMPLEX",
            "Workbook memiliki terlalu banyak bagian internal.",
            413,
          );
        if (entry.generalPurposeBitFlag & 0x1)
          throw new ServiceError(
            "IMPORT_WORKBOOK_ENCRYPTED",
            "Workbook terenkripsi tidak dapat diimpor.",
            400,
          );
        const name = normalizeEntryName(entry.fileName);
        if (names.has(name))
          throw new ServiceError(
            "IMPORT_WORKBOOK_DUPLICATE_ENTRY",
            "Workbook memiliki bagian internal duplikat.",
            400,
          );
        names.add(name);
        expandedBytes += entry.uncompressedSize;
        if (expandedBytes > MAX_EXPANDED_BYTES)
          throw new ServiceError(
            "IMPORT_WORKBOOK_EXPANDED_TOO_LARGE",
            "Isi workbook terlalu besar untuk diproses dengan aman.",
            413,
          );
        if (FORBIDDEN_PATHS.some((forbidden) => name === forbidden || name.startsWith(forbidden)))
          throw new ServiceError(
            "IMPORT_WORKBOOK_UNSAFE_CONTENT",
            "Workbook tidak boleh memuat macro, tautan eksternal, atau objek tertanam.",
            400,
          );
        if (name.endsWith(".rels") || name === "[content_types].xml") {
          const xml = await readEntry(zipFile, entry);
          if (/TargetMode\s*=\s*["']External["']/i.test(xml))
            throw new ServiceError(
              "IMPORT_WORKBOOK_EXTERNAL_LINK",
              "Workbook tidak boleh memuat tautan eksternal.",
              400,
            );
          if (/vbaProject|oleObject|activeX/i.test(xml))
            throw new ServiceError(
              "IMPORT_WORKBOOK_UNSAFE_CONTENT",
              "Workbook tidak boleh memuat macro atau objek aktif.",
              400,
            );
        }
        zipFile.readEntry();
      } catch (error) {
        fail(error);
      }
    });
    zipFile.on("end", () => {
      if (settled) return;
      if ([...REQUIRED_ENTRIES].some((required) => !names.has(required)))
        return fail(
          new ServiceError(
            "IMPORT_WORKBOOK_STRUCTURE_INVALID",
            "Struktur workbook Excel tidak lengkap.",
            400,
          ),
        );
      settled = true;
      resolve({ entryCount, expandedBytes });
    });
    zipFile.readEntry();
  });
}
