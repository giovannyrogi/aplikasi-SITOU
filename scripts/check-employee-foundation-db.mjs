import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: process.env.ENV_FILE || ".env.development", quiet: true });

const required = ["PGUSER", "PGPASSWORD", "PGHOST", "PGDATABASE", "PGPORT"];
const missing = required.filter((key) => typeof process.env[key] !== "string" || !process.env[key]);
if (missing.length) {
  console.error(`Environment database belum lengkap: ${missing.join(", ")}`);
  process.exit(1);
}

const client = new pg.Client({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT),
});

try {
  await client.connect();
  const result = await client.query(`SELECT current_database() AS database_name,
    current_setting('server_version') AS server_version,
    to_regclass('public.employee_import_batches')::text AS import_table,
    EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='user_organization_roles'
        AND column_name='location_scope_mode') AS scope_column,
    EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='stored_files'
        AND column_name='employee_id') AS stored_file_employee_column,
    EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='employee_import_batches'
        AND column_name='source_kind') AS legacy_import_source_column,
    EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='employee_import_rows'
        AND column_name='sheet_name') AS flexible_import_sheet_column,
    to_regclass('public.uq_employees_org_number_normalized')::text AS employee_number_unique_index,
    to_regclass('public.uq_employees_org_nik')::text AS employee_nik_unique_index,
    NOT EXISTS(
      SELECT 1 FROM role_permissions mapping
      JOIN roles role ON role.id=mapping.role_id
      JOIN permissions permission ON permission.id=mapping.permission_id
      WHERE role.code='employee'
        AND permission.code IN ('employees.read','assignments.read','contracts.read','private_files.read')
    ) AS employee_generic_permissions_revoked,
    (
      SELECT count(*)::int FROM role_permissions mapping
      JOIN roles role ON role.id=mapping.role_id
      JOIN permissions permission ON permission.id=mapping.permission_id
      WHERE role.code='employee' AND permission.code LIKE '%\\_self' ESCAPE '\\'
    ) AS employee_self_permission_count`);
  console.log(JSON.stringify(result.rows[0], null, 2));
} finally {
  await client.end().catch(() => {});
}
