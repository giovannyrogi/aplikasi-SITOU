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
  "leave_types",
  "leave_requests",
  "leave_entitlements",
  "leave_balance_transactions",
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
  ["employee_assignments", "updated_at"],
  ["employee_identifiers", "identifier_label"],
  ["employee_identifiers", "document_file_id"],
  ["users", "credential_version"],
  ["disciplinary_actions", "revoked_at"],
  ["disciplinary_actions", "revoked_by_user_id"],
  ["disciplinary_actions", "revocation_reason"],
  ["leave_types", "updated_at"],
  ["leave_requests", "cancelled_at"],
  ["leave_requests", "cancelled_by_user_id"],
  ["leave_requests", "cancellation_reason"],
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
  "ck_employees_national_id",
  "ck_employees_marital_status",
  "ck_employee_onboarding_draft_current_step",
  "ex_unit_locations_period",
  "ck_employees_employment_status",
  "ck_stored_files_category",
  "ck_leave_requests_cancellation",
  "ck_leave_decisions_role",
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
    "leave_types.read",
    "leave_types.manage",
    "leave_requests.read",
    "leave_requests.manage",
    "leave_balances.manage",
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
    "leave_types.read",
    "leave_types.manage",
    "leave_requests.read",
    "leave_requests.manage",
    "leave_balances.manage",
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
    "leave_types.read",
    "leave_requests.read",
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
    "SELECT table_name,column_name,column_default,data_type FROM information_schema.columns WHERE table_schema='public'",
  );
  const employeeNikResult = await client.query(
    "SELECT is_nullable FROM information_schema.columns " +
      "WHERE table_schema='public' AND table_name='employees' AND column_name='national_id'",
  );
  const legacyLeaveStatusResult = await client.query(
    "SELECT count(*)::int AS total FROM employees WHERE employment_status='leave'",
  );
  const constraintResult = await client.query(
    "SELECT conname AS constraint_name FROM pg_constraint " +
      "WHERE connamespace='public'::regnamespace AND conname=ANY($1::text[])",
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
  const invalidColumnDefinitions = [];
  if (employeeNikResult.rows[0]?.is_nullable !== "NO")
    invalidColumnDefinitions.push("employees.national_id:NOT_NULL");
  if (legacyLeaveStatusResult.rows[0]?.total > 0)
    invalidColumnDefinitions.push("employees.employment_status:NO_LEAVE");
  const unitLocationActiveFrom = columnResult.rows.find(
    (row) =>
      row.table_name === "organization_unit_locations" && row.column_name === "active_from",
  );
  if (unitLocationActiveFrom?.column_default != null)
    invalidColumnDefinitions.push("organization_unit_locations.active_from:NO_DEFAULT");
  for (const [tableName, columnName] of [
    ["leave_types", "annual_allowance"],
    ["leave_requests", "requested_units"],
    ["leave_balance_transactions", "units"],
  ]) {
    const column = columnResult.rows.find(
      (row) => row.table_name === tableName && row.column_name === columnName,
    );
    if (column?.data_type !== "integer")
      invalidColumnDefinitions.push(`${tableName}.${columnName}:INTEGER`);
  }
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
      invalidColumnDefinitions.length === 0 &&
      missingConstraints.length === 0 &&
      missingPermissions.length === 0,
    missing_relations: missingRelations,
    missing_columns: missingColumns,
    remaining_legacy_columns: remainingLegacyColumns,
    invalid_column_definitions: invalidColumnDefinitions,
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
