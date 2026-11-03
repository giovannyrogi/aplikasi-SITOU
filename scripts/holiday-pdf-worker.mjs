import dotenv from "dotenv";
import pg from "pg";
import path from "node:path";
import { runHolidayPdfWorker } from "../lib/holiday-catalogs/pdf-worker.mjs";
dotenv.config({
  path:
    process.env.ENV_FILE ||
    (process.env.NODE_ENV === "production" ? ".env.production" : ".env.development"),
  quiet: true,
});
const pool = new pg.Pool({ max: 3 });
const controller = new AbortController();
for (const event of ["SIGINT", "SIGTERM"]) process.once(event, () => controller.abort());
try {
  await runHolidayPdfWorker(pool, path.resolve(process.env.UPLOAD_ROOT || "uploads"), {
    once: process.argv.includes("--once"),
    signal: controller.signal,
  });
} finally {
  await pool.end();
}
