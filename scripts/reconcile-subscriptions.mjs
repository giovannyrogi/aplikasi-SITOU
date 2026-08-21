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
try {
  const result = await pool.query(`UPDATE organization_subscriptions os SET status=CASE
    WHEN (now() AT TIME ZONE o.timezone)::date<os.starts_on THEN 'scheduled'
    WHEN (now() AT TIME ZONE o.timezone)::date<=os.ends_on THEN 'active'
    WHEN os.grace_ends_on IS NOT NULL AND (now() AT TIME ZONE o.timezone)::date<=os.grace_ends_on THEN 'grace'
    ELSE 'expired' END FROM organizations o WHERE o.id=os.organization_id
    AND os.status NOT IN ('suspended','cancelled') AND os.status IS DISTINCT FROM CASE
      WHEN (now() AT TIME ZONE o.timezone)::date<os.starts_on THEN 'scheduled'
      WHEN (now() AT TIME ZONE o.timezone)::date<=os.ends_on THEN 'active'
      WHEN os.grace_ends_on IS NOT NULL AND (now() AT TIME ZONE o.timezone)::date<=os.grace_ends_on THEN 'grace'
      ELSE 'expired' END RETURNING os.id`);
  console.log(`${result.rowCount} status langganan diselaraskan.`);
} catch (error) {
  console.error("Rekonsiliasi status langganan gagal:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
