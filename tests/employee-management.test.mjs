import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accountCreateSchema, accountPasswordSchema } from "../lib/access/schemas.js";
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
  employeeCreateSchema,
  employeeContractCancellationSchema,
  employeeContractCorrectionSchema,
  employeeDraftSaveSchema,
} from "../lib/employees/schemas.js";
import {
  isValidIndonesianNationalId,
  normalizeIndonesianNationalId,
  optionalIndonesianNationalIdSchema,
} from "../lib/validation/indonesianNationalId.js";
import { validateRequestOrigin } from "../lib/api/routeHelpers.js";

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
    decreeNo: "SK-001",
    documentFileId: 1,
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
test("koreksi kontrak memakai versi dan tetap mewajibkan dokumen", () => {
  const result = employeeContractCorrectionSchema.safeParse({
    organizationId: 1,
    employmentTypeId: 1,
    contractNo: "PKWT-001",
    startDate: "2026-08-22",
    documentFileId: 10,
    version: "2026-08-23T00:00:00.000Z",
  });
  assert.equal(result.success, true);
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

test("penempatan wajib memiliki nomor dan dokumen SK", () => {
  const result = assignmentSchema.safeParse({
    locationId: 1,
    organizationUnitId: 2,
    effectiveFrom: "2026-08-22",
  });
  assert.equal(result.success, false);
  assert.deepEqual(
    result.error.issues.map((issue) => issue.path.join(".")),
    ["decreeNo", "documentFileId"],
  );
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
