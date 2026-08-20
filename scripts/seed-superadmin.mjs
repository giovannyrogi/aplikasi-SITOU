import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.development", quiet: true });

const DATABASE_NAME = "sitou_db";
const USERNAME = "superadmin";
const EMAIL = "superadmin@sitou.local";
const FULL_NAME = "Super Administrator";
const BCRYPT_COST = 12;

if (process.env.PGDATABASE !== DATABASE_NAME) {
  throw new Error(`Seed dibatalkan: PGDATABASE harus ${DATABASE_NAME}.`);
}

const pool = new pg.Pool({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT || 5432),
});

const password = `St!${randomBytes(18).toString("base64url")}9a`;
const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
const seedQuery = await readFile(
  new URL("../database/seeds/create-superadmin.sql", import.meta.url),
  "utf8",
);
const client = await pool.connect();

try {
  const databaseResult = await client.query("SELECT current_database() AS name");
  if (databaseResult.rows[0]?.name !== DATABASE_NAME) {
    throw new Error(`Seed dibatalkan: koneksi aktif bukan database ${DATABASE_NAME}.`);
  }

  const existingUser = await client.query(
    "SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1",
    [USERNAME, EMAIL],
  );
  if (existingUser.rowCount > 0) {
    throw new Error("Seed dibatalkan: username atau email Superadmin sudah digunakan.");
  }

  await client.query("BEGIN");
  const result = await client.query(seedQuery, [EMAIL, USERNAME, passwordHash, FULL_NAME]);
  if (result.rowCount !== 1) {
    throw new Error("Role platform superadmin tidak ditemukan atau insert gagal.");
  }
  await client.query("COMMIT");

  console.log(
    JSON.stringify(
      {
        success: true,
        database: DATABASE_NAME,
        username: USERNAME,
        password,
        message: "Simpan password ini sekarang; password tidak ditulis ke file.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}
