import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getIconData } from "@iconify/utils";

const require = createRequire(import.meta.url);
const collections = {
  solar: require("@iconify-json/solar/icons.json"),
  "line-md": require("@iconify-json/line-md/icons.json"),
  "svg-spinners": require("@iconify-json/svg-spinners/icons.json"),
};
export const ICON_SOURCE_PATH = fileURLToPath(new URL("../app/components/icons/navigationIconSources.mjs", import.meta.url));
export const ICON_OUTPUT_PATH = fileURLToPath(new URL("../app/components/icons/localIconData.mjs", import.meta.url));
let importVersion = 0;

async function readCurrent(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

export async function generateLocalIcons({ sourcePath = ICON_SOURCE_PATH, outputPath = ICON_OUTPUT_PATH, check = false } = {}) {
  // Query unik memastikan perubahan file terbaca tanpa restart proses development.
  const sourceUrl = pathToFileURL(sourcePath);
  sourceUrl.searchParams.set("version", String(++importVersion));
  const { NAVIGATION_ICON_SOURCES: sources } = await import(sourceUrl.href);
  if (!sources || typeof sources !== "object") throw new Error("Katalog sumber ikon tidak valid.");

  const selectedIcons = {};
  for (const [semanticName, sourceName] of Object.entries(sources)) {
    if (typeof sourceName !== "string" || !sourceName.includes(":"))
      throw new Error(`Nama ikon tidak valid untuk ${semanticName}: ${String(sourceName)}`);
    const [collectionName, iconName] = sourceName.split(":");
    const collection = collections[collectionName];
    if (!collection)
      throw new Error(`Koleksi ikon ${collectionName} belum tersedia untuk ${semanticName}. Pilih Solar atau pasang paket koleksinya lebih dulu.`);
    const icon = getIconData(collection, iconName);
    if (!icon) throw new Error(`Ikon Iconify tidak ditemukan: ${sourceName} (${semanticName}). Periksa nama yang disalin dari Iconify.`);
    selectedIcons[semanticName] = icon;
  }

  const output = `// Dihasilkan otomatis dari navigationIconSources.mjs. Jangan edit manual.\nexport const LOCAL_ICON_DATA = ${JSON.stringify(selectedIcons, null, 2)};\n`;
  // Checkout Windows dapat memakai CRLF; perbedaan akhir baris bukan perubahan data SVG.
  const current = (await readCurrent(outputPath)).replaceAll("\r\n", "\n");
  if (check) {
    if (current !== output) throw new Error("Data ikon lokal belum sesuai. Jalankan npm run icons:generate.");
    return { count: Object.keys(selectedIcons).length, changed: false };
  }
  if (current === output) return { count: Object.keys(selectedIcons).length, changed: false };

  // File lama tetap utuh bila nama ikon salah atau penulisan file baru gagal.
  const temporaryPath = `${outputPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, output, "utf8");
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
  return { count: Object.keys(selectedIcons).length, changed: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await generateLocalIcons({ check: process.argv.includes("--check") });
    console.log(`Data ${result.count} ikon lokal ${result.changed ? "dibuat" : "sesuai"}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
