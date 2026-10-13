import test from "node:test";
import assert from "node:assert/strict";
import { readUploadMetadata } from "../lib/ui/uploadMetadata.mjs";

test("metadata gambar konsisten untuk pilihan lokal, Kepegawaian, dan draft Inventaris", () => {
  const expected = { name: "bukti.png", size: 1024, mimeType: "image/png" };
  for (const value of [
    { name: "bukti.png", size: 1024, type: "image/png" },
    { original_name: "bukti.png", size_bytes: 1024, mime_type: "image/png" },
    { name: "bukti.png", sizeBytes: 1024, mimeType: "image/png" },
  ]) assert.deepEqual(readUploadMetadata(value), expected);
});

test("PDF tetap dokumen dan nama gambar tidak dianggap sebagai MIME", () => {
  assert.equal(readUploadMetadata({ name: "gambar.png" }).mimeType, "");
  assert.equal(readUploadMetadata({ mimeType: "application/pdf" }).mimeType, "application/pdf");
  assert.deepEqual(readUploadMetadata(null), { name: "", size: undefined, mimeType: "" });
});
