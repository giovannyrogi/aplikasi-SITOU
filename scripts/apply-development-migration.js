const fs = require("node:fs/promises");
const path = require("node:path");
const dotenv = require("dotenv");
const { Pool } = require("pg");

dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

const migrationPath = process.argv[2];
if (!migrationPath) {
  throw new Error("Gunakan: node scripts/apply-development-migration.js <file-migration.sql>");
}

if (!/sitou/i.test(process.env.PGDATABASE || "")) {
  throw new Error("Migration dibatalkan: target bukan database development SITOU.");
}

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

async function run() {
  const sql = await fs.readFile(path.resolve(process.cwd(), migrationPath), "utf8");
  await pool.query(sql);
  console.log(`Migration diterapkan ke ${process.env.PGDATABASE}: ${migrationPath}`);
}

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
