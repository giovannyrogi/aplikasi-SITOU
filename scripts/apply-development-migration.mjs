import { readFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.development", quiet: true });

const requestedPath = process.argv[2];
if (!requestedPath) throw new Error("Berikan path migration yang akan dijalankan.");
if (!process.env.PGDATABASE || /prod/i.test(process.env.PGDATABASE))
  throw new Error("Migration hanya boleh dijalankan pada database development.");

const migrationRoot = path.resolve(process.cwd(), "database", "migrations");
const migrationPath = path.resolve(process.cwd(), requestedPath);
if (!migrationPath.startsWith(`${migrationRoot}${path.sep}`) || !/^\d+_[a-z0-9_]+\.sql$/i.test(path.basename(migrationPath)))
  throw new Error("Path harus menunjuk satu file SQL di database/migrations.");

const client = new pg.Client({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT || 5432),
});

try {
  await client.connect();
  const sql = await readFile(migrationPath, "utf8");
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log(`Migration ${path.basename(migrationPath)} diterapkan pada ${process.env.PGDATABASE}.`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end().catch(() => {});
}