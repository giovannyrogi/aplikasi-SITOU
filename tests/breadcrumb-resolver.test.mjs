import assert from "node:assert/strict";
import test from "node:test";
import { resolveMenuBreadcrumbs } from "../app/components/navigation/resolveMenuBreadcrumbs.mjs";

const menus = [
  { label: "Dashboard", value: "dashboard", path: "/dashboard" },
  {
    label: "Data Master",
    value: "master-data",
    submenu: [
      { label: "Organisasi", value: "organizations", path: "/master-data/organizations" },
      { label: "Lokasi", value: "locations", path: "/master-data/locations" },
      {
        label: "Jenis Unit Organisasi",
        value: "organization-unit-types",
        path: "/master-data/organization-unit-types",
      },
    ],
  },
  {
    label: "Pengaturan Organisasi",
    value: "organization-settings",
    submenu: [
      {
        label: "Aturan Cuti & Izin",
        value: "leave-settings",
        path: "/organization-settings/leave-types",
      },
    ],
  },
];

test("route menu utama menghasilkan satu breadcrumb", () => {
  const result = resolveMenuBreadcrumbs(menus, "/dashboard");
  assert.deepEqual(
    result.map((item) => item.label),
    ["Dashboard"],
  );
});

test("submenu menyertakan parent tanpa path", () => {
  const result = resolveMenuBreadcrumbs(menus, "/master-data/organizations");
  assert.deepEqual(
    result.map((item) => item.label),
    ["Data Master", "Organisasi"],
  );
});

test("route turunan mengikuti submenu terdekat", () => {
  const result = resolveMenuBreadcrumbs(menus, "/master-data/locations/123/edit");
  assert.deepEqual(
    result.map((item) => item.label),
    ["Data Master", "Lokasi"],
  );
});

test("menu jenis unit menghasilkan breadcrumb Data Master yang tepat", () => {
  const result = resolveMenuBreadcrumbs(menus, "/master-data/organization-unit-types");
  assert.deepEqual(
    result.map((item) => item.label),
    ["Data Master", "Jenis Unit Organisasi"],
  );
});

test("aturan cuti dan izin menghasilkan breadcrumb Pengaturan Organisasi", () => {
  const result = resolveMenuBreadcrumbs(menus, "/organization-settings/leave-types");
  assert.deepEqual(
    result.map((item) => item.label),
    ["Pengaturan Organisasi", "Aturan Cuti & Izin"],
  );
});

test("route yang tidak terdaftar tidak menebak breadcrumb", () => {
  assert.deepEqual(resolveMenuBreadcrumbs(menus, "/halaman-baru"), []);
});
