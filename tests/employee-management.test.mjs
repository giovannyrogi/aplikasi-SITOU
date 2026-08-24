import test from "node:test";
import assert from "node:assert/strict";
import { accountCreateSchema, accountPasswordSchema } from "../lib/access/schemas.js";
import { employeeProfileSectionsSchema } from "../lib/employees/profileSchemas.js";
import { disciplinaryActionCreateSchema } from "../lib/discipline/schemas.js";
import {
  assignmentSchema,
  contractSchema,
  employeeContractCancellationSchema,
  employeeContractCorrectionSchema,
  employeeDraftSaveSchema,
} from "../lib/employees/schemas.js";

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

test("akun Karyawan wajib ditautkan ke profil pegawai", () => {
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
    currentStep: 1,
    version: 1,
    payload: {
      employeeNo: "PGW-001",
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
