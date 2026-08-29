import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { ensureActiveOrganization } from "@/lib/master-data/guards";
import { replaceEmployeeProfileSections } from "@/lib/employees/profileService";
import { validateEmployeeTermination } from "@/lib/employees/terminationPolicy.mjs";
import { ensureEmployeeLifecycleEditable } from "@/lib/employees/lifecycleGuard";
import {
  ensureActorEmployeeAccess,
  ensureActorLocationAccess,
  getActorLocationScope,
} from "@/lib/auth/permissions";

const activeAssignmentJoin = `LEFT JOIN LATERAL (
  SELECT assignment.*,location.code AS location_code,location.name AS location_name,
    unit.code AS unit_code,unit.name AS unit_name,position.code AS position_code,
    position.name AS position_name,supervisor.full_name AS supervisor_name
  FROM employee_assignments assignment
  JOIN locations location
    ON location.organization_id=assignment.organization_id AND location.id=assignment.location_id
  JOIN organization_units unit
    ON unit.organization_id=assignment.organization_id AND unit.id=assignment.organization_unit_id
  LEFT JOIN positions position
    ON position.organization_id=assignment.organization_id AND position.id=assignment.position_id
  LEFT JOIN employees supervisor
    ON supervisor.organization_id=assignment.organization_id
    AND supervisor.id=assignment.supervisor_employee_id
  WHERE assignment.organization_id=employee.organization_id AND assignment.employee_id=employee.id
    AND assignment.assignment_type='primary' AND assignment.effective_from<=current_date
    AND (assignment.effective_until IS NULL OR assignment.effective_until>=current_date)
  ORDER BY assignment.effective_from DESC,assignment.id DESC LIMIT 1
) current_assignment ON true`;

const activeContractJoin = `LEFT JOIN LATERAL (
  SELECT contract.*,employment_type.code AS employment_type_code,
    employment_type.name AS employment_type_name
  FROM employment_contracts contract
  JOIN employment_types employment_type
    ON employment_type.organization_id=contract.organization_id
    AND employment_type.id=contract.employment_type_id
  WHERE contract.organization_id=employee.organization_id AND contract.employee_id=employee.id
    AND contract.status IN ('active','draft')
  ORDER BY contract.start_date DESC,contract.id DESC LIMIT 1
) current_contract ON true`;

const employeeSelect = `SELECT employee.id::text,employee.organization_id::text,
  organization.name AS organization_name,employee.employee_no,employee.user_id::text,
  employee.full_name,employee.preferred_name,employee.national_id,employee.birth_place,
  employee.birth_date::text,employee.gender,employee.religion,employee.marital_status,
  employee.blood_type,employee.nationality,employee.joined_date::text,
  employee.employment_status,employee.termination_date::text,employee.termination_reason,
  employee.profile_photo_file_id::text,employee.updated_at,
  contact.personal_email,contact.whatsapp,
  contact.ktp_address,contact.domicile_address,contact.village,contact.district,
  contact.city,contact.province,contact.postal_code,
  current_assignment.id::text AS assignment_id,current_assignment.location_id::text,
  current_assignment.location_code,current_assignment.location_name,
  current_assignment.organization_unit_id::text,current_assignment.unit_code,
  current_assignment.unit_name,current_assignment.position_id::text,
  current_assignment.position_code,current_assignment.position_name,
  current_assignment.supervisor_employee_id::text,current_assignment.supervisor_name,
  current_assignment.effective_from::text AS assignment_effective_from,
  current_contract.id::text AS contract_id,current_contract.employment_type_id::text,
  current_contract.employment_type_code,current_contract.employment_type_name,
  current_contract.contract_no,current_contract.start_date::text AS contract_start_date,
  current_contract.end_date::text AS contract_end_date,current_contract.status AS contract_status,
  termination_audit.actor_name AS termination_recorded_by_name,
  termination_audit.occurred_at::text AS termination_recorded_at,
  (SELECT count(*)::int FROM disciplinary_actions action
    WHERE action.organization_id=employee.organization_id AND action.employee_id=employee.id
      AND action.status IN ('active','appealed')) AS active_sanction_count
  FROM employees employee
  JOIN organizations organization ON organization.id=employee.organization_id
  LEFT JOIN employee_contacts contact
    ON contact.organization_id=employee.organization_id AND contact.employee_id=employee.id
  ${activeAssignmentJoin}
  ${activeContractJoin}
  LEFT JOIN LATERAL (
    SELECT identity.display_name AS actor_name,audit.occurred_at
    FROM audit_logs audit
    LEFT JOIN v_user_identity identity ON identity.user_id=audit.actor_user_id
    WHERE audit.organization_id=employee.organization_id
      AND audit.entity_type='employee' AND audit.entity_id=employee.id::text
      AND audit.action='employee.terminate'
    ORDER BY audit.occurred_at DESC,audit.id DESC LIMIT 1
  ) termination_audit ON true`;

/** Mengembalikan snapshot audit tanpa NIK, alamat, rekening, atau data pribadi lain. */
const employeeAuditSnapshot = (value) => ({
  employeeNo: value.employeeNo || value.employee_no,
  fullName: value.fullName || value.full_name,
  employmentStatus: value.employmentStatus || value.employment_status,
  joinedDate: value.joinedDate || value.joined_date,
});

/** Memetakan unique violation menjadi pesan publik yang tidak membocorkan query. */
export const mapEmployeeConstraintError = (error) => {
  if (error?.code === "23505")
    throw new ServiceError(
      "EMPLOYEE_DUPLICATE",
      "NIP atau NIK sudah digunakan pada organisasi ini.",
      409,
    );
  throw error;
};

/** Memastikan seluruh master penempatan aktif, satu organisasi, dan unit tersedia pada lokasi. */
async function validateAssignmentReferences(client, organizationId, assignment, actor) {
  await ensureActorLocationAccess(actor, assignment.locationId, client);
  const result = await client.query(
    `SELECT location.id AS location_id,unit.id AS unit_id,position.id AS position_id,
      supervisor.id AS supervisor_id,
      EXISTS(
        SELECT 1 FROM organization_unit_locations mapping
        WHERE mapping.organization_id=$1 AND mapping.organization_unit_id=$3
          AND mapping.location_id=$2 AND mapping.active_from<=$6::date
          AND (mapping.active_until IS NULL OR mapping.active_until>=$6::date)
      ) AS unit_available
    FROM locations location
    JOIN organization_units unit ON unit.organization_id=location.organization_id
    LEFT JOIN positions position
      ON position.organization_id=location.organization_id AND position.id=$4
    LEFT JOIN employees supervisor
      ON supervisor.organization_id=location.organization_id AND supervisor.id=$5
      AND supervisor.deleted_at IS NULL
    WHERE location.organization_id=$1 AND location.id=$2 AND unit.id=$3
      AND location.is_active=true AND unit.is_active=true
      AND location.operational_from<=$6::date
      AND (location.operational_until IS NULL OR location.operational_until>=$6::date)`,
    [
      organizationId,
      assignment.locationId,
      assignment.organizationUnitId,
      assignment.positionId,
      assignment.supervisorEmployeeId,
      assignment.effectiveFrom,
    ],
  );
  const reference = result.rows[0];
  if (!reference)
    throw new ServiceError(
      "ASSIGNMENT_REFERENCE_INVALID",
      "Lokasi atau Divisi & Unit tidak aktif pada organisasi ini.",
      400,
    );
  if (assignment.positionId && !reference.position_id)
    throw new ServiceError("POSITION_INVALID", "Jabatan tidak ditemukan pada organisasi ini.", 400);
  if (assignment.supervisorEmployeeId && !reference.supervisor_id)
    throw new ServiceError(
      "SUPERVISOR_INVALID",
      "Atasan tidak ditemukan pada organisasi ini.",
      400,
    );
  if (!reference.unit_available)
    throw new ServiceError(
      "UNIT_LOCATION_INVALID",
      "Divisi atau unit belum tersedia pada lokasi yang dipilih.",
      400,
    );
}

/** Memastikan jenis kepegawaian aktif dan aturan tanggal akhir kontrak dipenuhi. */
async function validateContractReferences(client, organizationId, contract) {
  const result = await client.query(
    `SELECT id,requires_end_date FROM employment_types
      WHERE organization_id=$1 AND id=$2 AND is_active=true`,
    [organizationId, contract.employmentTypeId],
  );
  if (!result.rows[0])
    throw new ServiceError(
      "EMPLOYMENT_TYPE_INVALID",
      "Jenis kepegawaian tidak aktif pada organisasi ini.",
      400,
    );
  if (result.rows[0].requires_end_date && !contract.endDate)
    throw new ServiceError(
      "CONTRACT_END_REQUIRED",
      "Tanggal akhir wajib diisi untuk jenis kepegawaian tersebut.",
      400,
      { "contract.endDate": "Tanggal akhir kontrak wajib diisi." },
    );
}

/** Mengambil daftar pegawai sesuai filter organisasi dan cakupan lokasi HRD. */
export async function listEmployees({
  search,
  status,
  page,
  pageSize,
  organizationId,
  locationId,
  organizationUnitId,
  positionId,
  employmentTypeId,
  sanction,
  actor,
}) {
  const offset = (page - 1) * pageSize;
  const scopedLocationIds = await getActorLocationScope(actor);
  const params = [
    `%${search}%`,
    status,
    organizationId,
    locationId,
    organizationUnitId,
    positionId,
    employmentTypeId,
    sanction,
    scopedLocationIds,
    pageSize,
    offset,
  ];
  const where = `WHERE employee.deleted_at IS NULL
    AND ($1='' OR employee.employee_no ILIKE $1 OR employee.full_name ILIKE $1
      OR COALESCE(current_assignment.location_name,'') ILIKE $1
      OR COALESCE(current_assignment.unit_name,'') ILIKE $1
      OR COALESCE(current_assignment.position_name,'') ILIKE $1)
    AND ($2='all' OR ($2='active' AND employee.employment_status IN ('active','probation','leave'))
      OR ($2='inactive' AND employee.employment_status NOT IN ('active','probation','leave')))
    AND employee.organization_id=$3
    AND ($4::bigint IS NULL OR current_assignment.location_id=$4)
    AND ($5::bigint IS NULL OR current_assignment.organization_unit_id=$5)
    AND ($6::bigint IS NULL OR current_assignment.position_id=$6)
    AND ($7::bigint IS NULL OR current_contract.employment_type_id=$7)
    AND ($8='all' OR ($8='with_sanction' AND EXISTS(
      SELECT 1 FROM disciplinary_actions action WHERE action.organization_id=employee.organization_id
      AND action.employee_id=employee.id AND action.status IN ('active','appealed')))
      OR ($8='without_sanction' AND NOT EXISTS(
      SELECT 1 FROM disciplinary_actions action WHERE action.organization_id=employee.organization_id
      AND action.employee_id=employee.id AND action.status IN ('active','appealed'))))
    AND ($9::bigint[] IS NULL OR current_assignment.location_id=ANY($9::bigint[]))`;
  const [rows, count] = await Promise.all([
    pool.query(
      `${employeeSelect} ${where} ORDER BY employee.full_name LIMIT $10 OFFSET $11`,
      params,
    ),
    pool.query(
      `SELECT count(*)::int AS total FROM (${employeeSelect} ${where}) filtered`,
      params.slice(0, 9),
    ),
  ]);
  return { data: rows.rows, total: count.rows[0].total };
}

/** Mengambil detail pegawai dengan filter organisasi. */
export async function getEmployee(id, organizationId, database = pool) {
  const result = await database.query(
    `${employeeSelect} WHERE employee.id=$1 AND employee.organization_id=$2
      AND employee.deleted_at IS NULL`,
    [id, organizationId],
  );
  if (!result.rows[0]) throw new ServiceError("NOT_FOUND", "Pegawai tidak ditemukan.", 404);
  return result.rows[0];
}

/** Memastikan dokumen lifecycle memiliki kategori dan pemilik yang tepat. */
async function validateLifecycleDocument(
  client,
  organizationId,
  fileId,
  category,
  { employeeId = null, draftId = null } = {},
) {
  const result = await client.query(
    `SELECT id FROM stored_files
     WHERE id=$1 AND organization_id=$2 AND category=$3 AND deleted_at IS NULL
       AND (($4::bigint IS NOT NULL AND employee_id=$4)
         OR ($5::bigint IS NOT NULL AND onboarding_draft_id=$5))`,
    [fileId, organizationId, category, employeeId, draftId],
  );
  if (!result.rows[0])
    throw new ServiceError(
      "DOCUMENT_INVALID",
      "Dokumen tidak sesuai dengan data pegawai atau organisasi.",
      400,
    );
}

/** Membuat seluruh record awal memakai transaksi yang diberikan oleh use case pemanggil. */
export async function createEmployeeInTransaction(
  client,
  input,
  actor,
  requestId,
  { draftId = null } = {},
) {
  await ensureActiveOrganization(client, input.organizationId);
  await validateAssignmentReferences(client, input.organizationId, input.assignment, actor);
  await validateContractReferences(client, input.organizationId, input.contract);
  if (input.contract.documentFileId)
    await validateLifecycleDocument(
      client,
      input.organizationId,
      input.contract.documentFileId,
      "contract",
      { draftId },
    );
  if (input.assignment.documentFileId)
    await validateLifecycleDocument(
      client,
      input.organizationId,
      input.assignment.documentFileId,
      "assignment_decree",
      { draftId },
    );
  if (input.profilePhotoFileId)
    await validateLifecycleDocument(
      client,
      input.organizationId,
      input.profilePhotoFileId,
      "employee_photo",
      { draftId },
    );
  const employee = await client.query(
    `INSERT INTO employees
          (organization_id,employee_no,full_name,preferred_name,national_id,birth_place,birth_date,
           gender,religion,marital_status,blood_type,nationality,joined_date,employment_status,
           profile_photo_file_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
    [
      input.organizationId,
      input.employeeNo,
      input.fullName,
      input.preferredName,
      input.nationalId,
      input.birthPlace,
      input.birthDate,
      input.gender,
      input.religion,
      input.maritalStatus,
      input.bloodType,
      input.nationality,
      input.joinedDate,
      input.employmentStatus,
      input.profilePhotoFileId,
    ],
  );
  const employeeId = employee.rows[0].id;
  await upsertEmployeeContact(client, input.organizationId, employeeId, input.contact);
  await insertContract(client, input.organizationId, employeeId, input.contract);
  await insertAssignment(client, input.organizationId, employeeId, input.assignment, actor.id);
  await replaceEmployeeProfileSections(client, employeeId, input.organizationId, input.profile, {
    onboardingDraftId: draftId,
  });
  await writeAudit(client, {
    organizationId: input.organizationId,
    actorUserId: actor.id,
    action: "employee.create",
    entityType: "employee",
    entityId: employeeId,
    afterData: employeeAuditSnapshot(input),
    requestId,
  });
  return getEmployee(employeeId, input.organizationId, client);
}

/** Membuat profil, kontak, kontrak awal, dan penempatan awal dalam satu transaksi. */
export async function createEmployee(input, actor, requestId) {
  try {
    return await withTransaction((client) =>
      createEmployeeInTransaction(client, input, actor, requestId),
    );
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    mapEmployeeConstraintError(error);
  }
}

/** Memperbarui identitas dan kontak tanpa mengubah histori kontrak atau penempatan. */
export async function updateEmployee(id, input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      await ensureActorEmployeeAccess(actor, id, input.organizationId, client);
      await ensureEmployeeLifecycleEditable(client, id, input.organizationId);
      const before = await client.query(
        "SELECT * FROM employees WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL FOR UPDATE",
        [id, input.organizationId],
      );
      if (!before.rows[0]) throw new ServiceError("NOT_FOUND", "Pegawai tidak ditemukan.", 404);
      const updated = await client.query(
        `UPDATE employees SET employee_no=$3,full_name=$4,preferred_name=$5,national_id=$6,
          birth_place=$7,birth_date=$8,gender=$9,religion=$10,marital_status=$11,blood_type=$12,
          nationality=$13,joined_date=$14,employment_status=$15
          WHERE id=$1 AND organization_id=$2
          AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$16::timestamptz)
          RETURNING id`,
        [
          id,
          input.organizationId,
          input.employeeNo,
          input.fullName,
          input.preferredName,
          input.nationalId,
          input.birthPlace,
          input.birthDate,
          input.gender,
          input.religion,
          input.maritalStatus,
          input.bloodType,
          input.nationality,
          input.joinedDate,
          input.employmentStatus,
          input.version,
        ],
      );
      if (!updated.rowCount)
        throw new ServiceError(
          "VERSION_CONFLICT",
          "Data telah berubah. Muat ulang sebelum menyimpan.",
          409,
        );
      await upsertEmployeeContact(client, input.organizationId, id, input.contact);
      await writeAudit(client, {
        organizationId: input.organizationId,
        actorUserId: actor.id,
        action: "employee.update",
        entityType: "employee",
        entityId: id,
        beforeData: employeeAuditSnapshot(before.rows[0]),
        afterData: employeeAuditSnapshot(input),
        requestId,
      });
      return getEmployee(id, input.organizationId, client);
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    mapEmployeeConstraintError(error);
  }
}

/** Menambah penempatan baru dan menutup penempatan utama lama tanpa menimpa histori. */
export async function createEmployeeAssignment(
  employeeId,
  organizationId,
  input,
  actor,
  requestId,
) {
  return withTransaction(async (client) => {
    await ensureActorEmployeeAccess(actor, employeeId, organizationId, client);
    await ensureEmployeeLifecycleEditable(client, employeeId, organizationId);
    await validateAssignmentReferences(client, organizationId, input, actor);
    await validateLifecycleDocument(
      client,
      organizationId,
      input.documentFileId,
      "assignment_decree",
      { employeeId },
    );
    if (String(input.supervisorEmployeeId || "") === String(employeeId))
      throw new ServiceError(
        "SUPERVISOR_INVALID",
        "Pegawai tidak dapat menjadi atasannya sendiri.",
        400,
      );
    if (input.assignmentType === "primary") {
      const current = await client.query(
        `SELECT id,effective_from::text AS effective_from
         FROM employee_assignments WHERE employee_id=$1 AND organization_id=$2
          AND assignment_type='primary' AND effective_until IS NULL FOR UPDATE`,
        [employeeId, organizationId],
      );
      if (current.rows[0]) {
        if (input.effectiveFrom <= String(current.rows[0].effective_from).slice(0, 10))
          throw new ServiceError(
            "ASSIGNMENT_DATE_INVALID",
            "Tanggal penempatan baru harus setelah awal penempatan utama saat ini.",
            409,
          );
        await client.query(
          "UPDATE employee_assignments SET effective_until=$3::date-1 WHERE id=$1 AND organization_id=$2",
          [current.rows[0].id, organizationId, input.effectiveFrom],
        );
      }
    }
    const id = await insertAssignment(client, organizationId, employeeId, input, actor.id);
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "employee_assignment.create",
      entityType: "employee_assignment",
      entityId: id,
      afterData: { ...input, employeeId: String(employeeId) },
      requestId,
    });
    return getEmployeeHistory(employeeId, organizationId, client);
  });
}

/** Mengoreksi salah input penempatan tanpa mengubah urutan lifecycle atau menghapus histori. */
export async function correctEmployeeAssignment(
  employeeId,
  assignmentId,
  organizationId,
  input,
  actor,
  requestId,
) {
  return withTransaction(async (client) => {
    await ensureActorEmployeeAccess(actor, employeeId, organizationId, client);
    await ensureEmployeeLifecycleEditable(client, employeeId, organizationId);
    const before = await client.query(
      `SELECT * FROM employee_assignments
       WHERE id=$1 AND employee_id=$2 AND organization_id=$3 FOR UPDATE`,
      [assignmentId, employeeId, organizationId],
    );
    if (!before.rows[0]) throw new ServiceError("NOT_FOUND", "Penempatan tidak ditemukan.", 404);

    const current = before.rows[0];
    if (!current.effective_until && input.effectiveUntil)
      throw new ServiceError(
        "ASSIGNMENT_LIFECYCLE_INVALID",
        "Penempatan aktif hanya dapat ditutup melalui aksi Penempatan baru.",
        409,
      );
    if (current.effective_until && !input.effectiveUntil)
      throw new ServiceError(
        "ASSIGNMENT_LIFECYCLE_INVALID",
        "Penempatan historis tidak dapat diaktifkan kembali melalui koreksi.",
        409,
      );
    if (
      current.assignment_type === "primary" &&
      !current.effective_until &&
      input.assignmentType !== "primary"
    )
      throw new ServiceError(
        "ASSIGNMENT_TYPE_INVALID",
        "Jenis penempatan utama aktif tidak dapat diubah. Buat penempatan baru bila status penugasan berubah.",
        409,
      );

    await validateAssignmentReferences(client, organizationId, input, actor);
    await validateLifecycleDocument(
      client,
      organizationId,
      input.documentFileId,
      "assignment_decree",
      { employeeId },
    );
    if (String(input.supervisorEmployeeId || "") === String(employeeId))
      throw new ServiceError(
        "SUPERVISOR_INVALID",
        "Pegawai tidak dapat menjadi atasannya sendiri.",
        400,
      );

    if (input.assignmentType === "primary") {
      const overlap = await client.query(
        `SELECT id FROM employee_assignments
         WHERE organization_id=$1 AND employee_id=$2 AND id<>$3
           AND assignment_type='primary'
           AND daterange(effective_from,COALESCE(effective_until,'infinity'::date),'[]')
             && daterange($4::date,COALESCE($5::date,'infinity'::date),'[]')
         FOR UPDATE`,
        [organizationId, employeeId, assignmentId, input.effectiveFrom, input.effectiveUntil],
      );
      if (overlap.rowCount)
        throw new ServiceError(
          "ASSIGNMENT_OVERLAP",
          "Periode koreksi bertumpuk dengan penempatan utama lain.",
          409,
        );
    }

    const updated = await client.query(
      `UPDATE employee_assignments
       SET location_id=$4,organization_unit_id=$5,position_id=$6,
         supervisor_employee_id=$7,assignment_type=$8,change_type=$9,
         effective_from=$10,effective_until=$11,decree_no=$12,
         document_file_id=$13,notes=$14
       WHERE id=$1 AND employee_id=$2 AND organization_id=$3
         AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$15::timestamptz)
       RETURNING id`,
      [
        assignmentId,
        employeeId,
        organizationId,
        input.locationId,
        input.organizationUnitId,
        input.positionId,
        input.supervisorEmployeeId,
        input.assignmentType,
        input.changeType,
        input.effectiveFrom,
        input.effectiveUntil,
        input.decreeNo,
        input.documentFileId,
        input.notes,
        input.version,
      ],
    );
    if (!updated.rowCount)
      throw new ServiceError(
        "VERSION_CONFLICT",
        "Penempatan telah berubah. Muat ulang sebelum menyimpan koreksi.",
        409,
      );

    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "employee_assignment.correct",
      entityType: "employee_assignment",
      entityId: assignmentId,
      beforeData: {
        locationId: current.location_id,
        organizationUnitId: current.organization_unit_id,
        positionId: current.position_id,
        supervisorEmployeeId: current.supervisor_employee_id,
        assignmentType: current.assignment_type,
        changeType: current.change_type,
        effectiveFrom: current.effective_from,
        effectiveUntil: current.effective_until,
        decreeNo: current.decree_no,
        documentFileId: current.document_file_id,
      },
      afterData: {
        locationId: input.locationId,
        organizationUnitId: input.organizationUnitId,
        positionId: input.positionId,
        supervisorEmployeeId: input.supervisorEmployeeId,
        assignmentType: input.assignmentType,
        changeType: input.changeType,
        effectiveFrom: input.effectiveFrom,
        effectiveUntil: input.effectiveUntil,
        decreeNo: input.decreeNo,
        documentFileId: input.documentFileId,
      },
      requestId,
    });
    return getEmployeeHistory(employeeId, organizationId, client);
  });
}

/** Menambah kontrak dan menandai kontrak aktif sebelumnya sebagai diperpanjang. */
export async function createEmployeeContract(employeeId, organizationId, input, actor, requestId) {
  return withTransaction(async (client) => {
    await ensureActorEmployeeAccess(actor, employeeId, organizationId, client);
    await ensureEmployeeLifecycleEditable(client, employeeId, organizationId);
    await validateContractReferences(client, organizationId, input);
    await validateLifecycleDocument(client, organizationId, input.documentFileId, "contract", {
      employeeId,
    });
    const current = await client.query(
      `SELECT id,start_date::text AS start_date,end_date::text AS end_date
       FROM employment_contracts
       WHERE organization_id=$1 AND employee_id=$2 AND status IN ('draft','active')
       ORDER BY start_date DESC,id DESC LIMIT 1 FOR UPDATE`,
      [organizationId, employeeId],
    );
    if (current.rows[0]) {
      if (input.startDate <= current.rows[0].start_date)
        throw new ServiceError(
          "CONTRACT_DATE_INVALID",
          "Tanggal mulai kontrak baru harus setelah awal kontrak aktif saat ini.",
          409,
        );
      await client.query(
        `UPDATE employment_contracts
         SET status='renewed',
           end_date=CASE WHEN end_date IS NULL OR end_date>=$3::date
             THEN $3::date-1 ELSE end_date END
         WHERE id=$1 AND organization_id=$2`,
        [current.rows[0].id, organizationId, input.startDate],
      );
    }
    const overlap = await client.query(
      `SELECT id FROM employment_contracts WHERE organization_id=$1 AND employee_id=$2
        AND status IN ('draft','active') AND daterange(start_date,COALESCE(end_date,'infinity'::date),'[]')
        && daterange($3::date,COALESCE($4::date,'infinity'::date),'[]') FOR UPDATE`,
      [organizationId, employeeId, input.startDate, input.endDate],
    );
    if (overlap.rowCount)
      throw new ServiceError(
        "CONTRACT_OVERLAP",
        "Periode kontrak bertumpuk dengan kontrak aktif yang sudah ada.",
        409,
      );
    const id = await insertContract(client, organizationId, employeeId, input);
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "employment_contract.create",
      entityType: "employment_contract",
      entityId: id,
      afterData: { ...input, employeeId: String(employeeId) },
      requestId,
    });
    return getEmployeeHistory(employeeId, organizationId, client);
  });
}

/** Mengoreksi metadata kontrak dengan version check tanpa menghapus record historis. */
export async function correctEmployeeContract(
  employeeId,
  contractId,
  organizationId,
  input,
  actor,
  requestId,
) {
  return withTransaction(async (client) => {
    await ensureActorEmployeeAccess(actor, employeeId, organizationId, client);
    await ensureEmployeeLifecycleEditable(client, employeeId, organizationId);
    const before = await client.query(
      `SELECT * FROM employment_contracts
       WHERE id=$1 AND employee_id=$2 AND organization_id=$3 FOR UPDATE`,
      [contractId, employeeId, organizationId],
    );
    if (!before.rows[0]) throw new ServiceError("NOT_FOUND", "Kontrak tidak ditemukan.", 404);
    if (before.rows[0].status === "cancelled")
      throw new ServiceError(
        "CONTRACT_CANCELLED",
        "Kontrak yang telah dibatalkan tidak dapat diubah.",
        409,
      );
    await validateContractReferences(client, organizationId, input);
    await validateLifecycleDocument(client, organizationId, input.documentFileId, "contract", {
      employeeId,
    });
    const overlap = await client.query(
      `SELECT id FROM employment_contracts
       WHERE organization_id=$1 AND employee_id=$2 AND id<>$3 AND status<>'cancelled'
         AND daterange(start_date,COALESCE(end_date,'infinity'::date),'[]')
           && daterange($4::date,COALESCE($5::date,'infinity'::date),'[]')
       FOR UPDATE`,
      [organizationId, employeeId, contractId, input.startDate, input.endDate],
    );
    if (overlap.rowCount)
      throw new ServiceError(
        "CONTRACT_OVERLAP",
        "Periode koreksi bertumpuk dengan kontrak lain.",
        409,
      );
    const updated = await client.query(
      `UPDATE employment_contracts
       SET employment_type_id=$4,contract_no=$5,start_date=$6,end_date=$7,
         document_file_id=$8,notes=$9
       WHERE id=$1 AND employee_id=$2 AND organization_id=$3
         AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$10::timestamptz)
       RETURNING id`,
      [
        contractId,
        employeeId,
        organizationId,
        input.employmentTypeId,
        input.contractNo,
        input.startDate,
        input.endDate,
        input.documentFileId,
        input.notes,
        input.version,
      ],
    );
    if (!updated.rowCount)
      throw new ServiceError(
        "VERSION_CONFLICT",
        "Kontrak telah berubah. Muat ulang sebelum menyimpan koreksi.",
        409,
      );
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "employment_contract.correct",
      entityType: "employment_contract",
      entityId: contractId,
      beforeData: {
        employmentTypeId: before.rows[0].employment_type_id,
        contractNo: before.rows[0].contract_no,
        startDate: before.rows[0].start_date,
        endDate: before.rows[0].end_date,
        documentFileId: before.rows[0].document_file_id,
      },
      afterData: {
        employmentTypeId: input.employmentTypeId,
        contractNo: input.contractNo,
        startDate: input.startDate,
        endDate: input.endDate,
        documentFileId: input.documentFileId,
      },
      requestId,
    });
    return getEmployeeHistory(employeeId, organizationId, client);
  });
}

/** Membatalkan salah input secara logis agar histori dan audit tetap tersedia. */
export async function cancelEmployeeContract(
  employeeId,
  contractId,
  organizationId,
  input,
  actor,
  requestId,
) {
  return withTransaction(async (client) => {
    await ensureActorEmployeeAccess(actor, employeeId, organizationId, client);
    await ensureEmployeeLifecycleEditable(client, employeeId, organizationId);
    const before = await client.query(
      `SELECT * FROM employment_contracts
       WHERE id=$1 AND employee_id=$2 AND organization_id=$3 FOR UPDATE`,
      [contractId, employeeId, organizationId],
    );
    if (!before.rows[0]) throw new ServiceError("NOT_FOUND", "Kontrak tidak ditemukan.", 404);
    if (before.rows[0].status === "cancelled")
      throw new ServiceError("CONTRACT_CANCELLED", "Kontrak sudah dibatalkan.", 409);
    const cancelled = await client.query(
      `UPDATE employment_contracts
       SET status='cancelled',cancelled_at=now(),cancellation_reason=$4,cancelled_by_user_id=$5
       WHERE id=$1 AND employee_id=$2 AND organization_id=$3
         AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$6::timestamptz)
       RETURNING id`,
      [contractId, employeeId, organizationId, input.reason, actor.id, input.version],
    );
    if (!cancelled.rowCount)
      throw new ServiceError(
        "VERSION_CONFLICT",
        "Kontrak telah berubah. Muat ulang sebelum membatalkan.",
        409,
      );
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "employment_contract.cancel",
      entityType: "employment_contract",
      entityId: contractId,
      beforeData: { status: before.rows[0].status },
      afterData: { status: "cancelled", reason: input.reason },
      requestId,
    });
    return getEmployeeHistory(employeeId, organizationId, client);
  });
}

/** Mengakhiri pegawai, assignment aktif, kontrak aktif, dan akun self-service terkait. */
export async function terminateEmployee(id, organizationId, input, actor, requestId) {
  return withTransaction(async (client) => {
    await ensureActorEmployeeAccess(actor, id, organizationId, client);
    const before = await client.query(
      `SELECT id,user_id,employee_no,full_name,employment_status,joined_date
       FROM employees
       WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL
       FOR UPDATE`,
      [id, organizationId],
    );
    if (!before.rows[0]) throw new ServiceError("NOT_FOUND", "Pegawai tidak ditemukan.", 404);
    const dateResult = await client.query("SELECT current_date::text AS today");
    const joinedDate = before.rows[0].joined_date?.toISOString
      ? before.rows[0].joined_date.toISOString().slice(0, 10)
      : String(before.rows[0].joined_date);
    const policyError = validateEmployeeTermination({
      currentStatus: before.rows[0].employment_status,
      joinedDate,
      terminationDate: input.terminationDate,
      today: dateResult.rows[0].today,
    });
    if (policyError) throw new ServiceError(policyError.code, policyError.message, 409);
    const updated = await client.query(
      `UPDATE employees SET employment_status=$3,termination_date=$4,termination_reason=$5
        WHERE id=$1 AND organization_id=$2
        AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$6::timestamptz)
        RETURNING user_id`,
      [id, organizationId, input.status, input.terminationDate, input.reason, input.version],
    );
    if (!updated.rowCount)
      throw new ServiceError("VERSION_CONFLICT", "Data telah berubah. Muat ulang dahulu.", 409);
    await client.query(
      `UPDATE employee_assignments SET effective_until=GREATEST(effective_from,$3::date)
        WHERE organization_id=$1 AND employee_id=$2
          AND effective_from<=$3::date
          AND (effective_until IS NULL OR effective_until>$3::date)`,
      [organizationId, id, input.terminationDate],
    );
    await client.query(
      `UPDATE employment_contracts
       SET status='terminated',
         end_date=GREATEST(start_date,LEAST(COALESCE(end_date,$3::date),$3::date))
        WHERE organization_id=$1 AND employee_id=$2 AND status IN ('draft','active')`,
      [organizationId, id, input.terminationDate],
    );
    if (updated.rows[0].user_id)
      await client.query("UPDATE users SET is_active=false WHERE id=$1", [updated.rows[0].user_id]);
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "employee.terminate",
      entityType: "employee",
      entityId: id,
      beforeData: employeeAuditSnapshot(before.rows[0]),
      afterData: {
        previousEmploymentStatus: before.rows[0].employment_status,
        employmentStatus: input.status,
        terminationDate: input.terminationDate,
        terminationReason: input.reason,
        linkedAccountDeactivated: Boolean(updated.rows[0].user_id),
      },
      requestId,
    });
    return getEmployee(id, organizationId, client);
  });
}

/** Mengambil seluruh histori placement dan kontrak untuk timeline detail pegawai. */
export async function getEmployeeHistory(employeeId, organizationId, database = pool) {
  await getEmployee(employeeId, organizationId, database);
  const [assignments, contracts] = await Promise.all([
    database.query(
      `SELECT assignment.id::text,assignment.assignment_type,assignment.change_type,
        assignment.effective_from::text,assignment.effective_until::text,assignment.decree_no,
        assignment.notes,assignment.document_file_id::text,
        assignment.created_at::text AS created_at,assignment.updated_at::text AS updated_at,
        created_identity.display_name AS created_by_name,
        assignment_corrected.actor_name AS updated_by_name,
        assignment_corrected.occurred_at::text AS updated_audit_at,
        assignment_file.original_name AS document_name,
        assignment_file.mime_type AS document_mime_type,
        location.id::text AS location_id,location.name AS location_name,
        unit.id::text AS organization_unit_id,unit.name AS unit_name,
        position.id::text AS position_id,position.name AS position_name,
        supervisor.id::text AS supervisor_employee_id,supervisor.full_name AS supervisor_name
        FROM employee_assignments assignment
        JOIN locations location ON location.organization_id=assignment.organization_id AND location.id=assignment.location_id
        JOIN organization_units unit ON unit.organization_id=assignment.organization_id AND unit.id=assignment.organization_unit_id
        LEFT JOIN positions position ON position.organization_id=assignment.organization_id AND position.id=assignment.position_id
        LEFT JOIN employees supervisor ON supervisor.organization_id=assignment.organization_id AND supervisor.id=assignment.supervisor_employee_id
        LEFT JOIN stored_files assignment_file
          ON assignment_file.organization_id=assignment.organization_id
          AND assignment_file.id=assignment.document_file_id
          AND assignment_file.deleted_at IS NULL
        LEFT JOIN v_user_identity created_identity
          ON created_identity.user_id=assignment.created_by_user_id
        LEFT JOIN LATERAL (
          SELECT identity.display_name AS actor_name,audit.occurred_at
          FROM audit_logs audit
          LEFT JOIN v_user_identity identity ON identity.user_id=audit.actor_user_id
          WHERE audit.organization_id=assignment.organization_id
            AND audit.entity_type='employee_assignment'
            AND audit.entity_id=assignment.id::text
            AND audit.action='employee_assignment.correct'
          ORDER BY audit.occurred_at DESC,audit.id DESC LIMIT 1
        ) assignment_corrected ON true
        WHERE assignment.organization_id=$1 AND assignment.employee_id=$2
        ORDER BY assignment.effective_from DESC,assignment.id DESC`,
      [organizationId, employeeId],
    ),
    database.query(
      `SELECT contract.id::text,contract.contract_no,contract.start_date::text,
        contract.end_date::text,contract.status,contract.notes,contract.document_file_id::text,
        contract.cancelled_at::text AS cancelled_at,contract.cancellation_reason,
        contract.created_at::text AS created_at,contract.updated_at::text AS updated_at,
        COALESCE(contract_created.actor_name,employee_created.actor_name) AS created_by_name,
        COALESCE(contract_created.occurred_at,employee_created.occurred_at,contract.created_at)::text AS created_audit_at,
        contract_corrected.actor_name AS updated_by_name,
        contract_corrected.occurred_at::text AS updated_audit_at,
        cancelled_identity.display_name AS cancelled_by_name,
        contract_file.original_name AS document_name,
        contract_file.mime_type AS document_mime_type,
        type.id::text AS employment_type_id,type.code AS employment_type_code,type.name AS employment_type_name
        FROM employment_contracts contract JOIN employment_types type
          ON type.organization_id=contract.organization_id AND type.id=contract.employment_type_id
        LEFT JOIN stored_files contract_file
          ON contract_file.organization_id=contract.organization_id
          AND contract_file.id=contract.document_file_id
          AND contract_file.deleted_at IS NULL
        LEFT JOIN v_user_identity cancelled_identity
          ON cancelled_identity.user_id=contract.cancelled_by_user_id
        LEFT JOIN LATERAL (
          SELECT identity.display_name AS actor_name,audit.occurred_at
          FROM audit_logs audit
          LEFT JOIN v_user_identity identity ON identity.user_id=audit.actor_user_id
          WHERE audit.organization_id=contract.organization_id
            AND audit.entity_type='employment_contract'
            AND audit.entity_id=contract.id::text
            AND audit.action='employment_contract.create'
          ORDER BY audit.occurred_at ASC,audit.id ASC LIMIT 1
        ) contract_created ON true
        LEFT JOIN LATERAL (
          SELECT identity.display_name AS actor_name,audit.occurred_at
          FROM audit_logs audit
          LEFT JOIN v_user_identity identity ON identity.user_id=audit.actor_user_id
          WHERE audit.organization_id=contract.organization_id
            AND audit.entity_type='employee'
            AND audit.entity_id=contract.employee_id::text
            AND audit.action='employee.create'
          ORDER BY audit.occurred_at ASC,audit.id ASC LIMIT 1
        ) employee_created ON true
        LEFT JOIN LATERAL (
          SELECT identity.display_name AS actor_name,audit.occurred_at
          FROM audit_logs audit
          LEFT JOIN v_user_identity identity ON identity.user_id=audit.actor_user_id
          WHERE audit.organization_id=contract.organization_id
            AND audit.entity_type='employment_contract'
            AND audit.entity_id=contract.id::text
            AND audit.action='employment_contract.correct'
          ORDER BY audit.occurred_at DESC,audit.id DESC LIMIT 1
        ) contract_corrected ON true
        WHERE contract.organization_id=$1 AND contract.employee_id=$2
        ORDER BY contract.start_date DESC,contract.id DESC`,
      [organizationId, employeeId],
    ),
  ]);
  return { assignments: assignments.rows, contracts: contracts.rows };
}

/** Menyediakan opsi pegawai aktif untuk atasan dan penautan akun. */
export async function getEmployeeOptions(organizationId, excludeId = null, actor = null) {
  const scopedLocationIds = actor ? await getActorLocationScope(actor) : null;
  const result = await pool.query(
    `SELECT id::text,employee_no,full_name FROM employees
      WHERE organization_id=$1 AND deleted_at IS NULL
        AND employment_status IN ('active','probation','leave') AND ($2::bigint IS NULL OR id<>$2)
        AND ($3::bigint[] IS NULL OR EXISTS(
          SELECT 1 FROM employee_assignments assignment
          WHERE assignment.organization_id=employees.organization_id
            AND assignment.employee_id=employees.id AND assignment.assignment_type='primary'
            AND assignment.effective_from<=current_date
            AND (assignment.effective_until IS NULL OR assignment.effective_until>=current_date)
            AND assignment.location_id=ANY($3::bigint[])))
      ORDER BY full_name LIMIT 500`,
    [organizationId, excludeId, scopedLocationIds],
  );
  return result.rows;
}

/** Memuat master aktif dalam satu request agar form pegawai tidak menghasilkan waterfall API. */
export async function getEmployeeReferenceOptions(organizationId, actor) {
  const scopedLocationIds = await getActorLocationScope(actor);
  const [locations, units, positions, employmentTypes, employees] = await Promise.all([
    pool.query(
      `SELECT id::text,code,name FROM locations WHERE organization_id=$1 AND is_active=true
        AND operational_from<=current_date
        AND (operational_until IS NULL OR operational_until>=current_date)
        AND ($2::bigint[] IS NULL OR id=ANY($2::bigint[])) ORDER BY name`,
      [organizationId, scopedLocationIds],
    ),
    pool.query(
      `SELECT unit.id::text,unit.code,unit.name,
        COALESCE(json_agg(mapping.location_id::text ORDER BY mapping.location_id)
          FILTER (WHERE mapping.location_id IS NOT NULL),'[]'::json) AS location_ids
        FROM organization_units unit LEFT JOIN organization_unit_locations mapping
          ON mapping.organization_id=unit.organization_id AND mapping.organization_unit_id=unit.id
          AND mapping.active_from<=current_date
          AND (mapping.active_until IS NULL OR mapping.active_until>=current_date)
        WHERE unit.organization_id=$1 AND unit.is_active=true GROUP BY unit.id ORDER BY unit.name`,
      [organizationId],
    ),
    pool.query(
      "SELECT id::text,code,name,grade FROM positions WHERE organization_id=$1 AND is_active=true ORDER BY level_no NULLS LAST,name",
      [organizationId],
    ),
    pool.query(
      "SELECT id::text,code,name,requires_end_date FROM employment_types WHERE organization_id=$1 AND is_active=true ORDER BY name",
      [organizationId],
    ),
    pool.query(
      `SELECT id::text,employee_no,full_name FROM employees WHERE organization_id=$1
        AND deleted_at IS NULL AND employment_status IN ('active','probation','leave')
        ORDER BY full_name LIMIT 500`,
      [organizationId],
    ),
  ]);
  return {
    locations: locations.rows,
    organizationUnits: units.rows,
    positions: positions.rows,
    employmentTypes: employmentTypes.rows,
    employees: employees.rows,
  };
}

async function upsertEmployeeContact(client, organizationId, employeeId, contact) {
  await client.query(
    `INSERT INTO employee_contacts
      (organization_id,employee_id,personal_email,whatsapp,ktp_address,
       domicile_address,village,district,city,province,postal_code)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (employee_id) DO UPDATE SET personal_email=EXCLUDED.personal_email,
        whatsapp=EXCLUDED.whatsapp,
        ktp_address=EXCLUDED.ktp_address,domicile_address=EXCLUDED.domicile_address,
        village=EXCLUDED.village,district=EXCLUDED.district,city=EXCLUDED.city,
        province=EXCLUDED.province,postal_code=EXCLUDED.postal_code`,
    [
      organizationId,
      employeeId,
      contact.personalEmail || null,
      contact.whatsapp,
      contact.ktpAddress,
      contact.domicileAddress,
      contact.village,
      contact.district,
      contact.city,
      contact.province,
      contact.postalCode,
    ],
  );
}

async function insertAssignment(client, organizationId, employeeId, input, actorId) {
  const result = await client.query(
    `INSERT INTO employee_assignments
      (organization_id,employee_id,location_id,organization_unit_id,position_id,
       supervisor_employee_id,assignment_type,change_type,effective_from,decree_no,document_file_id,
       notes,created_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [
      organizationId,
      employeeId,
      input.locationId,
      input.organizationUnitId,
      input.positionId,
      input.supervisorEmployeeId,
      input.assignmentType,
      input.changeType,
      input.effectiveFrom,
      input.decreeNo,
      input.documentFileId,
      input.notes,
      actorId,
    ],
  );
  return result.rows[0].id;
}

async function insertContract(client, organizationId, employeeId, input) {
  const result = await client.query(
    `INSERT INTO employment_contracts
      (organization_id,employee_id,employment_type_id,contract_no,start_date,end_date,status,
       document_file_id,notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [
      organizationId,
      employeeId,
      input.employmentTypeId,
      input.contractNo,
      input.startDate,
      input.endDate,
      input.status,
      input.documentFileId,
      input.notes,
    ],
  );
  return result.rows[0].id;
}
