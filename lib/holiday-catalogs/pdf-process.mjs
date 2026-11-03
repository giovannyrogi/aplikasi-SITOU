import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const PDF_PARSER_VERSION = "skb-table-1";
export const PDF_MAX_BYTES = 10 * 1024 * 1024;
export function pdfError(code, message, status = 422) {
  return Object.assign(new Error(message), { code, status });
}
export function executable(name) {
  const names = {
    tesseract: "TESSERACT_PATH",
    pdfinfo: "PDFINFO_PATH",
    pdftotext: "PDFTOTEXT_PATH",
    pdftoppm: "PDFTOPPM_PATH",
  };
  return process.env[names[name]] || name;
}
/** Never run a shell or interpolate uploaded text into executable names. */
export function runProgram(
  command,
  args,
  { signal, timeout = 60000, maxBytes = 8 * 1024 * 1024 } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      signal,
      env: { ...process.env, OMP_THREAD_LIMIT: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let size = 0,
      output = [],
      errorOutput = [],
      failure;
    const fail = (error) => {
      failure ||= error;
      child.kill("SIGKILL");
    };
    const timer = setTimeout(
      () => fail(pdfError("PDF_PROCESS_TIMEOUT", "Pembacaan dokumen melewati batas waktu.", 503)),
      timeout,
    );
    for (const [stream, target] of [
      [child.stdout, output],
      [child.stderr, errorOutput],
    ])
      stream.on("data", (chunk) => {
        size += chunk.length;
        if (size > maxBytes)
          fail(pdfError("PDF_OUTPUT_LIMIT", "Isi dokumen melebihi batas pembacaan."));
        else target.push(chunk);
      });
    child.once("error", (error) => {
      failure ||= pdfError(
        error.code === "ENOENT" ? "OCR_NOT_AVAILABLE" : "PDF_PROCESS_FAILED",
        "Layanan pembacaan PDF belum tersedia atau terhenti.",
        503,
      );
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (failure) return reject(failure);
      if (code !== 0)
        return reject(
          pdfError(
            "PDF_PROCESS_FAILED",
            "Dokumen tidak dapat dibaca dengan aman. Periksa PDF atau konfigurasi layanan.",
          ),
        );
      resolve({
        stdout: Buffer.concat(output).toString("utf8"),
        stderr: Buffer.concat(errorOutput).toString("utf8"),
      });
    });
  });
}
export async function inspectPdf(file, signal) {
  const script = fileURLToPath(new URL("./pdf-reader.mjs", import.meta.url));
  const result = await runProgram(process.execPath, ["--max-old-space-size=256", script, file], {
    signal,
    maxBytes: 4 * 1024 * 1024,
  });
  try {
    const parsed = JSON.parse(result.stdout);
    if (parsed.error) throw pdfError(parsed.error, parsed.message);
    return parsed;
  } catch (e) {
    if (e.status) throw e;
    throw pdfError("PDF_INVALID", "Struktur PDF tidak dapat dibaca.");
  }
}
