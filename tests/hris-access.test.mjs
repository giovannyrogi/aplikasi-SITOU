import test from "node:test";
import assert from "node:assert/strict";
import {
  HRIS_MENUS,
  canUseHrisRoute,
  canUseHrisFile,
  hrisLevel,
} from "../lib/access/hrisPolicy.mjs";
import { accountCreateSchema } from "../lib/access/schemas.js";
import { accountCapabilities } from "../lib/access/hrisPolicy.mjs";
import { MENU_LEAVES, validateMenuCatalog } from "../lib/access/menuCatalog.mjs";
import {
  dashboardSectionsFor,
  dashboardAccessFingerprint,
} from "../lib/dashboard/accessPolicy.mjs";
import {
  HRIS_MENU_DESCRIPTIONS,
  accountFeatureGroups,
  ACCOUNT_ACCESS_OPTIONS,
} from "../lib/access/accessDescriptions.mjs";

const actor = (grants = [], fullAdmin = false) => ({
  role_code: "hrd",
  hrisContext: { configured: true, fullAdmin, grants },
});

test("HRIS memakai katalog tertutup dan izin perubahan terpisah", () => {
  assert.equal(HRIS_MENUS.length, 14);
  const viewer = actor([{ key: "employees", level: "read" }]);
  assert.ok(canUseHrisRoute(viewer, "/employees/12", "GET"));
  assert.ok(canUseHrisRoute(viewer, "/api/employees/12/contracts", "GET"));
  assert.equal(canUseHrisRoute(viewer, "/api/employees/12/contracts", "PATCH"), false);
  assert.equal(canUseHrisRoute(viewer, "/api/employees/export", "GET"), false);
  assert.equal(canUseHrisRoute(viewer, "/leave-requests", "GET"), false);
  assert.equal(canUseHrisRoute(viewer, "/api/employees/12/leave-summary", "GET"), false);
  assert.equal(canUseHrisRoute(actor([], true), "/api/payroll", "GET"), false);
});

test("Admin penuh, legacy, dashboard kosong, dan akses fitur tetap terpisah", () => {
  assert.ok(canUseHrisRoute(actor([], true), "/access/accounts", "GET"));
  assert.equal(canUseHrisRoute(actor(), "/access/accounts", "GET"), false);
  assert.ok(canUseHrisRoute(actor(), "/dashboard", "GET"));
  assert.equal(canUseHrisRoute(actor(), "/api/dashboard/summary", "GET"), true);
  assert.ok(
    canUseHrisRoute({ role_code: "hrd", hrisContext: { configured: false } }, "/employees", "GET"),
  );
  assert.equal(hrisLevel({ role_code: "employee" }, "employees"), null);
  assert.ok(canUseHrisRoute(actor(), "/api/inventory/warehouses", "GET"));
  assert.equal(canUseHrisRoute(actor(), "/master-data/leave-types", "GET"), false);
});

test("Cuti tidak memberikan file KTP/KK atau metadata seluruh file", () => {
  const leave = actor([{ key: "leave-requests", level: "manage" }]);
  assert.ok(canUseHrisFile(leave, "leave_attachment"));
  assert.equal(canUseHrisFile(leave, "identity_document"), false);
  assert.equal(canUseHrisRoute(leave, "/api/uploads", "GET"), false);
  assert.ok(canUseHrisFile(leave, "employee_photo"));
  assert.ok(canUseHrisRoute(leave, "/api/leave-types", "GET"));
  assert.equal(canUseHrisRoute(leave, "/organization-settings/leave-types", "GET"), false);
  assert.equal(canUseHrisRoute(leave, "/master-data/leave-types", "GET"), false);
  const report = actor([{ key: "disciplinary-actions-report", level: "read" }]);
  assert.ok(canUseHrisRoute(report, "/api/employees/12/discipline-history", "GET"));
  assert.equal(canUseHrisRoute(report, "/api/employees/12", "GET"), false);
  assert.equal(canUseHrisRoute(leave, "/api/leave-types/2", "PATCH"), false);
});

test("Schema akun menolak duplikat, menu asing, dan pengelolaan laporan", () => {
  const base = {
    username: "uji_hrd",
    roleCode: "hrd",
    password: "Test_Pass1!",
    confirmPassword: "Test_Pass1!",
  };
  assert.ok(accountCreateSchema.safeParse({ ...base, hrisMenuAccess: [] }).success);
  for (const access of [
    [{ key: "payroll", level: "manage" }],
    [{ key: "dashboard", level: "manage" }],
    [
      { key: "employees", level: "read" },
      { key: "employees", level: "manage" },
    ],
  ])
    assert.equal(accountCreateSchema.safeParse({ ...base, hrisMenuAccess: access }).success, false);
  assert.equal(
    accountCreateSchema.safeParse({
      ...base,
      roleCode: "leader",
      hrisMenuAccess: [{ key: "employees", level: "read" }],
    }).success,
    false,
  );
});
test("CRUD akun terpisah dari delegasi non-HRIS dan administrasi HRIS penuh", () => {
  const manager = {
    ...actor(),
    hrisContext: {
      configured: true,
      grants: [],
      canManageEmployeeAccounts: true,
      canDelegateEmployeeFeatures: false,
    },
  };
  assert.equal(accountCapabilities(manager).canManageAccounts, true);
  assert.equal(accountCapabilities(manager).canDelegateNonHris, false);
  assert.equal(accountCapabilities(manager).canGrantHris, false);
  assert.ok(canUseHrisRoute(manager, "/api/access/accounts", "POST"));
  manager.hrisContext.canDelegateEmployeeFeatures = true;
  assert.equal(accountCapabilities(manager).canDelegateNonHris, true);
  assert.equal(accountCapabilities(manager).canGrantHris, false);
  assert.equal(accountCapabilities({ role_code: "employee" }).canManageAccounts, false);
});
test("Ringkasan menghitung fitur sekali dan seluruh pilihan mempunyai uraian", () => {
  const account = {
    hrisAccess: { grants: [], accountAccess: "manage" },
    packageAccess: [{ packageCode: "inventory_manager" }, { packageCode: "inventory_master" }],
  };
  assert.deepEqual(
    accountFeatureGroups(account).map((group) => group.key),
    ["hris", "inventory"],
  );
  assert.ok(HRIS_MENUS.every((menu) => HRIS_MENU_DESCRIPTIONS[menu.key]?.length > 10));
  assert.ok(ACCOUNT_ACCESS_OPTIONS.every((option) => option.description.length > 10));
});
test("Dashboard dasar tidak memberi akses data; cache mengikuti kombinasi izin", () => {
  assert.deepEqual(dashboardSectionsFor(actor([{ key: "dashboard", level: "read" }])), []);
  assert.equal(
    canUseHrisFile(actor([{ key: "dashboard", level: "read" }]), "employee_photo"),
    false,
  );
  assert.equal(
    canUseHrisRoute(actor([{ key: "dashboard", level: "read" }]), "/api/employees/options", "GET"),
    false,
  );
  const data = actor([{ key: "employees", level: "read" }]);
  const leave = actor([{ key: "leave-requests", level: "read" }]);
  assert.deepEqual(dashboardSectionsFor(data), [
    "employees",
    "contracts",
    "retirement",
    "discipline",
  ]);
  assert.deepEqual(dashboardSectionsFor(leave), ["leave"]);
  assert.notEqual(dashboardAccessFingerprint(data), dashboardAccessFingerprint(leave));
  assert.deepEqual(dashboardSectionsFor({ role_code: "employee" }), []);
  assert.equal(HRIS_MENUS.find((menu) => menu.key === "dashboard").assignable, false);
});
test("Katalog navigasi wajib memuat kontrak dan uraian untuk setiap menu", () => {
  assert.ok(validateMenuCatalog());
  assert.ok(
    MENU_LEAVES.every(
      (menu) => menu.access?.scope && menu.access.description && menu.access.delegation,
    ),
  );
  const rogue = { value: "missing-access", path: "/future", access: null };
  MENU_LEAVES.push(rogue);
  try {
    assert.throws(validateMenuCatalog, /belum lengkap/);
  } finally {
    MENU_LEAVES.pop();
  }
});
