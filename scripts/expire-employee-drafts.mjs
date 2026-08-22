import dotenv from "dotenv";
import pg from "pg";

dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env.production" : ".env.development",
  quiet: true,
});

const client = new pg.Client({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT || 5432),
});

try {
  await client.connect();
  await client.query("BEGIN");
  const expired = await client.query(
    `UPDATE employee_onboarding_drafts SET status='expired',version=version+1
     WHERE status='active' AND expires_at<=now() RETURNING id`,
  );
  if (expired.rowCount)
    await client.query(
      `UPDATE stored_files SET deleted_at=now()
       WHERE onboarding_draft_id=ANY($1::bigint[]) AND deleted_at IS NULL`,
      [expired.rows.map((row) => row.id)],
    );
  await client.query("COMMIT");
  console.log(`${expired.rowCount} draft pegawai kedaluwarsa diproses.`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end().catch(() => {});
}
