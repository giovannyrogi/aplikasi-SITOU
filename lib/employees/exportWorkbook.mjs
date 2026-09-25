import ExcelJS from "exceljs";

const EMPTY_DATA = "Belum ada data";
const FILE_MISSING = "Belum ada";
const NOT_APPLICABLE = "Tidak berlaku";

const documentSlots = Object.freeze([
  ["pas_foto", "Pas Foto"],
  ["ktp", "KTP"],
  ["kk", "KK"],
  ["npwp", "NPWP"],
  ["bpjs_health", "BPJS Kesehatan"],
  ["bpjs_employment", "BPJS Ketenagakerjaan"],
  ["kontrak", "Kontrak"],
  ["sk_penempatan", "SK Penempatan"],
  ["ijazah", "Ijazah"],
  ["sertifikasi", "Sertifikasi"],
  ["identity_other", "Identitas Lain"],
]);

const labels = Object.freeze({
  gender: {
    male: "Laki-laki",
    female: "Perempuan",
    other: "Lainnya",
    undisclosed: "Tidak diungkapkan",
  },
  marital: {
    single: "Belum Menikah",
    married: "Menikah",
    divorced: "Cerai Hidup",
    widowed: "Cerai Mati",
  },
  employment: {
    draft: "Draft",
    active: "Aktif",
    probation: "Masa percobaan",
    suspended: "Ditangguhkan",
    terminated: "Diberhentikan",
    retired: "Pensiun",
    deceased: "Meninggal dunia",
  },
  contract: {
    draft: "Draft",
    active: "Aktif",
    expired: "Selesai",
    terminated: "Diakhiri",
    renewed: "Diperbarui",
    cancelled: "Dibatalkan",
  },
  assignment: {
    primary: "Utama",
    acting: "Pelaksana tugas",
    temporary: "Sementara",
    additional: "Tambahan",
  },
  change: {
    initial: "Penempatan awal",
    rotation: "Rolling",
    transfer: "Mutasi",
    promotion: "Promosi",
    demotion: "Demosi",
    acting: "Pelaksana tugas",
    correction: "Koreksi",
  },
  relationship: {
    wife: "Istri",
    husband: "Suami",
    child: "Anak",
    father: "Ayah",
    mother: "Ibu",
    sibling: "Saudara kandung",
    father_in_law: "Ayah mertua",
    mother_in_law: "Ibu mertua",
    grandfather: "Kakek",
    grandmother: "Nenek",
    grandchild: "Cucu",
    guardian: "Wali",
    other: "Lainnya",
  },
  identifier: {
    ktp: "KTP",
    family_card: "Kartu Keluarga",
    bpjs_health: "BPJS Kesehatan",
    bpjs_employment: "BPJS Ketenagakerjaan",
    tax_npwp: "NPWP",
    passport: "Paspor",
    other: "Identitas lainnya",
  },
});

const value = (input, fallback = EMPTY_DATA) =>
  input === null || input === undefined || String(input).trim() === "" ? fallback : String(input);
const yesNo = (input) =>
  input === null || input === undefined ? EMPTY_DATA : input ? "Ya" : "Tidak";
const fileStatus = (count) => (Number(count) > 0 ? `Ada (${Number(count)} file)` : FILE_MISSING);
const singleFileStatus = (available) => (available ? "Ada" : FILE_MISSING);
const mapLabel = (group, input) => value(labels[group]?.[input] || input);

function groupedByEmployee(rows) {
  const grouped = new Map();
  for (const row of rows || []) {
    const key = String(row.employee_id);
    grouped.set(key, [...(grouped.get(key) || []), row]);
  }
  return grouped;
}

function documentIndex(rows) {
  const index = new Map();
  for (const row of rows || [])
    index.set(`${row.employee_id}:${row.document_kind}`, {
      count: Number(row.file_count || 0),
      latest: row.latest_uploaded_at || null,
    });
  return index;
}

function identifierIndex(rows) {
  const index = new Map();
  for (const row of rows || []) {
    const key = String(row.employee_id);
    const perEmployee = index.get(key) || new Map();
    if (!perEmployee.has(row.identifier_type)) perEmployee.set(row.identifier_type, row);
    index.set(key, perEmployee);
  }
  return index;
}

function addDataSheet(workbook, name, columns, rows) {
  const sheet = workbook.addWorksheet(name);
  const header = sheet.addRow(columns.map((column) => column.label));
  header.height = 30;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFED0A22" } };
  header.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FFCC0018" } },
      left: { style: "thin", color: { argb: "FFCC0018" } },
      bottom: { style: "thin", color: { argb: "FFCC0018" } },
      right: { style: "thin", color: { argb: "FFCC0018" } },
    };
  });
  for (const source of rows) {
    const row = sheet.addRow(columns.map((column) => value(source[column.key])));
    row.alignment = { vertical: "top", wrapText: true };
    row.eachCell((cell) => {
      cell.numFmt = "@";
      cell.border = { bottom: { style: "hair", color: { argb: "FFE2E8F0" } } };
      if (row.number % 2 === 0)
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF5F6" } };
    });
  }
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 3 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
  columns.forEach((column, index) => {
    const observed = rows
      .slice(0, 500)
      .reduce(
        (maximum, row) => Math.max(maximum, String(value(row[column.key])).length),
        column.label.length,
      );
    sheet.getColumn(index + 1).width = Math.max(
      column.width || 12,
      Math.min(column.maxWidth || 38, observed + 2),
    );
    sheet.getColumn(index + 1).numFmt = "@";
  });
  return sheet;
}

function baseRow(number, employee, status = "Tersedia") {
  return {
    no: number,
    employee_no: employee.employee_no,
    full_name: employee.full_name,
    data_status: status,
  };
}

function buildRepeatedRows(employees, detailRows, mapper) {
  const grouped = groupedByEmployee(detailRows);
  const rows = [];
  for (const employee of employees) {
    const employeeRows = grouped.get(String(employee.id)) || [];
    if (!employeeRows.length) {
      rows.push({ ...baseRow(rows.length + 1, employee, EMPTY_DATA) });
      continue;
    }
    for (const detail of employeeRows)
      rows.push({ ...baseRow(rows.length + 1, employee), ...mapper(detail, employee) });
  }
  return rows;
}

const commonColumns = [
  { key: "no", label: "No", width: 7, maxWidth: 8 },
  { key: "employee_no", label: "NIP", width: 16, maxWidth: 24 },
  { key: "full_name", label: "Nama Pegawai", width: 28, maxWidth: 38 },
];
const detailColumns = [
  ...commonColumns,
  { key: "data_status", label: "Status Data", width: 16, maxWidth: 18 },
];

function filterDescriptions(report) {
  const { filters, filterLabels } = report;
  const employmentStatuses = { all: "Semua status", ...labels.employment };
  const completeness = {
    all: "Semua kelengkapan",
    complete: "Lengkap",
    incomplete: "Belum lengkap",
  };
  const sanctions = {
    all: "Semua",
    with_sanction: "Dengan sanksi aktif",
    without_sanction: "Tanpa sanksi aktif",
  };
  return [
    ["Pencarian", filters.search || "Semua pegawai"],
    ["Lokasi", filterLabels.locationId || "Semua lokasi"],
    ["Divisi & Unit", filterLabels.organizationUnitId || "Semua Divisi & Unit"],
    ["Jabatan", filterLabels.positionId || "Semua jabatan"],
    [
      "Jenis kepegawaian",
      filters.employmentTypeId === "without_active_contract"
        ? "Tanpa kontrak aktif"
        : filterLabels.employmentTypeId || "Semua jenis",
    ],
    [
      "Status pegawai",
      employmentStatuses[filters.employmentStatus] || value(filters.employmentStatus),
    ],
    ["Kelengkapan data", completeness[filters.completeness] || value(filters.completeness)],
    ["Ditambahkan oleh", filterLabels.createdByUserId || "Semua akun"],
    ["Sanksi", sanctions[filters.sanction] || value(filters.sanction)],
  ];
}

/** Workbook hanya memuat nilai literal dan status file, tanpa ID/path/URL file privat. */
export async function buildEmployeeExportWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SITOU";
  workbook.created = new Date(report.generatedAt);
  const documents = documentIndex(report.documents);
  const identifiers = identifierIndex(report.sections.identifiers);
  const identifierRows = groupedByEmployee(report.sections.identifiers);

  const guide = workbook.addWorksheet("Petunjuk");
  guide.addRow(["Export Data Pegawai SITOU"]);
  guide.addRow(["Organisasi", report.organization.name]);
  guide.addRow(["Tanggal snapshot", report.asOf]);
  guide.addRow(["Waktu export (UTC)", report.generatedAt]);
  guide.addRow(["Jumlah pegawai", String(report.employees.length)]);
  guide.addRow(["Jumlah baris detail", String(report.detailRowCount)]);
  guide.addRow([]);
  guide.addRow(["Filter aktif"]);
  for (const item of filterDescriptions(report)) guide.addRow(item);
  guide.addRow([]);
  guide.addRow(["Cara membaca"]);
  guide.addRow([
    "Penghubung antar-sheet",
    "Gunakan NIP sebagai kunci utama. Nama Pegawai disertakan untuk memudahkan pembacaan.",
  ]);
  guide.addRow([
    "Lengkap / Belum lengkap",
    "Status kelengkapan data inti: NIK, pas foto, kontak, dan penempatan utama aktif.",
  ]);
  guide.addRow([
    "Ada / Belum ada",
    "Status keberadaan gambar atau dokumen. File tidak disertakan di workbook.",
  ]);
  guide.addRow(["Belum ada data", "Field atau kelompok data belum pernah diisi."]);
  guide.addRow(["Tidak berlaku", "Field tersebut tidak berlaku untuk jenis data terkait."]);
  guide.addRow([]);
  guide.addRow([
    "Peringatan",
    "Workbook ini mengandung data pribadi. Simpan dan bagikan hanya kepada pihak yang berwenang.",
  ]);
  guide.getColumn(1).width = 30;
  guide.getColumn(2).width = 100;
  guide.getColumn(2).alignment = { wrapText: true, vertical: "top" };
  guide.getRow(1).font = { bold: true, size: 16, color: { argb: "FFED0A22" } };
  guide.getRow(8).font = { bold: true };
  guide.getRow(19).font = { bold: true };
  guide.views = [{ state: "frozen", ySplit: 1 }];

  const summaryRows = report.employees.map((employee, index) => {
    const employeeIdentifiers = identifiers.get(String(employee.id)) || new Map();
    const docCounts = Object.fromEntries(
      documentSlots.map(([kind]) => [kind, documents.get(`${employee.id}:${kind}`)?.count || 0]),
    );
    const missingCore = [
      !employee.national_id && "NIK",
      !employee.profile_photo_file_id && "Pas foto",
      !employee.has_contact_data && "Data kontak",
      !employee.assignment_id && "Penempatan utama aktif",
    ].filter(Boolean);
    const missingDocuments = documentSlots
      .filter(([kind]) => !docCounts[kind])
      .map(([, label]) => label);
    const identifier = (kind) => employeeIdentifiers.get(kind)?.identifier_value;
    return {
      ...baseRow(index + 1, employee),
      national_id: value(employee.national_id),
      family_card: value(identifier("family_card")),
      tax_npwp: value(identifier("tax_npwp")),
      bpjs_health: value(identifier("bpjs_health")),
      bpjs_employment: value(identifier("bpjs_employment")),
      passport: value(identifier("passport")),
      other_identifier_count: String(
        (identifierRows.get(String(employee.id)) || []).filter(
          (item) => item.identifier_type === "other",
        ).length,
      ),
      preferred_name: value(employee.preferred_name),
      birth_place: value(employee.birth_place),
      birth_date: value(employee.birth_date),
      gender: mapLabel("gender", employee.gender),
      religion: value(employee.religion),
      marital_status: mapLabel("marital", employee.marital_status),
      blood_type: value(employee.blood_type),
      nationality: value(employee.nationality),
      personal_email: value(employee.personal_email),
      whatsapp: value(employee.whatsapp),
      ktp_address: value(employee.ktp_address),
      domicile_address: value(employee.domicile_address),
      joined_date: value(employee.joined_date),
      employment_status: mapLabel("employment", employee.employment_status),
      termination_date: employee.termination_date
        ? value(employee.termination_date)
        : NOT_APPLICABLE,
      termination_reason: employee.termination_reason
        ? value(employee.termination_reason)
        : NOT_APPLICABLE,
      location_name: value(employee.location_name),
      unit_name: value(employee.unit_name),
      position_name: value(employee.position_name),
      supervisor_name: value(employee.supervisor_name),
      assignment_effective_from: value(employee.assignment_effective_from),
      employment_type_name: value(employee.employment_type_name),
      contract_no: value(employee.contract_no),
      contract_start_date: value(employee.contract_start_date),
      contract_end_date:
        employee.contract_id && !employee.contract_end_date
          ? NOT_APPLICABLE
          : value(employee.contract_end_date),
      contract_status: employee.contract_id
        ? mapLabel("contract", employee.contract_status)
        : EMPTY_DATA,
      account_status:
        { active: "Aktif", inactive: "Nonaktif", not_linked: "Belum terhubung" }[
          employee.account_status
        ] || EMPTY_DATA,
      core_completeness: missingCore.length ? "Belum lengkap" : "Lengkap",
      missing_core: missingCore.length ? missingCore.join(", ") : NOT_APPLICABLE,
      available_document_types: String(documentSlots.length - missingDocuments.length),
      missing_documents: missingDocuments.length ? missingDocuments.join(", ") : NOT_APPLICABLE,
    };
  });
  addDataSheet(
    workbook,
    "Ringkasan",
    [
      ...commonColumns,
      ["national_id", "NIK"],
      ["family_card", "Nomor KK"],
      ["tax_npwp", "NPWP"],
      ["bpjs_health", "BPJS Kesehatan"],
      ["bpjs_employment", "BPJS Ketenagakerjaan"],
      ["passport", "Paspor"],
      ["other_identifier_count", "Jumlah Identitas Lain"],
      ["preferred_name", "Nama Panggilan"],
      ["birth_place", "Tempat Lahir"],
      ["birth_date", "Tanggal Lahir"],
      ["gender", "Jenis Kelamin"],
      ["religion", "Agama"],
      ["marital_status", "Status Perkawinan"],
      ["blood_type", "Golongan Darah"],
      ["nationality", "Kewarganegaraan"],
      ["personal_email", "Email Pribadi"],
      ["whatsapp", "WhatsApp"],
      ["ktp_address", "Alamat KTP"],
      ["domicile_address", "Alamat Domisili"],
      ["joined_date", "Tanggal Bergabung"],
      ["employment_status", "Status Pegawai"],
      ["termination_date", "Tanggal Akhir Hubungan Kerja"],
      ["termination_reason", "Alasan Akhir Hubungan Kerja"],
      ["location_name", "Lokasi Aktif"],
      ["unit_name", "Divisi & Unit Aktif"],
      ["position_name", "Jabatan Aktif"],
      ["supervisor_name", "Atasan Aktif"],
      ["assignment_effective_from", "TMT Penempatan Aktif"],
      ["employment_type_name", "Jenis Kepegawaian Aktif"],
      ["contract_no", "Nomor Kontrak Aktif"],
      ["contract_start_date", "Mulai Kontrak Aktif"],
      ["contract_end_date", "Akhir Kontrak Aktif"],
      ["contract_status", "Status Kontrak"],
      ["account_status", "Status Akun"],
      ["core_completeness", "Kelengkapan Data Inti"],
      ["missing_core", "Data Inti Belum Tersedia"],
      ["available_document_types", "Jumlah Jenis Dokumen Tersedia"],
      ["missing_documents", "Dokumen Belum Tersedia"],
    ].map((column) =>
      Array.isArray(column) ? { key: column[0], label: column[1], width: 18 } : column,
    ),
    summaryRows,
  );

  const documentRows = report.employees.map((employee, index) => {
    const counts = Object.fromEntries(
      documentSlots.map(([kind]) => [kind, documents.get(`${employee.id}:${kind}`)?.count || 0]),
    );
    const latest = documentSlots
      .map(([kind]) => documents.get(`${employee.id}:${kind}`)?.latest)
      .filter(Boolean)
      .sort()
      .at(-1);
    return {
      ...baseRow(index + 1, employee),
      ...Object.fromEntries(documentSlots.map(([kind]) => [kind, fileStatus(counts[kind])])),
      available_count: String(documentSlots.filter(([kind]) => counts[kind] > 0).length),
      latest_updated_at: value(latest),
    };
  });
  addDataSheet(
    workbook,
    "Kelengkapan_Dokumen",
    [
      ...commonColumns,
      ...documentSlots.map(([key, label]) => ({ key, label, width: 18 })),
      { key: "available_count", label: "Jumlah Jenis Tersedia", width: 18 },
      { key: "latest_updated_at", label: "Pembaruan Dokumen Terakhir", width: 25 },
    ],
    documentRows,
  );

  const contactRows = report.employees.map((employee, index) => ({
    ...baseRow(index + 1, employee, employee.has_contact_data ? "Tersedia" : EMPTY_DATA),
    personal_email: value(employee.personal_email),
    whatsapp: value(employee.whatsapp),
    ktp_address: value(employee.ktp_address),
    domicile_address: value(employee.domicile_address),
    village: value(employee.village),
    district: value(employee.district),
    city: value(employee.city),
    province: value(employee.province),
    postal_code: value(employee.postal_code),
  }));
  addDataSheet(
    workbook,
    "Kontak",
    [
      ...detailColumns,
      ["personal_email", "Email Pribadi"],
      ["whatsapp", "WhatsApp"],
      ["ktp_address", "Alamat KTP"],
      ["domicile_address", "Alamat Domisili"],
      ["village", "Kelurahan/Desa"],
      ["district", "Kecamatan"],
      ["city", "Kota/Kabupaten"],
      ["province", "Provinsi"],
      ["postal_code", "Kode Pos"],
    ].map((column) =>
      Array.isArray(column) ? { key: column[0], label: column[1], width: 18 } : column,
    ),
    contactRows,
  );

  const identityRows = [];
  for (const employee of report.employees) {
    const ktpDocument = documents.get(`${employee.id}:ktp`);
    identityRows.push({
      ...baseRow(identityRows.length + 1, employee),
      identifier_type: "KTP",
      identifier_label: "KTP",
      identifier_value: value(employee.national_id),
      issued_at: NOT_APPLICABLE,
      expires_at: NOT_APPLICABLE,
      is_verified: EMPTY_DATA,
      file_status: fileStatus(ktpDocument?.count || 0),
    });
    for (const identifier of identifierRows.get(String(employee.id)) || [])
      identityRows.push({
        ...baseRow(identityRows.length + 1, employee),
        identifier_type: mapLabel("identifier", identifier.identifier_type),
        identifier_label: value(
          identifier.identifier_label,
          identifier.identifier_type === "other" ? EMPTY_DATA : NOT_APPLICABLE,
        ),
        identifier_value: value(identifier.identifier_value),
        issued_at: value(identifier.issued_at),
        expires_at: ["family_card"].includes(identifier.identifier_type)
          ? NOT_APPLICABLE
          : value(identifier.expires_at),
        is_verified: yesNo(identifier.is_verified),
        file_status: singleFileStatus(identifier.has_document),
      });
  }
  addDataSheet(
    workbook,
    "Identitas",
    [
      ...detailColumns,
      ["identifier_type", "Jenis Identitas"],
      ["identifier_label", "Label"],
      ["identifier_value", "Nomor Identitas"],
      ["issued_at", "Tanggal Terbit"],
      ["expires_at", "Tanggal Kedaluwarsa"],
      ["is_verified", "Terverifikasi"],
      ["file_status", "Status File"],
    ].map((column) =>
      Array.isArray(column) ? { key: column[0], label: column[1], width: 18 } : column,
    ),
    identityRows,
  );

  const repeatedDefinitions = [
    [
      "Rekening",
      report.sections.bankAccounts,
      [
        ["bank_name", "Bank"],
        ["account_number", "Nomor Rekening"],
        ["account_holder", "Nama Pemilik"],
        ["is_primary", "Rekening Utama"],
        ["verified_at", "Waktu Verifikasi"],
      ],
      (row) => ({
        ...row,
        is_primary: yesNo(row.is_primary),
        verified_at: row.verified_at ? value(row.verified_at) : "Belum diverifikasi",
      }),
    ],
    [
      "Keluarga",
      report.sections.dependents,
      [
        ["relationship", "Hubungan"],
        ["member_name", "Nama Anggota Keluarga"],
        ["birth_date", "Tanggal Lahir"],
        ["national_id", "NIK"],
        ["phone", "Telepon"],
        ["is_dependent", "Termasuk Tanggungan"],
        ["is_emergency_contact", "Kontak Darurat"],
        ["notes", "Catatan"],
      ],
      (row) => ({
        ...row,
        relationship: mapLabel("relationship", row.relationship),
        member_name: value(row.full_name),
        is_dependent: yesNo(row.is_dependent),
        is_emergency_contact: yesNo(row.is_emergency_contact),
      }),
    ],
    [
      "Kontak_Darurat",
      report.sections.emergencyContacts,
      [
        ["contact_name", "Nama Kontak"],
        ["relationship", "Hubungan"],
        ["phone", "Nomor Kontak"],
        ["address", "Alamat"],
        ["is_primary", "Kontak Utama"],
      ],
      (row) => ({ ...row, contact_name: value(row.full_name), is_primary: yesNo(row.is_primary) }),
    ],
    [
      "Akun_Sosial",
      report.sections.socialAccounts,
      [
        ["platform", "Platform"],
        ["handle_or_url", "Username atau URL"],
      ],
      (row) => row,
    ],
    [
      "Pendidikan",
      report.sections.educations,
      [
        ["education_level", "Jenjang"],
        ["institution", "Institusi"],
        ["field_of_study", "Bidang Studi"],
        ["graduation_year", "Tahun Lulus"],
        ["is_highest", "Pendidikan Tertinggi"],
        ["certificate_status", "Status Ijazah"],
      ],
      (row) => ({
        ...row,
        is_highest: yesNo(row.is_highest),
        certificate_status: singleFileStatus(row.has_certificate),
      }),
    ],
    [
      "Keahlian",
      report.sections.skills,
      [
        ["skill_name", "Nama Keahlian"],
        ["proficiency_level", "Tingkat Kemampuan"],
        ["notes", "Catatan"],
      ],
      (row) => row,
    ],
    [
      "Sertifikasi",
      report.sections.certifications,
      [
        ["certification_name", "Nama Sertifikasi"],
        ["issuer", "Penerbit"],
        ["credential_no", "Nomor Kredensial"],
        ["issued_at", "Tanggal Terbit"],
        ["expires_at", "Tanggal Kedaluwarsa"],
        ["certificate_status", "Status Sertifikat"],
      ],
      (row) => ({ ...row, certificate_status: singleFileStatus(row.has_certificate) }),
    ],
    [
      "Kontrak_Histori",
      report.sections.contracts,
      [
        ["employment_type_name", "Jenis Kepegawaian"],
        ["employment_type_code", "Kode Jenis"],
        ["contract_no", "Nomor Kontrak"],
        ["start_date", "Tanggal Mulai"],
        ["end_date", "Tanggal Akhir"],
        ["contract_status", "Status Kontrak"],
        ["notes", "Catatan"],
        ["document_status", "Status Dokumen"],
        ["created_at", "Waktu Dicatat"],
        ["corrected_by_name", "Dikoreksi Oleh"],
        ["corrected_at", "Waktu Koreksi"],
        ["cancellation_reason", "Alasan Pembatalan"],
        ["cancelled_by_name", "Dibatalkan Oleh"],
        ["cancelled_at", "Waktu Pembatalan"],
      ],
      (row) => ({
        ...row,
        end_date: row.end_date ? value(row.end_date) : NOT_APPLICABLE,
        contract_status: mapLabel("contract", row.status),
        document_status: singleFileStatus(row.has_document),
        corrected_by_name: row.corrected_at ? value(row.corrected_by_name) : NOT_APPLICABLE,
        corrected_at: row.corrected_at ? value(row.corrected_at) : NOT_APPLICABLE,
        cancellation_reason:
          row.status === "cancelled" ? value(row.cancellation_reason) : NOT_APPLICABLE,
        cancelled_by_name:
          row.status === "cancelled" ? value(row.cancelled_by_name) : NOT_APPLICABLE,
        cancelled_at: row.status === "cancelled" ? value(row.cancelled_at) : NOT_APPLICABLE,
      }),
    ],
    [
      "Penempatan_Histori",
      report.sections.assignments,
      [
        ["location_name", "Lokasi"],
        ["unit_name", "Divisi & Unit"],
        ["position_name", "Jabatan"],
        ["supervisor_name", "Atasan"],
        ["assignment_type_label", "Jenis Penugasan"],
        ["change_type_label", "Jenis Perubahan"],
        ["effective_from", "Tanggal Mulai"],
        ["effective_until", "Tanggal Akhir"],
        ["decree_no", "Nomor SK"],
        ["notes", "Catatan"],
        ["document_status", "Status Dokumen"],
        ["created_at", "Waktu Dicatat"],
        ["corrected_by_name", "Dikoreksi Oleh"],
        ["corrected_at", "Waktu Koreksi"],
      ],
      (row) => ({
        ...row,
        assignment_type_label: mapLabel("assignment", row.assignment_type),
        change_type_label: mapLabel("change", row.change_type),
        effective_until: row.effective_until ? value(row.effective_until) : "Masih berlaku",
        document_status: singleFileStatus(row.has_document),
        corrected_by_name: row.corrected_at ? value(row.corrected_by_name) : NOT_APPLICABLE,
        corrected_at: row.corrected_at ? value(row.corrected_at) : NOT_APPLICABLE,
      }),
    ],
  ];

  for (const [name, source, columns, mapper] of repeatedDefinitions) {
    const rows = buildRepeatedRows(report.employees, source, mapper);
    addDataSheet(
      workbook,
      name,
      [...detailColumns, ...columns.map(([key, label]) => ({ key, label, width: 18 }))],
      rows,
    );
  }

  return workbook.xlsx.writeBuffer();
}
