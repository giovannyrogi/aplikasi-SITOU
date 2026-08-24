import dotenv from "dotenv";
import pg from "pg";
dotenv.config({ path: ".env.development", quiet: true });
if (!process.env.PGDATABASE || /prod/i.test(process.env.PGDATABASE))
  throw new Error("Uji integrasi hanya boleh memakai database development.");
const client = new pg.Client({
  user: process.env.PGUSER,password: process.env.PGPASSWORD,host: process.env.PGHOST,
  database: process.env.PGDATABASE,port: Number(process.env.PGPORT || 5432),
});
try {
  await client.connect();
  await client.query("BEGIN");
  const selfProfileProjection = await client.query(`SELECT user_account.id,
    employee_organization.name AS employee_organization_name,
    active_assignment.location_name,active_assignment.organization_unit_name,active_assignment.position_name
    FROM users user_account
    JOIN v_user_identity identity ON identity.user_id=user_account.id
    LEFT JOIN employees employee ON employee.id=identity.employee_id
    LEFT JOIN organizations employee_organization ON employee_organization.id=employee.organization_id
    LEFT JOIN LATERAL (
      SELECT location.name AS location_name,organization_unit.name AS organization_unit_name,
        position.name AS position_name
      FROM employee_assignments assignment
      JOIN locations location ON location.organization_id=assignment.organization_id AND location.id=assignment.location_id
      JOIN organization_units organization_unit ON organization_unit.organization_id=assignment.organization_id
        AND organization_unit.id=assignment.organization_unit_id
      JOIN positions position ON position.organization_id=assignment.organization_id AND position.id=assignment.position_id
      WHERE assignment.organization_id=employee.organization_id AND assignment.employee_id=employee.id
        AND assignment.assignment_type='primary' AND assignment.effective_from<=current_date
        AND (assignment.effective_until IS NULL OR assignment.effective_until>=current_date)
      ORDER BY assignment.effective_from DESC,assignment.id DESC LIMIT 1
    ) active_assignment ON true LIMIT 1`);
  if (!selfProfileProjection.rows[0]) throw new Error("Proyeksi profil mandiri tidak menghasilkan data.");
  const platform = await client.query(`SELECT user_account.id,user_account.credential_version,
    identity.display_name,identity.identity_source
    FROM users user_account JOIN v_user_identity identity ON identity.user_id=user_account.id
    JOIN user_organization_roles membership ON membership.user_id=user_account.id
    JOIN roles role ON role.id=membership.role_id
    WHERE role.code='superadmin' LIMIT 1`);
  if (!platform.rows[0] || platform.rows[0].identity_source !== "platform")
    throw new Error("Identitas platform Superadmin tidak tersedia.");
  const before = platform.rows[0].credential_version;
  const updated = await client.query(
    "UPDATE users SET credential_version=credential_version+1 WHERE id=$1 RETURNING credential_version",
    [platform.rows[0].id],
  );
  if (updated.rows[0].credential_version !== before + 1)
    throw new Error("Versi kredensial tidak meningkat.");
  const staleSession = await client.query(
    "SELECT EXISTS(SELECT 1 FROM users WHERE id=$1 AND credential_version=$2) AS valid",
    [platform.rows[0].id, before],
  );
  if (staleSession.rows[0].valid)
    throw new Error("Versi session lama masih dianggap valid.");
  const legacyColumns = await client.query(`SELECT count(*)::int AS total FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users'
      AND column_name=ANY(ARRAY['full_name','email','phone','email_verified_at'])`);
  if (legacyColumns.rows[0].total !== 0)
    throw new Error("Kolom identitas legacy masih terdapat pada users.");
  const backup = await client.query("SELECT count(*)::int AS total FROM user_identity_legacy_backups");
  if (backup.rows[0].total < 1)
    throw new Error("Backup identitas legacy tidak tersedia.");
  const fallback = await client.query(`SELECT count(*)::int AS total FROM v_user_identity
    WHERE identity_source='username' AND display_name='@' || username`);
  console.log(`Uji identitas terpusat lulus; ${fallback.rows[0].total} akun memakai fallback username.`);
} finally {
  await client.query("ROLLBACK").catch(() => {});
  await client.end().catch(() => {});
}
