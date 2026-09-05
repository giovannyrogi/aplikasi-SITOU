import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: process.env.ENV_FILE || ".env.development", quiet: true });

const databaseName = `sitou_bootstrap_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
if (!/^sitou_bootstrap_[a-f0-9]{16}$/.test(databaseName))
  throw new Error("Nama database sementara tidak aman.");

const connection = {
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
};
const admin = new pg.Client({
  ...connection,
  database: process.env.PGADMIN_DATABASE || "postgres",
});
let bootstrap;
let adminConnected = false;

try {
  await admin.connect();
  adminConnected = true;
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  bootstrap = new pg.Client({ ...connection, database: databaseName });
  await bootstrap.connect();
  await bootstrap.query(await readFile(new URL("../sitou_schema_v3.sql", import.meta.url), "utf8"));
  const result = await bootstrap.query(
    `SELECT
      to_regclass('public.file_cleanup_runs') IS NOT NULL AS has_runs,
      to_regclass('public.file_cleanup_items') IS NOT NULL AS has_items,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='stored_files'
          AND column_name='content_purged_at'
      ) AS has_purged_at,
      EXISTS (
        SELECT 1 FROM permissions permission
        JOIN role_permissions mapping ON mapping.permission_id=permission.id
        JOIN roles role ON role.id=mapping.role_id
        WHERE permission.code='storage_maintenance.manage' AND role.code='superadmin'
      ) AS has_permission`,
  );
  const checks = result.rows[0];
  if (Object.values(checks).some((value) => value !== true))
    throw new Error(`Bootstrap tidak lengkap: ${JSON.stringify(checks)}`);
  console.log(JSON.stringify({ ready: true, checks }, null, 2));
} finally {
  await bootstrap?.end().catch(() => {});
  if (adminConnected) {
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
      [databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await admin.end();
  }
}
