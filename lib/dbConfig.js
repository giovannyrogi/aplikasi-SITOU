import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

const isProd = process.env.NODE_ENV === "production";
const envFile = isProd ? ".env.production" : ".env.development";

dotenv.config({ path: path.resolve(process.cwd(), envFile) });

console.log(`[DB] Mode aktif: ${process.env.NODE_ENV}`);
console.log(`[DB] File env dibaca: ${envFile}`);

const pool = new Pool({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: process.env.PGPORT,
});

export default pool;
