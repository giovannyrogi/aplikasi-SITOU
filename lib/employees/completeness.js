import { EMPLOYEE_COMPLETENESS_VALUES } from "./completenessOptions.js";

/** Alias hanya berasal dari query internal, bukan input pengguna. */
export function incompleteEmployeeSql(alias) {
  return `(${alias}.national_id IS NULL OR ${alias}.profile_photo_file_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM employee_contacts contact
      WHERE contact.organization_id=${alias}.organization_id AND contact.employee_id=${alias}.id)
    OR NOT EXISTS (SELECT 1 FROM employee_assignments assignment
      WHERE assignment.organization_id=${alias}.organization_id AND assignment.employee_id=${alias}.id
        AND assignment.assignment_type='primary' AND assignment.effective_from<=current_date
        AND (assignment.effective_until IS NULL OR assignment.effective_until>=current_date)))`;
}

/** File terhapus tidak dihitung; dukungan dokumen lama mengikuti hidrasi detail profil. */
function hasIdentityFileSql(alias, identifierType, documentType) {
  const identifier = identifierType
    ? `EXISTS (
    SELECT 1 FROM employee_identifiers identifier JOIN stored_files file
      ON file.organization_id=identifier.organization_id AND file.id=identifier.document_file_id
      AND file.deleted_at IS NULL
    WHERE identifier.organization_id=${alias}.organization_id AND identifier.employee_id=${alias}.id
      AND identifier.identifier_type='${identifierType}') OR `
    : "";
  return `(${identifier}EXISTS (
    SELECT 1 FROM employee_documents document JOIN stored_files file
      ON file.organization_id=document.organization_id AND file.id=document.file_id
      AND file.deleted_at IS NULL
    WHERE document.organization_id=${alias}.organization_id AND document.employee_id=${alias}.id
      AND document.document_type='${documentType}'))`;
}

/** Nomor dan foto diperiksa terpisah: salah satu kosong berarti belum lengkap. */
function incompleteIdentifierSql(alias, identifierType, documentType) {
  return `(NOT EXISTS (SELECT 1 FROM employee_identifiers identifier
    WHERE identifier.organization_id=${alias}.organization_id AND identifier.employee_id=${alias}.id
      AND identifier.identifier_type='${identifierType}'
      AND NULLIF(btrim(identifier.identifier_value),'') IS NOT NULL)
    OR NOT ${hasIdentityFileSql(alias, identifierType, documentType)})`;
}

/** Menghasilkan predicate dari pilihan tetap; request tidak pernah menjadi potongan SQL. */
export function employeeCompletenessSql(alias, value = "all") {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias) || !EMPLOYEE_COMPLETENESS_VALUES.includes(value))
    throw new Error("Filter kelengkapan tidak valid.");
  if (value === "all") return "TRUE";
  const identifiers = {
    missing_kk: ["family_card", "kk"],
    missing_npwp: ["tax_npwp", "npwp"],
    missing_bpjs_health: ["bpjs_health", "bpjs_health"],
    missing_bpjs_employment: ["bpjs_employment", "bpjs_employment"],
  };
  if (identifiers[value]) return incompleteIdentifierSql(alias, ...identifiers[value]);
  const predicates = {
    missing_photo: `NOT EXISTS (SELECT 1 FROM stored_files file
      WHERE file.organization_id=${alias}.organization_id AND file.id=${alias}.profile_photo_file_id
        AND file.deleted_at IS NULL)`,
    missing_ktp: `(NULLIF(btrim(${alias}.national_id),'') IS NULL
      OR NOT ${hasIdentityFileSql(alias, null, "ktp")})`,
    missing_whatsapp: `NOT EXISTS (SELECT 1 FROM employee_contacts contact
      WHERE contact.organization_id=${alias}.organization_id AND contact.employee_id=${alias}.id
        AND NULLIF(btrim(contact.whatsapp),'') IS NOT NULL)`,
    missing_address: `NOT EXISTS (SELECT 1 FROM employee_contacts contact
      WHERE contact.organization_id=${alias}.organization_id AND contact.employee_id=${alias}.id
        AND NULLIF(btrim(contact.ktp_address),'') IS NOT NULL
        AND NULLIF(btrim(contact.domicile_address),'') IS NOT NULL)`,
    missing_bank_account: `NOT EXISTS (SELECT 1 FROM employee_bank_accounts account
      WHERE account.organization_id=${alias}.organization_id AND account.employee_id=${alias}.id
        AND NULLIF(btrim(account.bank_name),'') IS NOT NULL
        AND NULLIF(btrim(account.account_number),'') IS NOT NULL
        AND NULLIF(btrim(account.account_holder),'') IS NOT NULL)`,
    missing_emergency_contact: `NOT EXISTS (SELECT 1 FROM employee_emergency_contacts contact
      WHERE contact.organization_id=${alias}.organization_id AND contact.employee_id=${alias}.id
        AND NULLIF(btrim(contact.full_name),'') IS NOT NULL
        AND NULLIF(btrim(contact.phone),'') IS NOT NULL)`,
    missing_education: `NOT EXISTS (SELECT 1 FROM employee_educations education
      WHERE education.organization_id=${alias}.organization_id AND education.employee_id=${alias}.id)`,
    missing_diploma: `EXISTS (SELECT 1 FROM employee_educations education
      WHERE education.organization_id=${alias}.organization_id AND education.employee_id=${alias}.id
        AND education.is_highest
        AND education.education_level NOT IN ('Tidak/Belum Pernah Sekolah','Tidak/Belum Tamat SD'))
      AND NOT EXISTS (SELECT 1 FROM employee_educations education JOIN stored_files file
        ON file.organization_id=education.organization_id AND file.id=education.certificate_file_id
        AND file.deleted_at IS NULL
      WHERE education.organization_id=${alias}.organization_id AND education.employee_id=${alias}.id
        AND education.is_highest)`,
  };
  return predicates[value];
}
