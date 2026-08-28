import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { ensureActorEmployeeAccess } from "@/lib/auth/permissions";
import { ensureEmployeeLifecycleEditable } from "@/lib/employees/lifecycleGuard";
import {
  discardPreparedEmployeeFile,
  finalizePreparedEmployeeFile,
  insertPreparedEmployeeFile,
  prepareEmployeeFileUpload,
  purgeQuarantinedFiles,
  quarantineStoredFiles,
  restoreQuarantinedFiles,
} from "@/lib/files/storage";

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
      certificate_file:
        education.certificate_file_id && education.certificate_name
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
      certificate_file:
        certification.certificate_file_id && certification.certificate_name
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
  // Menghapus baris KTP juga harus membersihkan NIK, bukan mempertahankan nilai lama di employees.
  await client.query("UPDATE employees SET national_id=$3 WHERE id=$1 AND organization_id=$2", [
    employeeId,
    organizationId,
    ktp?.identifierValue || null,
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

/** Menonaktifkan file profil yang sengaja dilepas dalam transaksi penyimpanan profil yang sama. */
async function softDeleteRemovedProfileFiles(
  client,
  employeeId,
  organizationId,
  removedFileIds,
  retainedFileIds,
  actor,
  requestId,
) {
  const retained = new Set(retainedFileIds.map(String));
  const requested = [...new Set(removedFileIds.map(String))].filter((id) => !retained.has(id));
  const files = requested.length
    ? await client.query(
        `SELECT id::text,category,deleted_at,object_key
       FROM stored_files
      WHERE organization_id=$1 AND employee_id=$2 AND id=ANY($3::bigint[])
      FOR UPDATE`,
        [organizationId, employeeId, requested],
      )
    : { rowCount: 0, rows: [] };
  const allowedCategories = new Set(["employee_photo", "identity", "education"]);
  if (
    files.rowCount !== requested.length ||
    files.rows.some((file) => !allowedCategories.has(file.category))
  )
    throw new ServiceError(
      "PROFILE_FILE_DELETE_INVALID",
      "Salah satu file yang akan dihapus tidak sesuai dengan profil pegawai.",
      400,
    );

  if (!requested.length) return [];
  const quarantinedFiles = await quarantineStoredFiles(files.rows);

  await client.query(
    `UPDATE employees SET profile_photo_file_id=NULL
      WHERE id=$1 AND organization_id=$2 AND profile_photo_file_id=ANY($3::bigint[])`,
    [employeeId, organizationId, requested],
  );
  await client.query(
    `UPDATE employee_identifiers SET document_file_id=NULL
      WHERE employee_id=$1 AND organization_id=$2 AND document_file_id=ANY($3::bigint[])`,
    [employeeId, organizationId, requested],
  );
  await client.query(
    `UPDATE employee_educations SET certificate_file_id=NULL
      WHERE employee_id=$1 AND organization_id=$2 AND certificate_file_id=ANY($3::bigint[])`,
    [employeeId, organizationId, requested],
  );
  await client.query(
    `UPDATE employee_certifications SET certificate_file_id=NULL
      WHERE employee_id=$1 AND organization_id=$2 AND certificate_file_id=ANY($3::bigint[])`,
    [employeeId, organizationId, requested],
  );
  await client.query(
    `DELETE FROM employee_documents
      WHERE employee_id=$1 AND organization_id=$2 AND file_id=ANY($3::bigint[])`,
    [employeeId, organizationId, requested],
  );
  await client.query(
    `UPDATE stored_files SET deleted_at=now()
      WHERE organization_id=$1 AND employee_id=$2 AND deleted_at IS NULL
        AND id=ANY($3::bigint[])`,
    [organizationId, employeeId, requested],
  );
  // Retry atau upload pengganti boleh membawa ID yang sudah nonaktif tanpa membuat audit ganda.
  for (const file of files.rows.filter((item) => !item.deleted_at))
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "private_file.soft_delete",
      entityType: "stored_file",
      entityId: file.id,
      beforeData: { employeeId: String(employeeId), category: file.category },
      requestId,
    });
  return quarantinedFiles;
}

/** Menyimpan profil sensitif dan hanya mengaudit jumlah section, bukan nilainya. */
export async function updateEmployeeProfileSections(
  employeeId,
  organizationId,
  profile,
  removedFileIds,
  actor,
  requestId,
  pendingUploads = [],
) {
  await ensureActorEmployeeAccess(actor, employeeId, organizationId);
  const identifierFileKinds = {
    ktp: "ktp",
    family_card: "kk",
    bpjs_health: "bpjs_kesehatan",
    bpjs_employment: "bpjs_ketenagakerjaan",
    tax_npwp: "npwp",
    other: "identitas_lain",
  };
  const preparedUploads = [];
  const workingProfile = structuredClone(profile);
  let quarantinedFiles = [];
  let transactionCommitted = false;

  try {
    /** Target upload diturunkan dari field profil agar kategori file tidak dipercaya dari klien. */
    for (const upload of pendingUploads) {
      let fileKind;
      if (upload.target === "profilePhoto") fileKind = "pas_foto";
      if (upload.target === "identifier") {
        const identifier = workingProfile.identifiers[upload.index];
        fileKind = identifierFileKinds[identifier?.identifierType];
      }
      if (upload.target === "education" && workingProfile.educations[upload.index])
        fileKind = "pendidikan";
      if (upload.target === "certification" && workingProfile.certifications[upload.index])
        fileKind = "sertifikasi";
      if (!fileKind)
        throw new ServiceError(
          "PROFILE_UPLOAD_TARGET_INVALID",
          "Tujuan file profil tidak valid. Pilih kembali file tersebut.",
          400,
        );
      preparedUploads.push({
        ...upload,
        prepared: await prepareEmployeeFileUpload({
          file: upload.file,
          fileKind,
          employeeId,
          organizationId,
        }),
      });
    }
  } catch (error) {
    await Promise.all(preparedUploads.map(({ prepared }) => discardPreparedEmployeeFile(prepared)));
    throw error;
  }

  try {
    const result = await withTransaction(async (client) => {
      await ensureActorEmployeeAccess(actor, employeeId, organizationId, client);
      await ensureEmployeeLifecycleEditable(client, employeeId, organizationId);
      const previous = await getEmployeeProfileSections(employeeId, organizationId, client);
      const previousFileIds = [
        previous.profilePhoto?.id,
        ...previous.identifiers.map((item) => item.document_file_id),
        ...previous.educations.map((item) => item.certificate_file_id),
        ...previous.certifications.map((item) => item.certificate_file_id),
      ].filter(Boolean);
      let profilePhotoFileId = previous.profilePhoto?.id || null;
      if (
        profilePhotoFileId &&
        removedFileIds.map(String).includes(String(profilePhotoFileId)) &&
        !pendingUploads.some((upload) => upload.target === "profilePhoto")
      ) {
        profilePhotoFileId = null;
        await client.query(
          "UPDATE employees SET profile_photo_file_id=NULL WHERE id=$1 AND organization_id=$2",
          [employeeId, organizationId],
        );
      }

      for (const upload of preparedUploads) {
        await finalizePreparedEmployeeFile(upload.prepared);
        const stored = await insertPreparedEmployeeFile(client, upload.prepared, {
          employeeId,
          organizationId,
          actor,
          requestId,
        });
        if (upload.target === "profilePhoto") {
          profilePhotoFileId = stored.id;
          await client.query(
            "UPDATE employees SET profile_photo_file_id=$3 WHERE id=$1 AND organization_id=$2",
            [employeeId, organizationId, stored.id],
          );
        } else {
          const collection =
            upload.target === "identifier"
              ? workingProfile.identifiers
              : upload.target === "education"
                ? workingProfile.educations
                : workingProfile.certifications;
          const idField = upload.target === "identifier" ? "documentFileId" : "certificateFileId";
          collection[upload.index][idField] = stored.id;
          if (upload.prepared.config.documentType)
            await client.query(
              `INSERT INTO employee_documents (organization_id,employee_id,document_type,file_id)
               VALUES ($1,$2,$3,$4)`,
              [organizationId, employeeId, upload.prepared.config.documentType, stored.id],
            );
        }
      }

      try {
        await replaceEmployeeProfileSections(client, employeeId, organizationId, workingProfile);
        const retainedFileIds = [
          profilePhotoFileId,
          ...workingProfile.identifiers.map((item) => item.documentFileId),
          ...workingProfile.educations.map((item) => item.certificateFileId),
          ...workingProfile.certifications.map((item) => item.certificateFileId),
        ].filter(Boolean);
        const obsoleteFileIds = previousFileIds.filter(
          (id) => !retainedFileIds.map(String).includes(String(id)),
        );
        quarantinedFiles = await softDeleteRemovedProfileFiles(
          client,
          employeeId,
          organizationId,
          [...removedFileIds, ...obsoleteFileIds],
          retainedFileIds,
          actor,
          requestId,
        );
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
          Object.entries(workingProfile).map(([key, values]) => [key, values.length]),
        ),
        requestId,
      });
      return getEmployeeProfileSections(employeeId, organizationId, client);
    });
    transactionCommitted = true;
    await purgeQuarantinedFiles(quarantinedFiles);
    return result;
  } catch (error) {
    if (!transactionCommitted) {
      await restoreQuarantinedFiles(quarantinedFiles);
      await Promise.all(
        preparedUploads.map(({ prepared }) => discardPreparedEmployeeFile(prepared)),
      );
    }
    throw error;
  }
}
