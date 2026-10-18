import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Icon } from "@iconify/react/dist/offline";
import { MENU_DEFINITIONS } from "../lib/access/menuCatalog.mjs";
import { DASHBOARD_DESTINATIONS } from "../lib/dashboard/navigation.mjs";
import { LOCAL_ICON_DATA } from "../app/components/icons/localIconData.mjs";
import { NAVIGATION_ICON_SOURCES } from "../app/components/icons/navigationIconSources.mjs";

test("setiap menu dan ringkasan memakai data ikon Iconify lokal", () => {
  const menuIcons = MENU_DEFINITIONS.flatMap((menu) => [menu.icon, ...(menu.submenu || []).map((item) => item.icon)]);
  const dashboardIcons = Object.values(DASHBOARD_DESTINATIONS).map((item) => item.icon);
  for (const name of [...menuIcons, ...dashboardIcons]) {
    assert.ok(NAVIGATION_ICON_SOURCES[name], `Sumber ikon tidak terdaftar: ${name}`);
    assert.ok(LOCAL_ICON_DATA[name]?.body, `Data ikon lokal tidak tersedia: ${name}`);
    assert.ok(!LOCAL_ICON_DATA[name].body.includes("https://"), `Ikon memakai URL eksternal: ${name}`);
  }
});

test("seluruh ikon menu two-tone terisi; Dashboard bergerak dan menghormati pengurangan gerak", () => {
  assert.ok(LOCAL_ICON_DATA["navigation:dashboard-static"]?.body);
  for (const [name, source] of Object.entries(NAVIGATION_ICON_SOURCES)) {
    assert.match(source, /^solar:.*-bold-duotone$/, `Gaya ikon tidak konsisten: ${name}`);
    assert.match(LOCAL_ICON_DATA[name].body, /opacity/, `Ikon tidak memiliki dua tone: ${name}`);
  }
  const menuSources = MENU_DEFINITIONS.map((menu) => NAVIGATION_ICON_SOURCES[menu.icon]);
  assert.equal(new Set(menuSources).size, menuSources.length, "Ikon menu utama harus berbeda");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /animation: app-dashboard-icon-pulse [^;]* infinite;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.app-dashboard-icon-static\s*\{\s*display: inline-block;/);
});

test("komponen Iconify offline merender SVG langsung tanpa permintaan API", () => {
  const markup = renderToStaticMarkup(React.createElement(Icon, {
    icon: LOCAL_ICON_DATA["navigation:dashboard"],
  }));
  assert.match(markup, /^<svg /);
  assert.match(markup, /opacity/);
  assert.doesNotMatch(markup, /https?:\/\/api\.iconify/);
});

test("ikon akun dan notifikasi memakai SVG two-tone lokal", () => {
  for (const name of ["account:notifications", "account:profile", "account:logout"]) {
    assert.match(NAVIGATION_ICON_SOURCES[name], /^solar:.*-bold-duotone$/);
    const data = LOCAL_ICON_DATA[name];
    assert.ok(data?.body, `Data ikon lokal tidak tersedia: ${name}`);
    assert.match(data.body, /opacity/, `Ikon tidak memiliki dua tone: ${name}`);
    const markup = renderToStaticMarkup(React.createElement(Icon, { icon: data }));
    assert.match(markup, /^<svg /);
    assert.doesNotMatch(markup, /https?:\/\/api\.iconify/);
  }
});

test("ikon Ringkasan Pribadi berbeda dari ikon Profil", () => {
  assert.equal(DASHBOARD_DESTINATIONS.staff.label, "Ringkasan Kepegawaian");
  assert.notEqual(
    NAVIGATION_ICON_SOURCES["navigation:dashboard-personal"],
    NAVIGATION_ICON_SOURCES["account:profile"],
  );
});
