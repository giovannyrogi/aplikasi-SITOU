import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { runStorageMaintenanceWorker } from "../lib/storage-maintenance/worker.mjs";

dotenv.config({
  path:
    process.env.ENV_FILE ||
    (process.env.NODE_ENV === "production" ? ".env.production" : ".env.development"),
  quiet: true,
});

const pool = new pg.Pool({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT || 5432),
  max: Number(process.env.FILE_CLEANUP_POOL_MAX || 2),
});
const controller = new AbortController();
for (const event of ["SIGINT", "SIGTERM"]) process.once(event, () => controller.abort());

try {
  await runStorageMaintenanceWorker(
    pool,
    path.resolve(process.env.UPLOAD_ROOT || path.join(process.cwd(), "uploads")),
    { once: process.argv.includes("--once"), signal: controller.signal },
  );
} finally {
  await pool.end();
}
