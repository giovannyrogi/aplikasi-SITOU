import pool from "@/lib/dbConfig";
import { ServiceError } from "@/lib/api/routeHelpers";
import { organizationToday } from "@/lib/reports/policy.mjs";
import { listEmployees } from "./service";

export const EMPLOYEE_EXPORT_LIMIT = 5000;
export const EMPLOYEE_EXPORT_DETAIL_LIMIT = 50000;

const detailTables = Object.freeze([
  ["identifiers", "employee_identifiers"],
  ["bankAccounts", "employee_bank_accounts"],
  ["dependents", "employee_dependents"],
  ["emergencyContacts", "employee_emergency_contacts"],
  ["socialAccounts", "employee_social_accounts"],
  ["educations", "employee_educations"],
  ["skills", "employee_skills"],
  ["certifications", "employee_certifications"],
  ["contracts", "employment_contracts"],
  ["assignments", "employee_assignments"],
]);

const filterReferenceTables = Object.freeze({
  locationId: "locations",
  organizationUnitId: "organization_units",
  positionId: "positions",
  employmentTypeId: "employment_types",
});

/** Mengambil label filter dari master organisasi tanpa menerima nama tabel dari request. */
async function readFilterLabels(database, organizationId, filters) {
  const labels = {};
  for (const [key, table] of Object.entries(filterReferenceTables)) {
    const value = filters[key];
    if (!value || value === "without_active_contract") continue;
    const result = await database.query(
      `SELECT name FROM ${table} WHERE organization_id=$1 AND id=$2`,
      [organizationId, value],
    );
    labels[key] = result.rows[0]?.name || "Pilihan tidak tersedia";
  }
  if (filters.createdByUserId) {
    const result = await database.query(
      `SELECT COALESCE(NULLIF(identity.display_name,''),account.username) AS name
       FROM users account LEFT JOIN v_user_identity identity ON identity.user_id=account.id
       WHERE account.id=$1`,
      [filters.createdByUserId],
    );
    labels.createdByUserId = result.rows[0]?.name || "Akun tidak tersedia";
  }
  return labels;
}

const employeeIdOrder = (employees) =>
  new Map(employees.map((employee, index) => [String(employee.id), index]));

/** Urutan detail selalu mengikuti Nama Pegawai lalu NIP dari daftar terfilter. */
function sortDetails(rows, order, keys = []) {
  return rows.sort((left, right) => {
    const employeeOrder =
      (order.get(String(left.employee_id)) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(String(right.employee_id)) ?? Number.MAX_SAFE_INTEGER);
    if (employeeOrder) return employeeOrder;
    for (const key of keys) {
      const comparison = String(left[key] ?? "").localeCompare(String(right[key] ?? ""), "id-ID", {
        numeric: true,
        sensitivity: "base",
      });
      if (comparison) return comparison;
    }
    return Number(left.id || 0) - Number(right.id || 0);
  });
}

/** Membaca snapshot export secara batch dan mempertahankan filter/cakupan dari daftar pegawai. */
async function readEmployeeExportSnapshot(database, { filters, search, organizationId, actor }) {
  if (
    actor.role_code === "hrd" &&
    actor.location_scope_mode === "selected" &&
    !actor.role_assignment_id
  )
    throw new ServiceError(
      "EMPLOYEE_EXPORT_SCOPE_INVALID",
      "Cakupan lokasi akun belum lengkap. Hubungi Admin organisasi.",
      403,
    );
  const listed = await listEmployees({
    ...filters,
    search,
    organizationId,
    actor,
    page: 1,
    pageSize: EMPLOYEE_EXPORT_LIMIT + 1,
  });
  if (listed.total > EMPLOYEE_EXPORT_LIMIT)
    throw new ServiceError(
      "EMPLOYEE_EXPORT_LIMIT_EXCEEDED",
      "Hasil export melebihi 5.000 pegawai. Persempit filter sebelum mengunduh Excel.",
      400,
    );

  const organizationResult = await database.query(
    `SELECT id::text,name,timezone FROM organizations WHERE id=$1 AND is_active=true`,
    [organizationId],
  );
  const organization = organizationResult.rows[0];
  if (!organization)
    throw new ServiceError("ORGANIZATION_NOT_FOUND", "Organisasi aktif tidak ditemukan.", 404);

  const employees = listed.data.sort((left, right) => {
    const name = String(left.full_name).localeCompare(String(right.full_name), "id-ID", {
      sensitivity: "base",
    });
    return (
      name ||
      String(left.employee_no).localeCompare(String(right.employee_no), "id-ID", {
        numeric: true,
        sensitivity: "base",
      })
    );
  });
  const ids = employees.map((employee) => String(employee.id));
  const empty = { rows: [] };
  let queryChain = Promise.resolve();
  const query = (text) => {
    const run = () =>
      ids.length ? database.query(text, [organizationId, ids]) : Promise.resolve(empty);
    const result = queryChain.then(run, run);
    queryChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  const detailCountResult = ids.length
    ? await database.query(
        `SELECT (${detailTables
          .map(
            ([, table]) =>
              `(SELECT count(*) FROM ${table} WHERE organization_id=$1 AND employee_id=ANY($2::bigint[]))`,
          )
          .join(" + ")})::bigint AS total`,
        [organizationId, ids],
      )
    : { rows: [{ total: "0" }] };
  const expectedDetailRowCount = Number(detailCountResult.rows[0].total);
  if (expectedDetailRowCount > EMPLOYEE_EXPORT_DETAIL_LIMIT)
    throw new ServiceError(
      "EMPLOYEE_EXPORT_DETAIL_LIMIT_EXCEEDED",
      "Detail export melebihi 50.000 baris. Persempit filter sebelum mengunduh Excel.",
      400,
    );

  const [
    accounts,
    identifiers,
    bankAccounts,
    dependents,
    emergencyContacts,
    socialAccounts,
    educations,
    skills,
    certifications,
    contracts,
    assignments,
    documents,
  ] = await Promise.all([
    query(`SELECT employee.id::text AS employee_id,account.is_active AS account_is_active
      FROM employees employee LEFT JOIN users account ON account.id=employee.user_id
      WHERE employee.organization_id=$1 AND employee.id=ANY($2::bigint[])`),
    query(`SELECT identifier.id::text,identifier.employee_id::text,identifier.identifier_type,
        identifier.identifier_label,identifier.identifier_value,identifier.issued_at::text,
        identifier.expires_at::text,identifier.is_verified,
        (file.id IS NOT NULL) AS has_document
      FROM employee_identifiers identifier
      LEFT JOIN stored_files file ON file.organization_id=identifier.organization_id
        AND file.id=identifier.document_file_id AND file.deleted_at IS NULL
      WHERE identifier.organization_id=$1 AND identifier.employee_id=ANY($2::bigint[])`),
    query(`SELECT id::text,employee_id::text,bank_name,account_number,account_holder,is_primary,
        verified_at::text
      FROM employee_bank_accounts
      WHERE organization_id=$1 AND employee_id=ANY($2::bigint[])`),
    query(`SELECT id::text,employee_id::text,relationship,full_name,birth_date::text,national_id,
        phone,is_dependent,is_emergency_contact,notes
      FROM employee_dependents
      WHERE organization_id=$1 AND employee_id=ANY($2::bigint[])`),
    query(`SELECT id::text,employee_id::text,full_name,relationship,phone,address,is_primary
      FROM employee_emergency_contacts
      WHERE organization_id=$1 AND employee_id=ANY($2::bigint[])`),
    query(`SELECT id::text,employee_id::text,platform,handle_or_url
      FROM employee_social_accounts
      WHERE organization_id=$1 AND employee_id=ANY($2::bigint[])`),
    query(`SELECT education.id::text,education.employee_id::text,education.education_level,
        education.institution,education.field_of_study,education.graduation_year,
        education.is_highest,(file.id IS NOT NULL) AS has_certificate
      FROM employee_educations education
      LEFT JOIN stored_files file ON file.organization_id=education.organization_id
        AND file.id=education.certificate_file_id AND file.deleted_at IS NULL
      WHERE education.organization_id=$1 AND education.employee_id=ANY($2::bigint[])`),
    query(`SELECT id::text,employee_id::text,skill_name,proficiency_level,notes
      FROM employee_skills WHERE organization_id=$1 AND employee_id=ANY($2::bigint[])`),
    query(`SELECT certification.id::text,certification.employee_id::text,
        certification.certification_name,certification.issuer,certification.credential_no,
        certification.issued_at::text,certification.expires_at::text,
        (file.id IS NOT NULL) AS has_certificate
      FROM employee_certifications certification
      LEFT JOIN stored_files file ON file.organization_id=certification.organization_id
        AND file.id=certification.certificate_file_id AND file.deleted_at IS NULL
      WHERE certification.organization_id=$1 AND certification.employee_id=ANY($2::bigint[])`),
    query(`SELECT contract.id::text,contract.employee_id::text,type.code AS employment_type_code,
        type.name AS employment_type_name,contract.contract_no,contract.start_date::text,
        contract.end_date::text,contract.status,contract.notes,(file.id IS NOT NULL) AS has_document,
        contract.created_at::text,contract.updated_at::text,contract.cancelled_at::text,
        contract.cancellation_reason,corrected.actor_name AS corrected_by_name,
        corrected.occurred_at::text AS corrected_at,cancelled_identity.display_name AS cancelled_by_name
      FROM employment_contracts contract
      JOIN employment_types type ON type.organization_id=contract.organization_id
        AND type.id=contract.employment_type_id
      LEFT JOIN stored_files file ON file.organization_id=contract.organization_id
        AND file.id=contract.document_file_id AND file.deleted_at IS NULL
      LEFT JOIN v_user_identity cancelled_identity ON cancelled_identity.user_id=contract.cancelled_by_user_id
      LEFT JOIN LATERAL (
        SELECT identity.display_name AS actor_name,audit.occurred_at
        FROM audit_logs audit LEFT JOIN v_user_identity identity ON identity.user_id=audit.actor_user_id
        WHERE audit.organization_id=contract.organization_id
          AND audit.entity_type='employment_contract' AND audit.entity_id=contract.id::text
          AND audit.action='employment_contract.correct'
        ORDER BY audit.occurred_at DESC,audit.id DESC LIMIT 1
      ) corrected ON true
      WHERE contract.organization_id=$1 AND contract.employee_id=ANY($2::bigint[])`),
    query(`SELECT assignment.id::text,assignment.employee_id::text,location.name AS location_name,
        unit.name AS unit_name,position.name AS position_name,supervisor.full_name AS supervisor_name,
        assignment.assignment_type,assignment.change_type,assignment.effective_from::text,
        assignment.effective_until::text,assignment.decree_no,assignment.notes,
        (file.id IS NOT NULL) AS has_document,assignment.created_at::text,
        assignment.updated_at::text,corrected.actor_name AS corrected_by_name,
        corrected.occurred_at::text AS corrected_at
      FROM employee_assignments assignment
      JOIN locations location ON location.organization_id=assignment.organization_id
        AND location.id=assignment.location_id
      JOIN organization_units unit ON unit.organization_id=assignment.organization_id
        AND unit.id=assignment.organization_unit_id
      LEFT JOIN positions position ON position.organization_id=assignment.organization_id
        AND position.id=assignment.position_id
      LEFT JOIN employees supervisor ON supervisor.organization_id=assignment.organization_id
        AND supervisor.id=assignment.supervisor_employee_id
      LEFT JOIN stored_files file ON file.organization_id=assignment.organization_id
        AND file.id=assignment.document_file_id AND file.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT identity.display_name AS actor_name,audit.occurred_at
        FROM audit_logs audit LEFT JOIN v_user_identity identity ON identity.user_id=audit.actor_user_id
        WHERE audit.organization_id=assignment.organization_id
          AND audit.entity_type='employee_assignment' AND audit.entity_id=assignment.id::text
          AND audit.action='employee_assignment.correct'
        ORDER BY audit.occurred_at DESC,audit.id DESC LIMIT 1
      ) corrected ON true
      WHERE assignment.organization_id=$1 AND assignment.employee_id=ANY($2::bigint[])`),
    query(`WITH document_refs AS (
        SELECT employee.id AS employee_id,'pas_foto'::text AS document_kind,file.id AS file_id,file.created_at
        FROM employees employee JOIN stored_files file
          ON file.organization_id=employee.organization_id AND file.id=employee.profile_photo_file_id
          AND file.deleted_at IS NULL
        WHERE employee.organization_id=$1 AND employee.id=ANY($2::bigint[])
        UNION ALL
        SELECT document.employee_id,document.document_type,file.id,file.created_at
        FROM employee_documents document JOIN stored_files file
          ON file.organization_id=document.organization_id AND file.id=document.file_id
          AND file.deleted_at IS NULL
        WHERE document.organization_id=$1 AND document.employee_id=ANY($2::bigint[])
          AND document.document_type='ktp'
        UNION ALL
        SELECT identifier.employee_id,CASE identifier.identifier_type
          WHEN 'family_card' THEN 'kk' WHEN 'tax_npwp' THEN 'npwp'
          WHEN 'bpjs_health' THEN 'bpjs_health' WHEN 'bpjs_employment' THEN 'bpjs_employment'
          ELSE 'identity_other' END,file.id,file.created_at
        FROM employee_identifiers identifier JOIN stored_files file
          ON file.organization_id=identifier.organization_id AND file.id=identifier.document_file_id
          AND file.deleted_at IS NULL
        WHERE identifier.organization_id=$1 AND identifier.employee_id=ANY($2::bigint[])
        UNION ALL
        SELECT contract.employee_id,'kontrak',file.id,file.created_at
        FROM employment_contracts contract JOIN stored_files file
          ON file.organization_id=contract.organization_id AND file.id=contract.document_file_id
          AND file.deleted_at IS NULL
        WHERE contract.organization_id=$1 AND contract.employee_id=ANY($2::bigint[])
        UNION ALL
        SELECT assignment.employee_id,'sk_penempatan',file.id,file.created_at
        FROM employee_assignments assignment JOIN stored_files file
          ON file.organization_id=assignment.organization_id AND file.id=assignment.document_file_id
          AND file.deleted_at IS NULL
        WHERE assignment.organization_id=$1 AND assignment.employee_id=ANY($2::bigint[])
        UNION ALL
        SELECT education.employee_id,'ijazah',file.id,file.created_at
        FROM employee_educations education JOIN stored_files file
          ON file.organization_id=education.organization_id AND file.id=education.certificate_file_id
          AND file.deleted_at IS NULL
        WHERE education.organization_id=$1 AND education.employee_id=ANY($2::bigint[])
        UNION ALL
        SELECT certification.employee_id,'sertifikasi',file.id,file.created_at
        FROM employee_certifications certification JOIN stored_files file
          ON file.organization_id=certification.organization_id AND file.id=certification.certificate_file_id
          AND file.deleted_at IS NULL
        WHERE certification.organization_id=$1 AND certification.employee_id=ANY($2::bigint[])
      )
      SELECT employee_id::text,document_kind,count(DISTINCT file_id)::int AS file_count,
        max(created_at)::text AS latest_uploaded_at
      FROM document_refs GROUP BY employee_id,document_kind`),
  ]);
  const filterLabels = await readFilterLabels(database, organizationId, filters);

  const accountByEmployee = new Map(accounts.rows.map((row) => [String(row.employee_id), row]));
  for (const employee of employees) {
    const account = accountByEmployee.get(String(employee.id));
    employee.account_status = !employee.user_id
      ? "not_linked"
      : account?.account_is_active
        ? "active"
        : "inactive";
  }

  const order = employeeIdOrder(employees);
  const sections = {
    identifiers: sortDetails(identifiers.rows, order, ["identifier_type", "identifier_label"]),
    bankAccounts: sortDetails(bankAccounts.rows, order, ["bank_name", "account_number"]),
    dependents: sortDetails(dependents.rows, order, ["full_name"]),
    emergencyContacts: sortDetails(emergencyContacts.rows, order, ["is_primary", "full_name"]),
    socialAccounts: sortDetails(socialAccounts.rows, order, ["platform"]),
    educations: sortDetails(educations.rows, order, ["is_highest", "graduation_year"]),
    skills: sortDetails(skills.rows, order, ["skill_name"]),
    certifications: sortDetails(certifications.rows, order, ["issued_at", "certification_name"]),
    contracts: sortDetails(contracts.rows, order, ["start_date"]),
    assignments: sortDetails(assignments.rows, order, ["effective_from"]),
  };
  const detailRowCount = detailTables.reduce((total, [key]) => total + sections[key].length, 0);
  const outputCount = (rows) => {
    const counts = new Map();
    for (const row of rows)
      counts.set(String(row.employee_id), (counts.get(String(row.employee_id)) || 0) + 1);
    return employees.reduce(
      (total, employee) => total + Math.max(1, counts.get(String(employee.id)) || 0),
      0,
    );
  };
  const sheetRowCounts = {
    Ringkasan: employees.length,
    Kelengkapan_Dokumen: employees.length,
    Kontak: employees.length,
    Identitas: employees.length + sections.identifiers.length,
    Rekening: outputCount(sections.bankAccounts),
    Keluarga: outputCount(sections.dependents),
    Kontak_Darurat: outputCount(sections.emergencyContacts),
    Akun_Sosial: outputCount(sections.socialAccounts),
    Pendidikan: outputCount(sections.educations),
    Keahlian: outputCount(sections.skills),
    Sertifikasi: outputCount(sections.certifications),
    Kontrak_Histori: outputCount(sections.contracts),
    Penempatan_Histori: outputCount(sections.assignments),
  };
  if (detailRowCount !== expectedDetailRowCount)
    throw new ServiceError(
      "EMPLOYEE_EXPORT_SNAPSHOT_INVALID",
      "Snapshot export berubah saat diproses. Silakan ulangi unduhan.",
      409,
    );

  return {
    organization,
    generatedAt: new Date().toISOString(),
    asOf: organizationToday(organization.timezone),
    filters: { ...filters, search },
    filterLabels,
    employees,
    documents: documents.rows,
    sections,
    detailRowCount,
    sheetRowCounts,
  };
}

/** Seluruh sheet membaca satu snapshot repeatable-read agar hubungan antar-sheet tetap konsisten. */
export async function readEmployeeExport(input) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const report = await readEmployeeExportSnapshot(client, input);
    await client.query("COMMIT");
    return report;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
