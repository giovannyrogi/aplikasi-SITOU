import ExcelJS from "exceljs";

const EMPTY_DATA = "Belum ada data";
const FILE_MISSING = "Belum ada";
const NOT_APPLICABLE = "Tidak berlaku";

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

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
});

const value = (input, fallback = EMPTY_DATA) =>
  input === null || input === undefined || String(input).trim() === "" ? fallback : String(input);
const yesNo = (input) =>
  input === null || input === undefined ? EMPTY_DATA : input ? "Ya" : "Tidak";
const fileStatus = (count) => (Number(count) > 0 ? `Ada (${Number(count)} file)` : FILE_MISSING);
const mapLabel = (group, input) => value(labels[group]?.[input] || input);

function formatDate(input) {
  if (!input) return EMPTY_DATA;
  const match = String(input).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value(input);
  return `${Number(match[3])} ${MONTHS_ID[Number(match[2]) - 1]} ${match[1]}`;
}

function formatDateTime(input, timeZone = "Asia/Makassar") {
  if (!input) return EMPTY_DATA;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return value(input);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

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
  const sheet = workbook.addWorksheet(name, { properties: { tabColor: { argb: "FFED0A22" } } });
  sheet.properties.defaultRowHeight = 22;
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  const header = sheet.addRow(columns.map((column) => column.label));
  header.height = 34;
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
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
    const estimatedLines = columns.reduce((maximum, column) => {
      const width = column.width || 18;
      return Math.max(maximum, Math.ceil(String(value(source[column.key])).length / width));
    }, 1);
    row.height = Math.max(24, Math.min(72, estimatedLines * 16));
    row.eachCell((cell, columnNumber) => {
      cell.numFmt = "@";
      cell.alignment = {
        vertical: "middle",
        horizontal: columnNumber <= 2 ? "center" : "left",
        wrapText: true,
      };
      cell.border = {
        top: { style: "hair", color: { argb: "FFE2E8F0" } },
        left: { style: "hair", color: { argb: "FFE2E8F0" } },
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
        right: { style: "hair", color: { argb: "FFE2E8F0" } },
      };
      if (row.number % 2 === 0)
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7F8" } };
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
      Math.min(column.maxWidth || 34, observed + 2),
    );
    sheet.getColumn(index + 1).numFmt = "@";
  });
  return sheet;
}

function baseRow(number, employee) {
  return {
    no: number,
    employee_no: employee.employee_no,
    full_name: employee.full_name,
  };
}
function buildRepeatedRows(employees, detailRows, mapper) {
  const grouped = groupedByEmployee(detailRows);
  const rows = [];
  for (const employee of employees) {
    const employeeRows = grouped.get(String(employee.id)) || [];
    if (!employeeRows.length) {
      rows.push({ ...baseRow(rows.length + 1, employee) });
      continue;
    }
    for (const detail of employeeRows)
      rows.push({ ...mapper(detail, employee), ...baseRow(rows.length + 1, employee) });
  }
  return rows;
}

const commonColumns = [
  { key: "no", label: "No", width: 7, maxWidth: 8 },
  { key: "employee_no", label: "NIP", width: 16, maxWidth: 24 },
  { key: "full_name", label: "Nama Pegawai", width: 28, maxWidth: 38 },
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
  const organizationTimeZone = report.organization.timezone || "Asia/Makassar";

  const guide = workbook.addWorksheet("Petunjuk", {
    properties: { tabColor: { argb: "FFED0A22" } },
  });
  guide.mergeCells("A1:B1");
  guide.getCell("A1").value = "Data Pegawai SITOU";
  guide.getRow(1).height = 34;
  guide.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  guide.getCell("A1").alignment = { vertical: "middle", horizontal: "left" };
  guide.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFED0A22" } };
  guide.addRow(["Organisasi", report.organization.name]);
  guide.addRow(["Waktu Pengunduhan", formatDateTime(report.generatedAt, organizationTimeZone)]);
  guide.addRow(["Jumlah pegawai", String(report.employees.length)]);
  guide.addRow([]);
  const filterHeading = guide.addRow(["Filter yang digunakan"]);
  for (const item of filterDescriptions(report)) guide.addRow(item);
  guide.addRow([]);
  const readingHeading = guide.addRow(["Cara membaca file"]);
  guide.addRow([
    "NIP dan Nama Pegawai",
    "NIP menjadi penghubung data pegawai pada seluruh sheet. Nama Pegawai membantu pencarian dan pembacaan.",
  ]);
  guide.addRow([
    "Lengkap / Belum lengkap",
    "Menunjukkan apakah data utama pegawai sudah tersedia.",
  ]);
  guide.addRow([
    "Ada / Belum ada",
    "Menunjukkan ketersediaan dokumen. Isi file tidak disertakan dalam Excel.",
  ]);
  guide.addRow(["Belum ada data", "Informasi tersebut belum diisi di aplikasi."]);
  guide.addRow([]);
  const warning = guide.addRow([
    "Perhatian",
    "File ini memuat data pribadi pegawai. Simpan dan bagikan hanya kepada pihak yang berwenang.",
  ]);
  for (const row of [filterHeading, readingHeading]) {
    guide.mergeCells(`A${row.number}:B${row.number}`);
    row.height = 26;
    row.font = { bold: true, color: { argb: "FFED0A22" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFECEF" } };
    row.alignment = { vertical: "middle" };
  }
  warning.font = { bold: true, color: { argb: "FF9F1239" } };
  warning.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFECEF" } };
  guide.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "hair", color: { argb: "FFE2E8F0" } } };
      if (cell.col === 1 && row.number > 1 && cell.value) cell.font = { bold: true };
    });
  });
  guide.getColumn(1).width = 30;
  guide.getColumn(2).width = 95;
  guide.views = [{ state: "frozen", ySplit: 1 }];
  const summaryRows = report.employees.map((employee, index) => {
    const employeeIdentifiers = identifiers.get(String(employee.id)) || new Map();
    const employeeIdentifierRows = identifierRows.get(String(employee.id)) || [];
    const docCounts = Object.fromEntries(
      documentSlots.map(([kind]) => [kind, documents.get(`${employee.id}:${kind}`)?.count || 0]),
    );
    const missingCore = [
      !employee.national_id && "NIK",
      !employee.profile_photo_file_id && "Pas foto",
      !employee.has_contact_data && "Kontak",
      !employee.assignment_id && "Penempatan aktif",
    ].filter(Boolean);
    const missingDocuments = documentSlots
      .filter(([kind]) => !docCounts[kind])
      .map(([, label]) => label);
    const identifier = (kind) => employeeIdentifiers.get(kind)?.identifier_value;
    const otherIdentifiers = employeeIdentifierRows
      .filter((item) => item.identifier_type === "other")
      .map(
        (item) =>
          `${value(item.identifier_label, "Identitas lainnya")}: ${value(item.identifier_value)}`,
      );
    return {
      ...baseRow(index + 1, employee),
      national_id: value(employee.national_id),
      family_card: value(identifier("family_card")),
      tax_npwp: value(identifier("tax_npwp")),
      bpjs_health: value(identifier("bpjs_health")),
      bpjs_employment: value(identifier("bpjs_employment")),
      passport: value(identifier("passport")),
      other_identifiers: otherIdentifiers.length ? otherIdentifiers.join("; ") : EMPTY_DATA,
      preferred_name: value(employee.preferred_name),
      birth_place: value(employee.birth_place),
      birth_date: formatDate(employee.birth_date),
      gender: mapLabel("gender", employee.gender),
      religion: value(employee.religion),
      marital_status: mapLabel("marital", employee.marital_status),
      blood_type: value(employee.blood_type),
      nationality: value(employee.nationality),
      joined_date: formatDate(employee.joined_date),
      employment_status: mapLabel("employment", employee.employment_status),
      termination_date: employee.termination_date
        ? formatDate(employee.termination_date)
        : NOT_APPLICABLE,
      termination_reason: employee.termination_reason
        ? value(employee.termination_reason)
        : NOT_APPLICABLE,
      location_name: value(employee.location_name),
      unit_name: value(employee.unit_name),
      position_name: value(employee.position_name),
      supervisor_name: value(employee.supervisor_name),
      employment_type_name: value(employee.employment_type_name),
      account_status:
        { active: "Aktif", inactive: "Nonaktif", not_linked: "Belum terhubung" }[
          employee.account_status
        ] || EMPTY_DATA,
      core_completeness: missingCore.length ? "Belum lengkap" : "Lengkap",
      missing_core: missingCore.length ? missingCore.join(", ") : NOT_APPLICABLE,
      available_documents: String(documentSlots.length - missingDocuments.length),
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
      ["other_identifiers", "Identitas Lain"],
      ["preferred_name", "Nama Panggilan"],
      ["birth_place", "Tempat Lahir"],
      ["birth_date", "Tanggal Lahir"],
      ["gender", "Jenis Kelamin"],
      ["religion", "Agama"],
      ["marital_status", "Status Perkawinan"],
      ["blood_type", "Golongan Darah"],
      ["nationality", "Kewarganegaraan"],
      ["joined_date", "Tanggal Bergabung"],
      ["employment_status", "Status Pegawai"],
      ["termination_date", "Tanggal Berakhir Bekerja"],
      ["termination_reason", "Alasan Berakhir Bekerja"],
      ["location_name", "Lokasi Aktif"],
      ["unit_name", "Divisi & Unit Aktif"],
      ["position_name", "Jabatan Aktif"],
      ["supervisor_name", "Atasan Langsung"],
      ["employment_type_name", "Jenis Kepegawaian"],
      ["account_status", "Status Akun"],
      ["core_completeness", "Kelengkapan Data"],
      ["missing_core", "Data yang Belum Lengkap"],
      ["available_documents", "Jumlah Dokumen Tersedia"],
      ["missing_documents", "Dokumen yang Belum Tersedia"],
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
      latest_updated_at: latest ? formatDateTime(latest, organizationTimeZone) : EMPTY_DATA,
    };
  });
  addDataSheet(
    workbook,
    "Kelengkapan Dokumen",
    [
      ...commonColumns,
      ...documentSlots.map(([key, label]) => ({ key, label, width: 18 })),
      { key: "latest_updated_at", label: "Terakhir Diperbarui", width: 28 },
    ],
    documentRows,
  );

  const contactRows = report.employees.map((employee, index) => ({
    ...baseRow(index + 1, employee),
    personal_email: value(employee.personal_email),
    whatsapp: value(employee.whatsapp),
    ktp_address: value(employee.ktp_address),
    domicile_address: value(employee.domicile_address),
  }));
  addDataSheet(
    workbook,
    "Kontak",
    [
      ...commonColumns,
      ["personal_email", "Email Pribadi"],
      ["whatsapp", "WhatsApp"],
      ["ktp_address", "Alamat KTP"],
      ["domicile_address", "Alamat Domisili"],
    ].map((column) =>
      Array.isArray(column) ? { key: column[0], label: column[1], width: 22 } : column,
    ),
    contactRows,
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
        ["verified_at", "Diverifikasi Pada"],
      ],
      (row) => ({
        ...row,
        is_primary: yesNo(row.is_primary),
        verified_at: row.verified_at
          ? formatDateTime(row.verified_at, organizationTimeZone)
          : "Belum diverifikasi",
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
        ["notes", "Catatan"],
      ],
      (row) => ({
        ...row,
        relationship: mapLabel("relationship", row.relationship),
        member_name: value(row.full_name),
        birth_date: formatDate(row.birth_date),
        is_dependent: yesNo(row.is_dependent),
      }),
    ],
    [
      "Kontak Darurat",
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
      "Akun Sosial",
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
      ],
      (row) => ({
        ...row,
        is_highest: yesNo(row.is_highest),
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
      ],
      (row) => ({
        ...row,
        issued_at: formatDate(row.issued_at),
        expires_at: formatDate(row.expires_at),
      }),
    ],
    [
      "Riwayat Kontrak",
      report.sections.contracts,
      [
        ["employment_type_name", "Jenis Kepegawaian"],
        ["contract_no", "Nomor Kontrak"],
        ["start_date", "Tanggal Mulai"],
        ["end_date", "Tanggal Akhir"],
        ["contract_status", "Status Kontrak"],
        ["notes", "Catatan"],
        ["created_at", "Dicatat Pada"],
        ["corrected_by_name", "Dikoreksi Oleh"],
        ["corrected_at", "Dikoreksi Pada"],
        ["cancellation_reason", "Alasan Pembatalan"],
        ["cancelled_by_name", "Dibatalkan Oleh"],
        ["cancelled_at", "Dibatalkan Pada"],
      ],
      (row) => ({
        ...row,
        start_date: formatDate(row.start_date),
        end_date: row.end_date ? formatDate(row.end_date) : NOT_APPLICABLE,
        created_at: formatDateTime(row.created_at, organizationTimeZone),
        contract_status: mapLabel("contract", row.status),
        corrected_by_name: row.corrected_at ? value(row.corrected_by_name) : NOT_APPLICABLE,
        corrected_at: row.corrected_at
          ? formatDateTime(row.corrected_at, organizationTimeZone)
          : NOT_APPLICABLE,
        cancellation_reason:
          row.status === "cancelled" ? value(row.cancellation_reason) : NOT_APPLICABLE,
        cancelled_by_name:
          row.status === "cancelled" ? value(row.cancelled_by_name) : NOT_APPLICABLE,
        cancelled_at:
          row.status === "cancelled"
            ? formatDateTime(row.cancelled_at, organizationTimeZone)
            : NOT_APPLICABLE,
      }),
    ],
    [
      "Riwayat Penempatan",
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
        ["created_at", "Dicatat Pada"],
        ["corrected_by_name", "Dikoreksi Oleh"],
        ["corrected_at", "Dikoreksi Pada"],
      ],
      (row) => ({
        ...row,
        assignment_type_label: mapLabel("assignment", row.assignment_type),
        change_type_label: mapLabel("change", row.change_type),
        effective_from: formatDate(row.effective_from),
        created_at: formatDateTime(row.created_at, organizationTimeZone),
        effective_until: row.effective_until ? formatDate(row.effective_until) : "Masih berlaku",
        corrected_by_name: row.corrected_at ? value(row.corrected_by_name) : NOT_APPLICABLE,
        corrected_at: row.corrected_at
          ? formatDateTime(row.corrected_at, organizationTimeZone)
          : NOT_APPLICABLE,
      }),
    ],
  ];

  for (const [name, source, columns, mapper] of repeatedDefinitions) {
    const rows = buildRepeatedRows(report.employees, source, mapper);
    addDataSheet(
      workbook,
      name,
      [...commonColumns, ...columns.map(([key, label]) => ({ key, label, width: 18 }))],
      rows,
    );
  }

  return workbook.xlsx.writeBuffer();
}
