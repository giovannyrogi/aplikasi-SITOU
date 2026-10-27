import dotenv from "dotenv";
import pg from "pg";
dotenv.config({ path: process.env.ENV_FILE || ".env.development", quiet: true });
const client = new pg.Client({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT || 5432),
});
try {
  await client.connect();
  const result = await client.query(
    `DELETE FROM mobile_auth_sessions WHERE expires_at<now() OR revoked_at<now()-interval '1 day'`,
  );
  console.log(`Sesi mobile dibersihkan: ${result.rowCount}.`);
} finally {
  await client.end();
}
