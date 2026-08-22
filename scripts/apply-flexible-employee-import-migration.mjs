import { readFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.development", quiet: true });

if (!process.env.PGDATABASE || /prod/i.test(process.env.PGDATABASE))
  throw new Error(
    "Migration hanya boleh dijalankan pada database development yang terkonfigurasi.",
  );

const client = new pg.Client({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT || 5432),
});

try {
  await client.connect();
  const sql = await readFile(
    path.join(process.cwd(), "database", "migrations", "20260822_007_flexible_employee_import.sql"),
    "utf8",
  );
  await client.query(sql);
  console.log(`Migration import pegawai fleksibel diterapkan pada ${process.env.PGDATABASE}.`);
} finally {
  await client.end().catch(() => {});
}
