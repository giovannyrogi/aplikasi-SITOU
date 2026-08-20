import { Pool } from "pg";

const globalForDatabase = globalThis;

const pool =
  globalForDatabase.sitouDatabasePool ||
  new Pool({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    port: Number(process.env.PGPORT || 5432),
    max: Number(process.env.PGPOOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.sitouDatabasePool = pool;
}

export default pool;
