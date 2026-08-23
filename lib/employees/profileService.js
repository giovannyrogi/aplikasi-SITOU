import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { ensureActorEmployeeAccess } from "@/lib/auth/permissions";

const PROFILE_TABLES = [
  "employee_identifiers",
  "employee_bank_accounts",
  "employee_dependents",
  "employee_emergency_contacts",
  "employee_social_accounts",
  "employee_educations",
  "employee_skills",
  "employee_certifications",
];

/** Mengambil seluruh section profil sensitif dengan kolom eksplisit. */
export async function getEmployeeProfileSections(
  employeeId,
  organizationId,
  database = pool,
  { includeBankAccounts = true } = {},
) {
  const employee = await database.query(
    `SELECT employee.id,employee.national_id,employee.profile_photo_file_id::text,
        photo.original_name AS profile_photo_name,photo.mime_type AS profile_photo_mime_type,
        photo.size_bytes AS profile_photo_size_bytes
       FROM employees employee
       LEFT JOIN stored_files photo ON photo.organization_id=employee.organization_id
         AND photo.id=employee.profile_photo_file_id AND photo.deleted_at IS NULL
       WHERE employee.id=$1 AND employee.organization_id=$2 AND employee.deleted_at IS NULL`,
    [employeeId, organizationId],
  );
  if (!employee.rows[0]) throw new ServiceError("NOT_FOUND", "Pegawai tidak ditemukan.", 404);
  const [
    identifiers,
    banks,
    dependents,
    emergencies,
    socials,
    educations,
    skills,
    certifications,
    identityDocuments,
  ] = await Promise.all([
    database.query(
      `SELECT identifier.id::text,identifier.identifier_type,identifier.identifier_label,
          identifier.identifier_value,identifier.issued_at::text,identifier.expires_at::text,
          identifier.is_verified,identifier.document_file_id::text,
          file.original_name AS document_name,file.mime_type AS document_mime_type,
          file.size_bytes AS document_size_bytes
         FROM employee_identifiers identifier
         LEFT JOIN stored_files file ON file.organization_id=identifier.organization_id
           AND file.id=identifier.document_file_id AND file.deleted_at IS NULL
         WHERE identifier.organization_id=$1 AND identifier.employee_id=$2
         ORDER BY identifier.identifier_type,identifier.id`,
      [organizationId, employeeId],
    ),
    includeBankAccounts
      ? database.query(
          "SELECT id::text,bank_name,account_number,account_holder,is_primary,verified_at FROM employee_bank_accounts WHERE organization_id=$1 AND employee_id=$2 ORDER BY is_primary DESC,id",
          [organizationId, employeeId],
        )
      : Promise.resolve({ rows: [] }),
    database.query(
      "SELECT id::text,relationship,full_name,birth_date::text,national_id,phone,is_dependent,is_emergency_contact,notes FROM employee_dependents WHERE organization_id=$1 AND employee_id=$2 ORDER BY full_name",
      [organizationId, employeeId],
    ),
    database.query(
      "SELECT id::text,full_name,relationship,phone,address,is_primary FROM employee_emergency_contacts WHERE organization_id=$1 AND employee_id=$2 ORDER BY is_primary DESC,id",
      [organizationId, employeeId],
    ),
    database.query(
      "SELECT id::text,platform,handle_or_url FROM employee_social_accounts WHERE organization_id=$1 AND employee_id=$2 ORDER BY platform",
      [organizationId, employeeId],
    ),
    database.query(
      `SELECT education.id::text,education.education_level,education.institution,
          education.field_of_study,education.graduation_year,education.is_highest,
          education.certificate_file_id::text,file.original_name AS certificate_name,
          file.mime_type AS certificate_mime_type,file.size_bytes AS certificate_size_bytes
         FROM employee_educations education
         LEFT JOIN stored_files file ON file.organization_id=education.organization_id
           AND file.id=education.certificate_file_id AND file.deleted_at IS NULL
         WHERE education.organization_id=$1 AND education.employee_id=$2
         ORDER BY education.is_highest DESC,education.graduation_year DESC NULLS LAST`,
      [organizationId, employeeId],
    ),
    database.query(
      "SELECT id::text,skill_name,proficiency_level,notes FROM employee_skills WHERE organization_id=$1 AND employee_id=$2 ORDER BY skill_name",
      [organizationId, employeeId],
    ),
    database.query(
      `SELECT certification.id::text,certification.certification_name,certification.issuer,
          certification.credential_no,certification.issued_at::text,certification.expires_at::text,
          certification.certificate_file_id::text,file.original_name AS certificate_name,
          file.mime_type AS certificate_mime_type,file.size_bytes AS certificate_size_bytes
         FROM employee_certifications certification
         LEFT JOIN stored_files file ON file.organization_id=certification.organization_id
           AND file.id=certification.certificate_file_id AND file.deleted_at IS NULL
         WHERE certification.organization_id=$1 AND certification.employee_id=$2
         ORDER BY certification.issued_at DESC NULLS LAST`,
      [organizationId, employeeId],
    ),
    database.query(
      `SELECT document.document_type,file.id::text AS document_file_id,
          file.original_name AS document_name,file.mime_type AS document_mime_type,
          file.size_bytes AS document_size_bytes
         FROM employee_documents document
         JOIN stored_files file ON file.organization_id=document.organization_id
           AND file.id=document.file_id AND file.deleted_at IS NULL
         WHERE document.organization_id=$1 AND document.employee_id=$2
           AND document.document_type IN ('ktp','kk','npwp','bpjs_health','bpjs_employment','identity_other')
         ORDER BY document.created_at DESC,document.id DESC`,
      [organizationId, employeeId],
    ),
  ]);
  const latestDocumentByType = new Map();
  for (const document of identityDocuments.rows)
    if (!latestDocumentByType.has(document.document_type))
      latestDocumentByType.set(document.document_type, document);
  const documentTypeByIdentifier = {
    family_card: "kk",
    tax_npwp: "npwp",
    bpjs_health: "bpjs_health",
    bpjs_employment: "bpjs_employment",
    other: "identity_other",
  };
  const hydratedIdentifiers = identifiers.rows.map((identifier) => {
    const hydrated = identifier.document_file_id
      ? identifier
      : {
          ...identifier,
          ...(latestDocumentByType.get(documentTypeByIdentifier[identifier.identifier_type]) || {}),
        };
    return {
      ...hydrated,
      document_file: hydrated.document_file_id
        ? {
            id: hydrated.document_file_id,
            original_name: hydrated.document_name,
            mime_type: hydrated.document_mime_type,
            size_bytes: hydrated.document_size_bytes,
          }
        : null,
    };
  });
  const ktpDocument = latestDocumentByType.get("ktp") || {};
  const ktpIdentifier =
    employee.rows[0].national_id || ktpDocument.document_file_id
      ? [
          {
            id: "ktp",
            identifier_type: "ktp",
            identifier_label: "KTP",
            identifier_value: employee.rows[0].national_id || "",
            issued_at: null,
            expires_at: null,
            is_verified: false,
            ...ktpDocument,
            document_file: ktpDocument.document_file_id
              ? {
                  id: ktpDocument.document_file_id,
                  original_name: ktpDocument.document_name,
                  mime_type: ktpDocument.document_mime_type,
                  size_bytes: ktpDocument.document_size_bytes,
                }
              : null,
          },
        ]
      : [];
  return {
    // Foto hanya dikirim bila metadata file aktif masih ada agar form tidak membuat baris kosong.
    profilePhoto:
      employee.rows[0].profile_photo_file_id && employee.rows[0].profile_photo_name
        ? {
            id: employee.rows[0].profile_photo_file_id,
            original_name: employee.rows[0].profile_photo_name,
            mime_type: employee.rows[0].profile_photo_mime_type,
            size_bytes: employee.rows[0].profile_photo_size_bytes,
          }
        : null,
    identifiers: [...ktpIdentifier, ...hydratedIdentifiers],
    bankAccounts: banks.rows,
    dependents: dependents.rows,
    emergencyContacts: emergencies.rows,
    socialAccounts: socials.rows,
    educations: educations.rows.map((education) => ({
      ...education,
      certificate_file: education.certificate_file_id
        ? {
            id: education.certificate_file_id,
            original_name: education.certificate_name,
            mime_type: education.certificate_mime_type,
            size_bytes: education.certificate_size_bytes,
          }
        : null,
    })),
    skills: skills.rows,
    certifications: certifications.rows.map((certification) => ({
      ...certification,
      certificate_file: certification.certificate_file_id
        ? {
            id: certification.certificate_file_id,
            original_name: certification.certificate_name,
            mime_type: certification.certificate_mime_type,
            size_bytes: certification.certificate_size_bytes,
          }
        : null,
    })),
  };
}

/** Mengganti section administratif dalam transaksi; histori kontrak/penempatan tidak termasuk operasi ini. */
export async function replaceEmployeeProfileSections(client, employeeId, organizationId, profile) {
  const fileRequirements = [
    ...profile.identifiers.map((item) => ({ id: item.documentFileId, category: "identity" })),
    ...profile.educations.map((item) => ({ id: item.certificateFileId, category: "education" })),
    ...profile.certifications.map((item) => ({
      id: item.certificateFileId,
      category: "education",
    })),
  ].filter((item) => item.id);
  const fileIds = [...new Set(fileRequirements.map((item) => String(item.id)))];
  if (fileIds.length) {
    const validFiles = await client.query(
      `SELECT id::text,category FROM stored_files
       WHERE organization_id=$1 AND employee_id=$2 AND deleted_at IS NULL
         AND id=ANY($3::bigint[])`,
      [organizationId, employeeId, fileIds],
    );
    const categoryByFile = new Map(validFiles.rows.map((file) => [file.id, file.category]));
    if (
      validFiles.rowCount !== fileIds.length ||
      fileRequirements.some(
        (requirement) => categoryByFile.get(String(requirement.id)) !== requirement.category,
      )
    )
      throw new ServiceError(
        "PROFILE_FILE_INVALID",
        "Salah satu dokumen profil tidak sesuai dengan pegawai atau organisasi.",
        400,
      );
  }
  for (const table of PROFILE_TABLES)
    await client.query(`DELETE FROM ${table} WHERE organization_id=$1 AND employee_id=$2`, [
      organizationId,
      employeeId,
    ]);
  const ktp = profile.identifiers.find((value) => value.identifierType === "ktp");
  if (ktp?.identifierValue)
    await client.query("UPDATE employees SET national_id=$3 WHERE id=$1 AND organization_id=$2", [
      employeeId,
      organizationId,
      ktp.identifierValue,
    ]);
  for (const value of profile.identifiers.filter((item) => item.identifierType !== "ktp"))
    await client.query(
      `INSERT INTO employee_identifiers
        (organization_id,employee_id,identifier_type,identifier_label,identifier_value,
         issued_at,expires_at,is_verified,document_file_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        organizationId,
        employeeId,
        value.identifierType,
        value.identifierLabel,
        value.identifierValue,
        value.issuedAt,
        value.expiresAt,
        value.isVerified,
        value.documentFileId,
      ],
    );
  for (const value of profile.bankAccounts)
    await client.query(
      "INSERT INTO employee_bank_accounts(organization_id,employee_id,bank_name,account_number,account_holder,is_primary) VALUES ($1,$2,$3,$4,$5,$6)",
      [
        organizationId,
        employeeId,
        value.bankName,
        value.accountNumber,
        value.accountHolder,
        value.isPrimary,
      ],
    );
  for (const value of profile.dependents)
    await client.query(
      "INSERT INTO employee_dependents(organization_id,employee_id,relationship,full_name,birth_date,national_id,phone,is_dependent,is_emergency_contact,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        organizationId,
        employeeId,
        value.relationship,
        value.fullName,
        value.birthDate,
        value.nationalId,
        value.phone,
        value.isDependent,
        value.isEmergencyContact,
        value.notes,
      ],
    );
  for (const value of profile.emergencyContacts)
    await client.query(
      "INSERT INTO employee_emergency_contacts(organization_id,employee_id,full_name,relationship,phone,address,is_primary) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [
        organizationId,
        employeeId,
        value.fullName,
        value.relationship,
        value.phone,
        value.address,
        value.isPrimary,
      ],
    );
  for (const value of profile.socialAccounts)
    await client.query(
      "INSERT INTO employee_social_accounts(organization_id,employee_id,platform,handle_or_url) VALUES ($1,$2,$3,$4)",
      [organizationId, employeeId, value.platform, value.handleOrUrl],
    );
  for (const value of profile.educations)
    await client.query(
      "INSERT INTO employee_educations(organization_id,employee_id,education_level,institution,field_of_study,graduation_year,is_highest,certificate_file_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        organizationId,
        employeeId,
        value.educationLevel,
        value.institution,
        value.fieldOfStudy,
        value.graduationYear,
        value.isHighest,
        value.certificateFileId,
      ],
    );
  for (const value of profile.skills)
    await client.query(
      "INSERT INTO employee_skills(organization_id,employee_id,skill_name,proficiency_level,notes) VALUES ($1,$2,$3,$4,$5)",
      [organizationId, employeeId, value.skillName, value.proficiencyLevel, value.notes],
    );
  for (const value of profile.certifications)
    await client.query(
      "INSERT INTO employee_certifications(organization_id,employee_id,certification_name,issuer,credential_no,issued_at,expires_at,certificate_file_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        organizationId,
        employeeId,
        value.certificationName,
        value.issuer,
        value.credentialNo,
        value.issuedAt,
        value.expiresAt,
        value.certificateFileId,
      ],
    );
}

/** Menyimpan profil sensitif dan hanya mengaudit jumlah section, bukan nilainya. */
export async function updateEmployeeProfileSections(
  employeeId,
  organizationId,
  profile,
  actor,
  requestId,
) {
  return withTransaction(async (client) => {
    await ensureActorEmployeeAccess(actor, employeeId, organizationId, client);
    await getEmployeeProfileSections(employeeId, organizationId, client);
    try {
      await replaceEmployeeProfileSections(client, employeeId, organizationId, profile);
    } catch (error) {
      if (error?.code === "23505")
        throw new ServiceError(
          "EMPLOYEE_IDENTIFIER_DUPLICATE",
          "NIK atau nomor identitas sudah digunakan. Periksa kembali data pegawai.",
          409,
        );
      throw error;
    }
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "employee.profile_sections.update",
      entityType: "employee",
      entityId: employeeId,
      afterData: Object.fromEntries(
        Object.entries(profile).map(([key, values]) => [key, values.length]),
      ),
      requestId,
    });
    return getEmployeeProfileSections(employeeId, organizationId, client);
  });
}
