// Parse structure in a bounded subprocess. Never execute actions or load PDF URLs.
import { readFile } from "node:fs/promises";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
try {
  const data = await readFile(process.argv[2]);
  const document = await PDFDocument.load(data, { ignoreEncryption: false, updateMetadata: false });
  if (document.isEncrypted) throw new Error("PDF_ENCRYPTED");
  if (document.getPageCount() > 20) throw new Error("PDF_PAGE_LIMIT");
  const forbidden = new Set([
    "JS",
    "JavaScript",
    "AA",
    "OpenAction",
    "EmbeddedFiles",
    "EF",
    "XFA",
    "RichMedia",
    "Launch",
  ]);
  for (const [, object] of document.context.enumerateIndirectObjects()) {
    const visit = (value, depth = 0) => {
      if (depth > 30) throw new Error("PDF_STRUCTURE_LIMIT");
      if (value instanceof PDFDict)
        for (const [key, child] of value.entries()) {
          if (forbidden.has(key.decodeText())) throw new Error("PDF_ACTIVE_CONTENT");
          if (
            child instanceof PDFName &&
            [
              "JavaScript",
              "Launch",
              "RichMedia",
              "FileAttachment",
              "Movie",
              "Sound",
              "Screen",
            ].includes(child.decodeText())
          )
            throw new Error("PDF_ACTIVE_CONTENT");
          visit(child, depth + 1);
        }
      else if (value?.asArray) for (const child of value.asArray()) visit(child, depth + 1);
    };
    visit(object);
  }
  const pages = document.getPages().map((page, i) => {
    const { width, height } = page.getSize();
    if (width < 100 || height < 100 || width * height > 2e6) throw new Error("PDF_PAGE_DIMENSIONS");
    return { page: i + 1, width, height, rotation: page.getRotation().angle, words: [] };
  });
  console.log(JSON.stringify({ pages }));
} catch (error) {
  const code = String(error.message || "").startsWith("PDF_") ? error.message : "PDF_INVALID";
  console.log(
    JSON.stringify({
      error: code,
      message: "PDF rusak, terkunci, terlalu besar, atau memuat konten yang tidak didukung.",
    }),
  );
}
