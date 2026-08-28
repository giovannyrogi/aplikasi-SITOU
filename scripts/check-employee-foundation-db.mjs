import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: process.env.ENV_FILE || ".env.development", quiet: true });

const requiredEnvironment = ["PGUSER", "PGPASSWORD", "PGHOST", "PGDATABASE", "PGPORT"];
const missingEnvironment = requiredEnvironment.filter((key) => !process.env[key]);
if (missingEnvironment.length) {
  console.error("Environment database belum lengkap: " + missingEnvironment.join(", "));
  process.exit(1);
}

const requiredRelations = [
  "organization_subscriptions",
  "organization_unit_types",
  "employee_import_batches",
  "employee_import_rows",
  "employee_onboarding_drafts",
  "platform_user_profiles",
  "v_user_identity",
];

const requiredColumns = [
  ["locations", "operational_from"],
  ["locations", "operational_until"],
  ["organization_units", "unit_type_id"],
  ["employment_types", "created_at"],
  ["employment_types", "updated_at"],
  ["user_organization_roles", "location_scope_mode"],
  ["stored_files", "employee_id"],
  ["stored_files", "onboarding_draft_id"],
  ["employee_import_rows", "sheet_name"],
  ["employee_import_rows", "entity_type"],
  ["employee_import_rows", "entity_ref"],
  ["employee_import_rows", "employee_no"],
  ["employment_contracts", "updated_at"],
  ["employment_contracts", "cancelled_at"],
  ["employment_contracts", "cancellation_reason"],
  ["employment_contracts", "cancelled_by_user_id"],
  ["employee_identifiers", "identifier_label"],
  ["employee_identifiers", "document_file_id"],
  ["users", "credential_version"],
  ["disciplinary_actions", "revoked_at"],
  ["disciplinary_actions", "revoked_by_user_id"],
  ["disciplinary_actions", "revocation_reason"],
];

const forbiddenColumns = [
  ["organizations", "active_from"],
  ["organizations", "active_until"],
  ["locations", "active_from"],
  ["locations", "active_until"],
  ["organization_units", "unit_type"],
  ["employee_import_batches", "source_kind"],
  ["employee_import_batches", "total_documents"],
  ["users", "email"],
  ["users", "full_name"],
  ["users", "phone"],
  ["users", "email_verified_at"],
];

const requiredConstraints = [
  "ck_contract_cancellation",
  "uq_disciplinary_action_case",
  "ck_disciplinary_action_revocation",
];

const expectedRolePermissions = {
  superadmin: [
    "employees.read",
    "employees.read_sensitive",
    "employees.create",
    "employees.update",
    "employees.deactivate",
    "assignments.read",
    "assignments.manage",
    "contracts.read",
    "contracts.manage",
    "discipline.read",
    "discipline.manage",
    "accounts.read",
    "accounts.manage",
    "employee_import.read",
    "employee_import.manage",
    "private_files.read",
    "private_files.read_sensitive",
    "private_files.manage",
    "profile_self.read",
    "profile_self.update",
  ],
  hrd: [
    "employees.read",
    "employees.read_sensitive",
    "employees.create",
    "employees.update",
    "employees.deactivate",
    "assignments.read",
    "assignments.manage",
    "contracts.read",
    "contracts.manage",
    "discipline.read",
    "discipline.manage",
    "accounts.read",
    "accounts.manage",
    "employee_import.read",
    "employee_import.manage",
    "private_files.read",
    "private_files.read_sensitive",
    "private_files.manage",
    "profile_self.read",
    "profile_self.update",
  ],
  leader: [
    "employees.read",
    "employees.read_sensitive",
    "assignments.read",
    "contracts.read",
    "discipline.read",
    "private_files.read",
    "private_files.read_sensitive",
    "profile_self.read",
    "profile_self.update",
  ],
  employee: [
    "employees.read_self",
    "assignments.read_self",
    "contracts.read_self",
    "private_files.read_self",
    "profile_self.read",
    "profile_self.update",
  ],
};

const client = new pg.Client({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT),
});

try {
  await client.connect();
  const databaseResult = await client.query(
    "SELECT current_database() AS database_name, current_setting('server_version') AS server_version",
  );
  const relationResult = await client.query(
    "SELECT relation_name, to_regclass('public.' || relation_name)::text IS NOT NULL AS present " +
      "FROM unnest($1::text[]) AS relation_name",
    [requiredRelations],
  );
  const columnResult = await client.query(
    "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'",
  );
  const constraintResult = await client.query(
    "SELECT constraint_name FROM information_schema.table_constraints " +
      "WHERE constraint_schema='public' AND constraint_name=ANY($1::text[])",
    [requiredConstraints],
  );
  const permissionResult = await client.query(
    "SELECT role.code AS role_code,permission.code AS permission_code " +
      "FROM role_permissions mapping " +
      "JOIN roles role ON role.id=mapping.role_id " +
      "JOIN permissions permission ON permission.id=mapping.permission_id " +
      "WHERE role.code=ANY($1::text[])",
    [Object.keys(expectedRolePermissions)],
  );

  const existingColumns = new Set(
    columnResult.rows.map((row) => row.table_name + "." + row.column_name),
  );
  const existingConstraints = new Set(constraintResult.rows.map((row) => row.constraint_name));
  const actualPermissions = new Map(
    Object.keys(expectedRolePermissions).map((roleCode) => [roleCode, new Set()]),
  );
  for (const row of permissionResult.rows) {
    actualPermissions.get(row.role_code)?.add(row.permission_code);
  }

  const missingRelations = relationResult.rows
    .filter((row) => !row.present)
    .map((row) => row.relation_name);
  const missingColumns = requiredColumns
    .map(([tableName, columnName]) => tableName + "." + columnName)
    .filter((column) => !existingColumns.has(column));
  const remainingLegacyColumns = forbiddenColumns
    .map(([tableName, columnName]) => tableName + "." + columnName)
    .filter((column) => existingColumns.has(column));
  const missingConstraints = requiredConstraints.filter(
    (constraint) => !existingConstraints.has(constraint),
  );
  const missingPermissions = Object.entries(expectedRolePermissions).flatMap(
    ([roleCode, permissionCodes]) =>
      permissionCodes
        .filter((permissionCode) => !actualPermissions.get(roleCode)?.has(permissionCode))
        .map((permissionCode) => roleCode + ":" + permissionCode),
  );

  const report = {
    ...databaseResult.rows[0],
    ready:
      missingRelations.length === 0 &&
      missingColumns.length === 0 &&
      remainingLegacyColumns.length === 0 &&
      missingConstraints.length === 0 &&
      missingPermissions.length === 0,
    missing_relations: missingRelations,
    missing_columns: missingColumns,
    remaining_legacy_columns: remainingLegacyColumns,
    missing_constraints: missingConstraints,
    missing_role_permissions: missingPermissions,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ready) {
    throw new Error(
      "Database belum sesuai sitou_schema_v3.sql. Lengkapi schema atau migration yang dilaporkan sebelum menjalankan aplikasi.",
    );
  }
} finally {
  await client.end().catch(() => {});
}
