import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relative) => readFileSync(new URL("../" + relative, import.meta.url), "utf8");

test("migration 032 menyediakan purge queue, malware status, dan rate limit persisten", () => {
  const migration = read("database/migrations/20260922_032_production_security_hardening.sql");
  assert.match(migration, /CREATE TABLE file_purge_jobs/);
  assert.match(migration, /malware_scan_status/);
  assert.match(migration, /CREATE TABLE security_rate_limit_buckets/);
  assert.match(migration, /uq_file_purge_jobs_pending_file/);
});

test("lifecycle mengantrekan purge di transaksi tanpa karantina byte sebelum commit", () => {
  const storage = read("lib/files/storage.js");
  const start = storage.indexOf("export async function stageStoredFilesForDeletion");
  const end = storage.indexOf("export async function restoreStagedStoredFiles", start);
  const implementation = storage.slice(start, end);
  assert.match(implementation, /enqueuePurgeJobs/);
  assert.doesNotMatch(implementation, /quarantineStoredFiles/);
  assert.match(storage, /export async function purgeStagedStoredFiles\(\) \{\}/);
});

test("seluruh multipart memakai parser streaming privat dan upload umum ditutup", () => {
  const multipart = read("lib/api/multipart.js");
  const allRoutes = [
    "app/api/employees/[id]/route.js",
    "app/api/employees/[id]/profile/route.js",
    "app/api/employees/imports/route.js",
    "app/api/employees/drafts/[id]/files/route.js",
  ].map(read).join("\n");
  assert.match(multipart, /Readable\.fromWeb\(request\.body\)/);
  assert.match(multipart, /maxTotalFileSize/);
  assert.doesNotMatch(allRoutes, /request\.formData\(/);
  assert.match(read("app/api/uploads/route.js"), /UPLOAD_ENDPOINT_DISABLED/);
});

test("ringkasan identitas memakai ukuran tetap dan object fit contain", () => {
  const detail = read("app/components/employees/EmployeeDetail.jsx");
  assert.match(detail, /xl: "135px 286px 286px"/);
  assert.match(detail, /frameWidth=\{135\}/);
  assert.equal((detail.match(/frameWidth=\{286\}/g) || []).length, 2);
  assert.match(detail, /objectFit="contain"/);
  assert.match(detail, /aria-label=\{`Perbesar/);
});

test("akses histori dan disiplin memeriksa scope pegawai", () => {
  assert.match(read("app/api/employees/[id]/contracts/route.js"), /ensureActorEmployeeAccess/);
  assert.match(read("app/api/employees/[id]/assignments/route.js"), /ensureActorEmployeeAccess/);
  const discipline = read("lib/discipline/service.js");
  assert.match(discipline, /getDisciplineCaseForActor[\s\S]*ensureActorEmployeeAccess/);
});

test("CSP meneruskan nonce yang sama ke renderer Next.js dan respons browser", () => {
  const proxy = read("proxy.js");
  assert.match(
    proxy,
    /requestHeaders\.set\("Content-Security-Policy", contentSecurityPolicy\)/,
  );
  assert.match(
    proxy,
    /response\.headers\.set\("Content-Security-Policy", contentSecurityPolicy\)/,
  );
  assert.match(proxy, /requestHeaders\.set\("x-nonce", nonce\)/);
});

test("ikon antarmuka dibundel lokal tanpa koneksi Iconify", () => {
  const packageJson = read("package.json");
  const appIcon = read("app/components/icons/AppIcon.jsx");
  const menu = read("app/components/menu/MenuConfig.jsx");
  assert.doesNotMatch(packageJson, /@iconify\/react/);
  assert.match(appIcon, /from "@ant-design\/icons"/);
  assert.match(menu, /AppIcon/);
  const navigationIcons = [...menu.matchAll(/icon="(navigation:[^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.equal(new Set(navigationIcons).size, navigationIcons.length);
  const mappedComponents = [
    ...appIcon.matchAll(/"navigation:[^"]+": ([A-Za-z]+),/g),
  ].map((match) => match[1]);
  assert.equal(new Set(mappedComponents).size, mappedComponents.length);
});
