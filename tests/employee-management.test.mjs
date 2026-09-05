import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { accountCreateSchema, accountPasswordSchema } from "../lib/access/schemas.js";
import {
  canManageOrganizationAccountRole,
  normalizeAccountInputForActor,
} from "../lib/access/accountPolicy.mjs";
import {
  employeeProfileMultipartSchema,
  employeeProfileSectionsSchema,
} from "../lib/employees/profileSchemas.js";
import {
  disciplinaryActionCreateSchema,
  disciplinaryActionRevokeSchema,
} from "../lib/discipline/schemas.js";
import {
  assignmentSchema,
  contractSchema,
  employeeAssignmentCreateSchema,
  employeeAssignmentCorrectionSchema,
  employeeCreateSchema,
  employeeContractCancellationSchema,
  employeeContractCorrectionSchema,
  employeeDraftSaveSchema,
  employeeListFilterSchema,
  employeeUpdateMultipartSchema,
} from "../lib/employees/schemas.js";
import { normalizeMaritalStatus } from "../lib/employees/profileOptions.js";
import { calculateEmployeeTenure } from "../lib/employees/tenure.js";
import {
  isValidIndonesianNationalId,
  normalizeIndonesianNationalId,
  optionalIndonesianNationalIdSchema,
} from "../lib/validation/indonesianNationalId.js";
import { readJson, validateRequestOrigin } from "../lib/api/routeHelpers.js";
import {
  ApiRequestError,
  applyApiFieldErrors,
  readApiResponse,
} from "../lib/api/clientError.js";
import { selfProfileLinkSchema } from "../lib/account/schemas.js";
import { canLinkOwnEmployeeProfile } from "../lib/account/profilePolicy.mjs";
import {
  DEFAULT_MINIMUM_LOADING_MS,
  waitForMinimumDuration,
} from "../lib/ui/minimumDuration.mjs";

const strongAccount = {
  organizationId: 1,
  employeeId: 2,
  username: "pegawai.test",
  roleCode: "employee",
  locationScopeMode: "all",
  locationIds: [],
  isActive: true,
  password: "Test#123",
  confirmPassword: "Test#123",
};

const validEmployeeUpdate = {
  organizationId: 1,
  employeeNo: "PGW-001",
  fullName: "Pegawai Contoh",
  nationalId: "7171082102940002",
  employmentStatus: "active",
  version: "2026-09-05T00:00:00.000Z",
  contact: {},
};

test("schema final dan migration koreksi memberikan permission akun", () => {
  const schemaSql = readFileSync(new URL("../sitou_schema_v3.sql", import.meta.url), "utf8");
  const migrationSql = readFileSync(
    new URL(
      "../database/migrations/20260828_018_repair_account_permissions.sql",
      import.meta.url,
    ),
    "utf8",
  );

  for (const sql of [schemaSql, migrationSql]) {
    assert.match(sql, /'accounts\.read'/);
    assert.match(sql, /'accounts\.manage'/);
    assert.match(
      sql,
      /role_row\.code IN \('superadmin', 'hrd'\)|role\.code IN \('superadmin','hrd'\)/,
    );
  }
});

test("schema final memuat permission lengkap sesuai batas setiap role", () => {
  const schemaSql = readFileSync(new URL("../sitou_schema_v3.sql", import.meta.url), "utf8");
  const requiredPermissionCodes = [
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
    "employees.read_self",
    "assignments.read_self",
    "contracts.read_self",
    "private_files.read_self",
    "profile_self.read",
    "profile_self.update",
  ];

  for (const permissionCode of requiredPermissionCodes) {
    assert.equal(schemaSql.includes("('" + permissionCode + "'"), true, permissionCode);
  }

  const employeeGrant = schemaSql.match(
    /WHERE role\.code='employee'[\s\S]*?ON CONFLICT DO NOTHING;/,
  )?.[0];
  assert.ok(employeeGrant);
  assert.match(employeeGrant, /'employees\.read_self'/);
  assert.doesNotMatch(employeeGrant, /'employees\.read',/);
});

test("tambah akun menolak konfirmasi password yang berbeda", () => {
  const result = accountCreateSchema.safeParse({
    ...strongAccount,
    confirmPassword: "Berbeda#123",
  });
  assert.equal(result.success, false);
  assert.equal(
    result.error.issues.some((issue) => issue.path.join(".") === "confirmPassword"),
    true,
  );
});
test("payload akun menolak identitas yang seharusnya bersumber dari profil", () => {
  const result = accountCreateSchema.safeParse({
    ...strongAccount,
    email: "duplikat@sitou.local",
    fullName: "Data Duplikat",
    phone: "+628123456789",
  });
  assert.equal(result.success, false);
});
test("akun HRD selected wajib memiliki minimal satu lokasi", () => {
  const result = accountCreateSchema.safeParse({
    ...strongAccount,
    roleCode: "hrd",
    locationScopeMode: "selected",
  });
  assert.equal(result.success, false);
});

test("role Superadmin tidak dapat dikirim melalui akun organisasi", () => {
  const result = accountCreateSchema.safeParse({ ...strongAccount, roleCode: "superadmin" });
  assert.equal(result.success, false);
});

test("akun Pimpinan dapat dibuat tanpa profil pegawai", () => {
  const result = accountCreateSchema.safeParse({
    ...strongAccount,
    employeeId: null,
    roleCode: "leader",
  });
  assert.equal(result.success, true);
});

test("akun Pegawai wajib ditautkan ke profil pegawai", () => {
  const result = accountCreateSchema.safeParse({
    ...strongAccount,
    employeeId: null,
  });
  assert.equal(result.success, false);
  assert.equal(
    result.error.issues.some((issue) => issue.path.join(".") === "employeeId"),
    true,
  );
});

test("reset password menolak konfirmasi yang berbeda", () => {
  const result = accountPasswordSchema.safeParse({
    organizationId: 1,
    password: "Test#123",
    confirmPassword: "Test#124",
  });
  assert.equal(result.success, false);
});

test("profil hanya menerima satu rekening utama", () => {
  const result = employeeProfileSectionsSchema.safeParse({
    bankAccounts: [
      { bankName: "A", accountNumber: "1", accountHolder: "Test", isPrimary: true },
      { bankName: "B", accountNumber: "2", accountHolder: "Test", isPrimary: true },
    ],
  });
  assert.equal(result.success, false);
});

test("profil menerima identitas administratif beserta file privat", () => {
  const result = employeeProfileSectionsSchema.safeParse({
    identifiers: [
      {
        identifierType: "family_card",
        identifierValue: "7171082102940002",
        documentFileId: 42,
      },
      {
        identifierType: "bpjs_health",
        identifierValue: "0001234567890",
        documentFileId: 43,
      },
    ],
  });
  assert.equal(result.success, true);
});

test("NIK terpusat hanya menerima tepat 16 digit", () => {
  assert.equal(normalizeIndonesianNationalId("7171 0821-0294 0002"), "7171082102940002");
  assert.equal(isValidIndonesianNationalId("7171082102940002"), true);
  assert.equal(isValidIndonesianNationalId("717108210294000"), false);
  assert.equal(optionalIndonesianNationalIdSchema.safeParse("71710821029400020").success, false);
});

test("NIK anggota keluarga mengikuti validasi 16 digit yang sama", () => {
  const result = employeeProfileSectionsSchema.safeParse({
    dependents: [
      {
        relationship: "child",
        fullName: "Contoh Pegawai",
        nationalId: "1234",
      },
    ],
  });
  assert.equal(result.success, false);
  assert.equal(
    result.error.issues.some((issue) => issue.path.join(".") === "dependents.0.nationalId"),
    true,
  );
});

test("upload profil tertunda wajib memiliki token dan target unik", () => {
  const token = "d9ab55b8-54a8-4b78-9bf2-c71b07ea2965";
  const result = employeeProfileMultipartSchema.safeParse({
    organizationId: 1,
    profile: {},
    uploads: [
      { token, target: "profilePhoto" },
      { token, target: "profilePhoto" },
    ],
  });
  assert.equal(result.success, false);
});

test("edit pegawai menerima penggantian KTP dan pas foto dalam satu multipart", () => {
  const result = employeeUpdateMultipartSchema.safeParse({
    ...validEmployeeUpdate,
    fileChanges: { ktp: "replace", profilePhoto: "replace" },
    uploads: [
      { token: "d9ab55b8-54a8-4b78-9bf2-c71b07ea2965", target: "ktp" },
      { token: "4bd8efe1-0f5f-45dd-8f73-a15b686643c8", target: "profilePhoto" },
    ],
  });
  assert.equal(result.success, true);
});

test("edit pegawai menolak aksi ganti tanpa file dan file tanpa aksi ganti", () => {
  const missingFile = employeeUpdateMultipartSchema.safeParse({
    ...validEmployeeUpdate,
    fileChanges: { ktp: "replace", profilePhoto: "keep" },
  });
  const unexpectedFile = employeeUpdateMultipartSchema.safeParse({
    ...validEmployeeUpdate,
    fileChanges: { ktp: "keep", profilePhoto: "keep" },
    uploads: [{ token: "d9ab55b8-54a8-4b78-9bf2-c71b07ea2965", target: "ktp" }],
  });
  assert.equal(missingFile.success, false);
  assert.equal(unexpectedFile.success, false);
});

test("form edit menunda file profil dan menyimpannya bersama PATCH pegawai", () => {
  const formSource = readFileSync(
    new URL("../app/components/employees/EmployeeForm.jsx", import.meta.url),
    "utf8",
  );
  const routeSource = readFileSync(
    new URL("../app/api/employees/[id]/route.js", import.meta.url),
    "utf8",
  );
  const serviceSource = readFileSync(
    new URL("../lib/employees/service.js", import.meta.url),
    "utf8",
  );

  assert.match(formSource, /deferred=\{editing\}/);
  assert.match(formSource, /new FormData\(\)/);
  assert.doesNotMatch(formSource, /editing \? "\/api\/uploads"/);
  assert.match(routeSource, /employeeUpdateMultipartSchema/);
  assert.match(routeSource, /updateEmployeeWithProfileFiles/);
  assert.match(serviceSource, /softDeleteRemovedProfileFiles/);
  assert.match(serviceSource, /restoreQuarantinedFiles/);
  assert.match(serviceSource, /purgeQuarantinedFiles/);
});

test("endpoint upload umum menolak perubahan langsung pada file profil", () => {
  const uploadRoute = readFileSync(
    new URL("../app/api/uploads/route.js", import.meta.url),
    "utf8",
  );
  const deleteRoute = readFileSync(
    new URL("../app/api/uploads/[fileId]/route.js", import.meta.url),
    "utf8",
  );
  assert.match(uploadRoute, /PROFILE_FILE_COMPOSITE_REQUIRED/);
  assert.match(deleteRoute, /PROFILE_FILE_COMPOSITE_REQUIRED/);
});

test("identitas lainnya wajib mempunyai nama yang dapat dipahami pengguna", () => {
  const result = employeeProfileSectionsSchema.safeParse({
    identifiers: [{ identifierType: "other", identifierValue: "ABC-001" }],
  });
  assert.equal(result.success, false);
  assert.equal(
    result.error.issues.some((issue) => issue.path.join(".") === "identifiers.0.identifierLabel"),
    true,
  );
});

test("profil menolak jenis identitas administratif yang sama", () => {
  const result = employeeProfileSectionsSchema.safeParse({
    identifiers: [
      { identifierType: "bpjs_health", identifierValue: "0001234567890" },
      { identifierType: "bpjs_health", identifierValue: "0009876543210" },
    ],
  });
  assert.equal(result.success, false);
  assert.equal(
    result.error.issues.some((issue) => issue.path.join(".") === "identifiers.1.identifierType"),
    true,
  );
});

test("profil menolak platform akun sosial duplikat tanpa membedakan kapitalisasi", () => {
  const result = employeeProfileSectionsSchema.safeParse({
    socialAccounts: [
      { platform: "Facebook", handleOrUrl: "https://facebook.com/pegawai" },
      { platform: "facebook", handleOrUrl: "https://facebook.com/pegawai-lain" },
    ],
  });
  assert.equal(result.success, false);
  assert.equal(
    result.error.issues.some((issue) => issue.path.join(".") === "socialAccounts.1.platform"),
    true,
  );
});

test("tindakan tertulis aktif wajib memiliki nomor dan file", () => {
  const result = disciplinaryActionCreateSchema.safeParse({
    organizationId: 1,
    actionType: "sp1",
    issuedDate: "2026-08-22",
    effectiveFrom: "2026-08-22",
    status: "active",
    directEscalation: false,
  });
  assert.equal(result.success, false);
});

test("SP berstatus draft boleh disimpan sebelum nomor dan file surat lengkap", () => {
  const result = disciplinaryActionCreateSchema.safeParse({
    organizationId: 1,
    actionType: "sp1",
    issuedDate: "2026-08-22",
    effectiveFrom: "2026-08-22",
    status: "draft",
    directEscalation: false,
  });
  assert.equal(result.success, true);
});

test("pencabutan tindakan wajib memiliki alasan yang layak", () => {
  assert.equal(
    disciplinaryActionRevokeSchema.safeParse({ organizationId: 1, reason: "salah" }).success,
    false,
  );
  assert.equal(
    disciplinaryActionRevokeSchema.safeParse({
      organizationId: 1,
      reason: "Surat diterbitkan menggunakan dasar keputusan yang keliru.",
    }).success,
    true,
  );
});

test("teguran lisan aktif tidak mewajibkan nomor dan file surat", () => {
  const result = disciplinaryActionCreateSchema.safeParse({
    organizationId: 1,
    actionType: "oral_warning",
    issuedDate: "2026-08-22",
    effectiveFrom: "2026-08-22",
    status: "active",
    directEscalation: false,
  });
  assert.equal(result.success, true);
});

test("SP2 langsung wajib memiliki alasan eskalasi", () => {
  const result = disciplinaryActionCreateSchema.safeParse({
    organizationId: 1,
    actionType: "sp2",
    issuedDate: "2026-08-22",
    effectiveFrom: "2026-08-22",
    status: "draft",
    directEscalation: true,
  });
  assert.equal(result.success, false);
});

test("kontrak aktif wajib memiliki nomor dan dokumen privat", () => {
  const result = contractSchema.safeParse({
    employmentTypeId: 1,
    startDate: "2026-08-22",
    status: "active",
  });
  assert.equal(result.success, false);
  assert.deepEqual(
    result.error.issues.map((issue) => issue.path.join(".")),
    ["contractNo", "documentFileId"],
  );
});

const validEmployeeOnboarding = {
  organizationId: 1,
  employeeNo: "PGW-001",
  fullName: "Pegawai Contoh",
  nationalId: "7171082102940002",
  maritalStatus: "married",
  employmentStatus: "active",
  contract: {
    employmentTypeId: 1,
    startDate: "2026-08-28",
    status: "active",
  },
  assignment: {
    locationId: 1,
    organizationUnitId: 1,
    effectiveFrom: "2026-08-28",
  },
};

test("onboarding pegawai mewajibkan NIK 16 digit", () => {
  const result = employeeCreateSchema.safeParse({
    ...validEmployeeOnboarding,
    nationalId: null,
  });
  assert.equal(result.success, false);
  assert.equal(result.error.issues.some((issue) => issue.path.join(".") === "nationalId"), true);
});

test("onboarding menerima nomor dan dokumen kontrak yang belum tersedia", () => {
  const result = employeeCreateSchema.safeParse(validEmployeeOnboarding);
  assert.equal(result.success, true);
  assert.equal(result.data.contract.contractNo, null);
  assert.equal(result.data.contract.documentFileId, null);
});

test("status perkawinan hanya menerima pilihan resmi", () => {
  assert.equal(employeeCreateSchema.safeParse(validEmployeeOnboarding).success, true);
  assert.equal(
    employeeCreateSchema.safeParse({
      ...validEmployeeOnboarding,
      maritalStatus: "status bebas",
    }).success,
    false,
  );
});

test("onboarding menerima nomor dan dokumen penempatan yang belum tersedia", () => {
  const result = employeeCreateSchema.safeParse(validEmployeeOnboarding);
  assert.equal(result.success, true);
  assert.equal(result.data.assignment.decreeNo, null);
  assert.equal(result.data.assignment.documentFileId, null);
});

test("label status perkawinan dari draft lama dinormalkan ke kode resmi", () => {
  assert.equal(normalizeMaritalStatus("Belum Menikah"), "single");
  assert.equal(normalizeMaritalStatus("Menikah"), "married");
  assert.equal(normalizeMaritalStatus("Cerai Hidup"), "divorced");
  assert.equal(normalizeMaritalStatus("Cerai Mati"), "widowed");
});

test("validasi origin menerima origin publik yang diteruskan reverse proxy", () => {
  const request = new Request("http://127.0.0.1:3000/api/uploads", {
    headers: {
      origin: "https://sitou.pasarmanado.id",
      "x-forwarded-proto": "https",
      host: "sitou.pasarmanado.id",
    },
  });
  assert.equal(validateRequestOrigin(request, "request-test"), null);
});

test("validasi origin tetap menolak origin asing", () => {
  const request = new Request("http://127.0.0.1:3000/api/uploads", {
    headers: {
      origin: "https://contoh-berbahaya.invalid",
      "x-forwarded-proto": "https",
      host: "sitou.pasarmanado.id",
    },
  });
  assert.equal(validateRequestOrigin(request, "request-test").status, 403);
});
test("koreksi kontrak menerima nomor dan dokumen kontrak kosong", () => {
  const result = employeeContractCorrectionSchema.safeParse({
    organizationId: 1,
    employmentTypeId: 1,
    contractNo: "",
    startDate: "2026-08-22",
    documentFileId: null,
    version: "2026-08-23T00:00:00.000Z",
  });
  assert.equal(result.success, true);
  assert.equal(result.data.contractNo, null);
  assert.equal(result.data.documentFileId, null);
});

test("pembatalan kontrak wajib menyimpan alasan yang layak", () => {
  const result = employeeContractCancellationSchema.safeParse({
    organizationId: 1,
    version: "2026-08-23T00:00:00.000Z",
    reason: "Salah input periode kontrak.",
  });
  assert.equal(result.success, true);
  assert.equal(
    employeeContractCancellationSchema.safeParse({
      organizationId: 1,
      version: "2026-08-23T00:00:00.000Z",
      reason: "Err",
    }).success,
    false,
  );
});

test("penempatan baru menerima nomor dan dokumen penempatan yang belum tersedia", () => {
  const result = assignmentSchema.safeParse({
    locationId: 1,
    organizationUnitId: 2,
    effectiveFrom: "2026-08-22",
  });
  assert.equal(result.success, true);
  assert.equal(result.data.decreeNo, null);
  assert.equal(result.data.documentFileId, null);
});

test("service penempatan melewati validasi dokumen ketika file tidak diunggah", () => {
  const serviceSource = readFileSync(
    new URL("../lib/employees/service.js", import.meta.url),
    "utf8",
  );
  const createAssignmentSource = serviceSource.slice(
    serviceSource.indexOf("export async function createEmployeeAssignment"),
    serviceSource.indexOf("export async function correctEmployeeAssignment"),
  );

  assert.match(
    createAssignmentSource,
    /if \(input\.documentFileId\)\s+await validateLifecycleDocument\(/,
  );
});

test("HRD selalu membuat akun Pegawai tanpa scope role istimewa", () => {
  assert.deepEqual(
    normalizeAccountInputForActor(
      {
        ...strongAccount,
        roleCode: "hrd",
        locationScopeMode: "selected",
        locationIds: [10, 11],
      },
      "hrd",
    ),
    {
      ...strongAccount,
      roleCode: "employee",
      locationScopeMode: "all",
      locationIds: [],
    },
  );
});

test("HRD hanya dapat mengelola akun Pegawai", () => {
  assert.equal(canManageOrganizationAccountRole("hrd", "employee"), true);
  assert.equal(canManageOrganizationAccountRole("hrd", "hrd"), false);
  assert.equal(canManageOrganizationAccountRole("hrd", "leader"), false);
  assert.equal(canManageOrganizationAccountRole("superadmin", "hrd"), true);
  assert.equal(canManageOrganizationAccountRole("superadmin", "leader"), true);
});

test("form dan service akun menerapkan batas pengelolaan HRD", () => {
  const formSource = readFileSync(
    new URL("../app/components/access/OrganizationAccountForm.jsx", import.meta.url),
    "utf8",
  );
  const pageSource = readFileSync(
    new URL("../app/(protected)/access/accounts/page.jsx", import.meta.url),
    "utf8",
  );
  const serviceSource = readFileSync(
    new URL("../lib/access/service.js", import.meta.url),
    "utf8",
  );

  assert.match(formSource, /isHrd \? ROLES\.EMPLOYEE : values\.roleCode/);
  assert.match(formSource, /isHrd \? \([\s\S]*name="roleCode" hidden/);
  assert.match(pageSource, /item\.role_code === ROLES\.EMPLOYEE/);
  assert.match(serviceSource, /ACCOUNT_ROLE_FORBIDDEN/);
  assert.match(serviceSource, /EMPLOYEE_PROFILE_REQUIRED/);
  assert.match(serviceSource, /assertActorCanManageAccount\(actor, before\.role_code\)/);
  assert.match(serviceSource, /\$5='superadmin' OR role\.code='employee'/);
  assert.match(serviceSource, /getOrganizationAccountForActor/);
});

test("role akun default menjadi Pegawai ketika tidak dikirim", () => {
  const result = accountCreateSchema.safeParse({
    ...strongAccount,
    roleCode: undefined,
  });
  assert.equal(result.success, true);
  assert.equal(result.data.roleCode, "employee");
});

test("filter daftar pegawai menerima setiap status hubungan kerja resmi", () => {
  for (const employmentStatus of [
    "all",
    "active",
    "probation",
    "suspended",
    "terminated",
    "retired",
    "deceased",
  ])
    assert.equal(employeeListFilterSchema.safeParse({ employmentStatus }).success, true);
  assert.equal(employeeListFilterSchema.safeParse({ employmentStatus: "leave" }).success, false);
});

test("masa kerja aktif dihitung sampai hari ini dengan durasi kalender", () => {
  const result = calculateEmployeeTenure({
    joinedDate: "2020-02-29",
    employmentStatus: "active",
    today: "2025-02-28",
  });

  assert.equal(result.valid, true);
  assert.equal(result.duration, "5 tahun 0 bulan 0 hari");
  assert.equal(result.throughToday, true);
});

test("masa kerja final berhenti pada tanggal berakhir hubungan kerja", () => {
  const result = calculateEmployeeTenure({
    joinedDate: "2024-01-15",
    terminationDate: "2025-03-20",
    employmentStatus: "retired",
    today: "2026-09-02",
  });

  assert.equal(result.valid, true);
  assert.equal(result.duration, "1 tahun 2 bulan 5 hari");
  assert.equal(result.throughDate, "2025-03-20");
  assert.equal(result.throughToday, false);
});

test("masa kerja menangani durasi pendek, tanggal sama, dan tanggal invalid", () => {
  assert.equal(
    calculateEmployeeTenure({
      joinedDate: "2026-08-15",
      employmentStatus: "probation",
      today: "2026-09-02",
    }).duration,
    "0 tahun 0 bulan 18 hari",
  );
  assert.equal(
    calculateEmployeeTenure({
      joinedDate: "2026-09-02",
      employmentStatus: "active",
      today: "2026-09-02",
    }).duration,
    "0 tahun 0 bulan 0 hari",
  );
  assert.equal(
    calculateEmployeeTenure({
      joinedDate: "2026-09-03",
      employmentStatus: "active",
      today: "2026-09-02",
    }).message,
    "Data tanggal perlu diperiksa.",
  );
  assert.equal(
    calculateEmployeeTenure({ joinedDate: null, employmentStatus: "active" }).message,
    "Belum dapat dihitung karena tanggal bergabung belum tersedia.",
  );
});
test("direktori pegawai memakai section filter operasional", () => {
  const source = readFileSync(
    new URL("../app/components/employees/EmployeeDirectory.jsx", import.meta.url),
    "utf8",
  );
  const locationSelect = readFileSync(
    new URL("../app/components/selects/LocationSelect.jsx", import.meta.url),
    "utf8",
  );
  const rowActionMenu = readFileSync(
    new URL("../app/components/actions/RowActionMenu.jsx", import.meta.url),
    "utf8",
  );
  const topMenu = readFileSync(
    new URL("../app/components/navbar/TopMenu.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /<OperationalFilterSection/);
  assert.match(source, /label: "Cari pegawai"/);
  assert.match(source, /label: "Lokasi"/);
  assert.match(source, /label: "Divisi & Unit"/);
  assert.match(source, /label: "Jabatan"/);
  assert.match(source, /label: "Jenis kepegawaian\/kontrak"/);
  assert.match(source, /employmentTypeId/);
  assert.match(source, /references\.employmentTypes/);
  assert.match(source, /wideColumns=\{6\}/);
  assert.match(source, /label: "Status pegawai"/);
  assert.match(source, /options=\{references\.locations\}/);
  assert.doesNotMatch(source, /showCode=/);
  assert.match(locationSelect, /if \(!organizationId \|\| suppliedOptions\) return undefined/);
  assert.doesNotMatch(locationSelect, /showCode/);
  assert.match(locationSelect, /label: item\.name/);
  assert.match(rowActionMenu, /MenuOutlined/);
  assert.match(rowActionMenu, /aria-label="Buka menu aksi"/);
  assert.match(rowActionMenu, /popupRender/);
  assert.match(rowActionMenu, /type: "divider"/);
  assert.match(topMenu, /<Divider/);
  assert.doesNotMatch(rowActionMenu, /MoreOutlined/);
  assert.doesNotMatch(source, /<DataToolbar/);
});
test("seluruh tabel memakai desain modern reusable dan alignment yang konsisten", () => {
  const projectRoot = resolve(import.meta.dirname, "..");
  const appRoot = resolve(projectRoot, "app");
  const directorySource = readFileSync(
    new URL("../app/components/employees/EmployeeDirectory.jsx", import.meta.url),
    "utf8",
  );
  const avatarSource = readFileSync(
    new URL("../app/components/employees/EmployeeAvatar.jsx", import.meta.url),
    "utf8",
  );
  const dataPanelSource = readFileSync(
    new URL("../app/components/data-display/DataPanel.jsx", import.meta.url),
    "utf8",
  );
  const responsiveViewSource = readFileSync(
    new URL("../app/components/data-display/ResponsiveDataView.jsx", import.meta.url),
    "utf8",
  );
  const modernTableSource = readFileSync(
    new URL("../app/components/data-display/ModernTableFrame.jsx", import.meta.url),
    "utf8",
  );
  const subscriptionSource = readFileSync(
    new URL(
      "../app/(protected)/master-data/organizations/SubscriptionModal.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.ok(directorySource.includes("<EmployeeAvatar employee={item}"));
  assert.ok(directorySource.includes('dataIndex: "employment_type_name"'));
  assert.ok(directorySource.includes('title: "Jenis kepegawaian"'));
  assert.ok(directorySource.includes('tone="neutral"'));
  assert.ok(directorySource.includes('fixed: "right"'));
  assert.ok(directorySource.includes("scrollX={isSuperadmin ? 1450 : 1260}"));
  assert.equal(directorySource.includes("tableSx="), false);
  assert.equal(directorySource.includes("mobileCardSx="), false);
  assert.equal(directorySource.includes("CompactInfoChip label={item.employee_no}"), false);

  assert.ok(avatarSource.includes("profile_photo_file_id"));
  assert.ok(avatarSource.includes("employee?.organization_id"));
  assert.ok(avatarSource.includes("/api/uploads/"));
  assert.ok(avatarSource.includes("?organizationId="));
  assert.ok(avatarSource.includes("ImagePreviewModal"));
  assert.ok(avatarSource.includes("Perbesar pas foto "));
  assert.ok(avatarSource.includes("onError={() => setFailed(true)}"));
  assert.doesNotMatch(avatarSource, /ktp|identity_document|document_file_id/i);

  assert.ok(dataPanelSource.includes("p: 0"));
  assert.ok(responsiveViewSource.includes("<ModernTableFrame"));
  assert.ok(responsiveViewSource.includes("mobileCardSx"));
  assert.ok(responsiveViewSource.includes("scrollX = 900"));
  assert.ok(modernTableSource.includes("fontSize: 12.5"));
  assert.ok(modernTableSource.includes("px: { xs: 2, sm: 2.5, lg: 3 }"));
  assert.ok(subscriptionSource.includes("<ModernTableFrame outlined>"));

  const unframedTables = [];
  for (const file of collectAppSourceFiles(appRoot)) {
    if (![".jsx", ".tsx"].includes(extname(file))) continue;
    const source = readFileSync(file, "utf8");
    if (source.includes("<Table") && !source.includes("<ModernTableFrame")) {
      unframedTables.push(relative(projectRoot, file).replaceAll("\\", "/"));
    }
  }
  assert.deepEqual(unframedTables, []);
});

test("form dan service koreksi kontrak memperlakukan dokumen sebagai opsional", () => {
  const formSource = readFileSync(
    new URL("../app/components/employees/EmployeeLifecycleForms.jsx", import.meta.url),
    "utf8",
  );
  const serviceSource = readFileSync(
    new URL("../lib/employees/service.js", import.meta.url),
    "utf8",
  );
  const correctionSource = serviceSource.slice(
    serviceSource.indexOf("export async function correctEmployeeContract"),
    serviceSource.indexOf("export async function cancelEmployeeContract"),
  );

  assert.ok(formSource.includes("Nomor kontrak (opsional)"));
  assert.ok(formSource.includes("Dokumen kontrak (opsional)"));
  assert.ok(formSource.includes("if (!contract && !documentFile)"));
  assert.match(
    correctionSource,
    /if \(input\.documentFileId\)\s+await validateLifecycleDocument\(/,
  );
});
test("label tanggal pegawai membedakan tanggal bergabung, kontrak, dan TMT", () => {
  const employeeForm = readFileSync(
    new URL("../app/components/employees/EmployeeForm.jsx", import.meta.url),
    "utf8",
  );
  const lifecycleForms = readFileSync(
    new URL("../app/components/employees/EmployeeLifecycleForms.jsx", import.meta.url),
    "utf8",
  );
  const employeeDetail = readFileSync(
    new URL("../app/components/employees/EmployeeDetail.jsx", import.meta.url),
    "utf8",
  );

  assert.match(employeeForm, /Tanggal bergabung di organisasi/);
  assert.ok(
    employeeForm.indexOf('name="joinedDate"') < employeeForm.indexOf('label="KTP (opsional)"'),
  );
  assert.match(employeeForm, /Nomor dokumen penempatan \(opsional\)/);
  assert.match(employeeForm, /Dokumen penempatan \(opsional\)/);
  assert.doesNotMatch(employeeForm, /Nomor SK \(opsional\)/);
  assert.match(employeeForm, /Tanggal mulai kontrak/);
  assert.match(employeeForm, /TMT jabatan\/penempatan/);
  assert.match(lifecycleForms, /Tanggal mulai kontrak/);
  assert.match(lifecycleForms, /TMT jabatan\/penempatan/);
  assert.match(employeeDetail, /Tanggal bergabung di organisasi/);
  assert.match(employeeDetail, /Tanggal mulai kontrak/);
  assert.match(employeeDetail, /TMT jabatan\/penempatan/);
});
test("service menolak koreksi penempatan historis dengan kode stabil", () => {
  const serviceSource = readFileSync(
    new URL("../lib/employees/service.js", import.meta.url),
    "utf8",
  );
  const correctionSource = serviceSource.slice(
    serviceSource.indexOf("export async function correctEmployeeAssignment"),
    serviceSource.indexOf("export async function createEmployeeContract"),
  );

  assert.match(correctionSource, /if \(current\.effective_until\)/);
  assert.match(correctionSource, /ASSIGNMENT_HISTORY_READ_ONLY/);
  assert.match(correctionSource, /Penempatan historis hanya dapat dilihat/);
});

test("detail pegawai hanya menyediakan edit untuk penempatan aktif", () => {
  const detailSource = readFileSync(
    new URL("../app/components/employees/EmployeeDetail.jsx", import.meta.url),
    "utf8",
  );

  assert.match(detailSource, /label="Lihat penempatan"/);
  assert.match(detailSource, /canManageEmployee && active/);
  assert.match(detailSource, /title="Detail penempatan"/);
});
test("koreksi penempatan menerima nomor dan dokumen penempatan kosong", () => {
  const result = employeeAssignmentCorrectionSchema.safeParse({
    organizationId: 1,
    locationId: 1,
    organizationUnitId: 2,
    assignmentType: "primary",
    changeType: "correction",
    effectiveFrom: "2026-01-01",
    effectiveUntil: null,
    decreeNo: "",
    documentFileId: null,
    version: "2026-08-29T00:00:00.000Z",
  });
  assert.equal(result.success, true);
  assert.equal(result.data.decreeNo, null);
  assert.equal(result.data.documentFileId, null);
});
test("koreksi penempatan memakai versi, dokumen, dan periode yang valid", () => {
  const valid = employeeAssignmentCorrectionSchema.safeParse({
    organizationId: 1,
    locationId: 1,
    organizationUnitId: 2,
    assignmentType: "primary",
    changeType: "correction",
    effectiveFrom: "2026-01-01",
    effectiveUntil: "2026-06-30",
    decreeNo: "SK-001",
    documentFileId: 10,
    version: "2026-08-29T00:00:00.000Z",
  });
  assert.equal(valid.success, true);

  const invalidPeriod = employeeAssignmentCorrectionSchema.safeParse({
    ...valid.data,
    effectiveUntil: "2025-12-31",
  });
  assert.equal(invalidPeriod.success, false);
  assert.equal(
    invalidPeriod.error.issues.some((issue) => issue.path.join(".") === "effectiveUntil"),
    true,
  );
});

test("migration dan schema awal memuat versi koreksi penempatan", () => {
  const schemaSql = readFileSync(new URL("../sitou_schema_v3.sql", import.meta.url), "utf8");
  const migrationSql = readFileSync(
    new URL(
      "../database/migrations/20260829_020_employee_assignment_corrections.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(schemaSql, /employee_assignments[\s\S]+updated_at timestamptz NOT NULL DEFAULT now\(\)/);
  assert.match(migrationSql, /ALTER TABLE employee_assignments[\s\S]+ADD COLUMN updated_at/);
});

test("histori lifecycle tidak mengubah updated_at menjadi teks PostgreSQL", () => {
  const serviceSource = readFileSync(
    new URL("../lib/employees/service.js", import.meta.url),
    "utf8",
  );
  assert.match(serviceSource, /assignment\.created_at,assignment\.updated_at/);
  assert.match(serviceSource, /contract\.created_at,contract\.updated_at/);
  assert.doesNotMatch(serviceSource, /updated_at::text AS updated_at/);
});

test("checkpoint draft hanya menerima struktur wizard dan version positif", () => {
  const valid = employeeDraftSaveSchema.safeParse({
    organizationId: 1,
    currentStep: 3,
    version: 1,
    payload: {
      employeeNo: "PGW-001",
      profile: {
        educations: [
          {
            educationLevel: "S1",
            institution: "Universitas Contoh",
            fieldOfStudy: "Sistem Informasi",
            graduationYear: 2024,
            isHighest: true,
          },
        ],
      },
      contract: { employmentTypeId: "1", startDate: "2026-08-22" },
    },
  });
  assert.equal(valid.success, true);
  const unknown = employeeDraftSaveSchema.safeParse({
    organizationId: 1,
    currentStep: 0,
    version: 1,
    payload: { employeeNo: "PGW-001", injected: "tidak boleh" },
  });
  assert.equal(unknown.success, false);
});

test("checkpoint draft menerima pendidikan yang belum lengkap pada step Profil", () => {
  const result = employeeDraftSaveSchema.safeParse({
    organizationId: 1,
    currentStep: 0,
    version: 1,
    payload: {
      employeeNo: "PGW-001",
      fullName: "Pegawai Contoh",
      profile: { educations: [{ isHighest: true }] },
      contract: { status: "active", startDate: "2026-08-25" },
      assignment: {
        assignmentType: "primary",
        changeType: "initial",
        effectiveFrom: "2026-08-25",
      },
    },
  });
  assert.equal(result.success, true);
});

test("migration dan schema awal mewajibkan periode lokasi unit eksplisit tanpa overlap", () => {
  const schemaSql = readFileSync(new URL("../sitou_schema_v3.sql", import.meta.url), "utf8");
  const migrationSql = readFileSync(
    new URL(
      "../database/migrations/20260831_021_explicit_unit_location_periods.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(
    schemaSql,
    /organization_unit_locations[\s\S]{0,800}active_from date NOT NULL DEFAULT current_date/,
  );
  assert.match(schemaSql, /CONSTRAINT ex_unit_locations_period EXCLUDE USING gist/);
  assert.match(migrationSql, /ALTER COLUMN active_from DROP DEFAULT/);
  assert.match(migrationSql, /ADD CONSTRAINT ex_unit_locations_period EXCLUDE USING gist/);
});

test("respons validasi memakai masalah pertama dan mempertahankan seluruh fieldErrors", async () => {
  const request = new Request("http://localhost/api/employees/1/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organizationId: 1,
      locationId: 1,
      organizationUnitId: 2,
      effectiveFrom: "31-08-2026",
    }),
  });
  const parsed = await readJson(request, employeeAssignmentCreateSchema, "request-validation");
  const body = await parsed.response.json();

  assert.equal(body.message, "Tanggal tidak valid.");
  assert.equal(body.fieldErrors.effectiveFrom, "Tanggal tidak valid.");
});

test("client mempertahankan kode, field error, dan pesan validasi yang dapat ditindaklanjuti", async () => {
  const response = Response.json(
    {
      success: false,
      code: "VALIDATION_ERROR",
      message: "Periksa kembali data yang diisi.",
      fieldErrors: { effectiveFrom: "Tanggal efektif tidak valid." },
      requestId: "request-field",
    },
    { status: 400 },
  );

  await assert.rejects(
    () => readApiResponse(response),
    (error) => {
      assert.equal(error instanceof ApiRequestError, true);
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(error.message, "Tanggal efektif tidak valid.");
      assert.equal(error.fieldErrors.effectiveFrom, "Tanggal efektif tidak valid.");
      return true;
    },
  );
});

test("client menambahkan ID referensi pada error internal tanpa detail teknis", async () => {
  const response = Response.json(
    {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Terjadi kesalahan server. Silakan coba kembali.",
      requestId: "request-server",
    },
    { status: 500 },
  );

  await assert.rejects(
    () => readApiResponse(response),
    (error) => {
      assert.match(error.message, /ID referensi: request-server/);
      assert.doesNotMatch(error.message, /SELECT|stack|constraint/i);
      return true;
    },
  );
});

test("fieldErrors ditempelkan ke form dan field pertama diarahkan", async () => {
  const calls = { fields: null, scrolled: null, focused: null };
  const form = {
    setFields(value) {
      calls.fields = value;
    },
    scrollToField(value) {
      calls.scrolled = value;
    },
    focusField(value) {
      calls.focused = value;
    },
  };
  const error = new ApiRequestError({
    fieldErrors: {
      "assignment.effectiveFrom": "Tanggal efektif tidak valid.",
      documentFileId: "Dokumen penempatan wajib diunggah.",
    },
  });

  assert.equal(
    applyApiFieldErrors(form, error, { nonFocusableFields: ["documentFileId"] }),
    true,
  );
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.deepEqual(calls.fields[0].name, ["assignment", "effectiveFrom"]);
  assert.deepEqual(calls.scrolled, ["assignment", "effectiveFrom"]);
  assert.deepEqual(calls.focused, ["assignment", "effectiveFrom"]);
});

function collectAppSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? collectAppSourceFiles(path) : [path];
  });
}

test("form non-pegawai memakai komponen on/off terpusat", () => {
  const projectRoot = resolve(import.meta.dirname, "..");
  const appRoot = resolve(projectRoot, "app");
  const centralComponent = "app/components/forms/FormSettingSwitch.jsx";
  const violations = [];

  for (const file of collectAppSourceFiles(appRoot)) {
    if (![".jsx", ".tsx"].includes(extname(file))) continue;
    const projectPath = relative(projectRoot, file).replaceAll("\\", "/");
    if (projectPath === centralComponent || projectPath.includes("/components/employees/")) continue;
    if (/\bSwitch\b/.test(readFileSync(file, "utf8"))) violations.push(projectPath);
  }

  assert.deepEqual(
    violations,
    [],
    `Gunakan FormSettingSwitch, bukan Switch langsung: ${violations.join(", ")}`,
  );
});

test("komponen pusat mempertahankan nilai field lanjutan saat disembunyikan", () => {
  const source = readFileSync(
    new URL("../app/components/forms/FormSettingSwitch.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /valuePropName="checked"/);
  assert.match(source, /Form\.useWatch\(name, form\)/);
  assert.doesNotMatch(source, /preserve=\{false\}/);
  assert.match(source, /aria-describedby/);
});

test("hanya HRD dan Pimpinan dapat mengaitkan akun sendiri ke profil pegawai", () => {
  assert.equal(canLinkOwnEmployeeProfile("hrd"), true);
  assert.equal(canLinkOwnEmployeeProfile("leader"), true);
  assert.equal(canLinkOwnEmployeeProfile("employee"), false);
  assert.equal(canLinkOwnEmployeeProfile("superadmin"), false);
});

test("permintaan pengaitan profil hanya menerima ID pegawai yang valid", () => {
  assert.equal(selfProfileLinkSchema.safeParse({ employeeId: 42 }).success, true);
  assert.equal(selfProfileLinkSchema.safeParse({ employeeId: 0 }).success, false);
  assert.equal(
    selfProfileLinkSchema.safeParse({ employeeId: 42, roleCode: "hrd" }).success,
    false,
  );
});

test("service pengaitan profil membatasi organisasi, cakupan HRD, dan profil tanpa akun", () => {
  const source = readFileSync(new URL("../lib/account/service.js", import.meta.url), "utf8");

  assert.match(source, /assertCanLinkSelfProfile\(actor\)/);
  assert.match(source, /employee\.organization_id=\$1/);
  assert.match(source, /employee\.user_id IS NULL/);
  assert.match(source, /ensureActorEmployeeAccess\(actor, input\.employeeId/);
  assert.match(source, /action: "profile_self\.link"/);
});

test("identitas sidebar memakai nama dan jabatan hanya setelah profil pegawai terhubung", () => {
  const source = readFileSync(
    new URL("../app/components/navbar/SidebarContent.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /user\?\.identity_source === "employee"/);
  assert.match(source, /user\?\.position_name/);
  assert.match(source, /getInitials\(primaryIdentity\)/);
});

test("logout dan perubahan password menunggu backdrop minimum dua detik", async () => {
  assert.equal(DEFAULT_MINIMUM_LOADING_MS, 2000);

  const shellSource = readFileSync(
    new URL("../app/components/navbar/ProtectedShell.jsx", import.meta.url),
    "utf8",
  );
  const profileSource = readFileSync(
    new URL("../app/(protected)/profile/page.jsx", import.meta.url),
    "utf8",
  );
  assert.match(shellSource, /Promise\.all\(\[[\s\S]*waitForMinimumDuration\(startedAt\)/);
  assert.match(profileSource, /Password berhasil diubah\. Mengakhiri sesi/);
  assert.match(profileSource, /waitForMinimumDuration\(startedAt\)/);

  const startedAt = Date.now() - 50;
  await waitForMinimumDuration(startedAt, 10);
});
