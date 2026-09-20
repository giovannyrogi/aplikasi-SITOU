import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.development" });
const pool = new pg.Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

const client = await pool.connect();
try {
  await client.query("BEGIN");
  const result = await client.query(
    `UPDATE disciplinary_actions action SET status='expired'
     FROM organizations organization
     WHERE organization.id=action.organization_id
       AND action.status='active' AND action.effective_until IS NOT NULL
       AND action.effective_until < (now() AT TIME ZONE organization.timezone)::date
     RETURNING action.id,action.organization_id`,
  );
  if (result.rowCount) {
    const values = [];
    const rows = result.rows
      .map((row, index) => {
        const offset = index * 2;
        values.push(row.organization_id, String(row.id));
        return `($${offset + 1},NULL,'disciplinary_action.expire','disciplinary_action',$${offset + 2},
          '{"status":"active"}'::jsonb,'{"status":"expired"}'::jsonb)`;
      })
      .join(",");
    await client.query(
      `INSERT INTO audit_logs
        (organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data)
       VALUES ${rows}`,
      values,
    );
  }
  await client.query("COMMIT");
  console.log(`${result.rowCount} tindakan disiplin ditandai berakhir.`);
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Pembaruan masa berlaku tindakan disiplin gagal:", error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
