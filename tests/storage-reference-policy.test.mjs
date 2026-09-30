import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { inspectFileUsage, inspectMaintenancePath } from "../lib/storage-maintenance/shared.mjs";
import { STORED_FILE_REFERENCES } from "../lib/storage-maintenance/policy.mjs";

test("referensi histori dan organisasi melindungi file di setiap kategori/status antivirus", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sitou-reference-"));
  try {
    await mkdir(path.join(root, "org_1"));
    await writeFile(path.join(root, "org_1", "file"), "fixture");
    const file = {
      id: "1",
      organization_id: "1",
      storage_provider: "local_private",
      object_key: "org_1/file",
      lifecycle_status: "active",
      created_at: "2020-01-01",
    };
    for (const reference of STORED_FILE_REFERENCES) {
      const db = {
        query: async (sql, params) => {
          assert.equal(params[0], "1");
          return { rows: sql.includes("FROM " + reference.table + "\n") ? [{ exists: 1 }] : [] };
        },
      };
      assert.equal(await inspectFileUsage(db, root, file), null, reference.label);
    }
    const unused = { query: async () => ({ rows: [] }) };
    for (const category of [
      "contract",
      "assignment_decree",
      "leave_attachment",
      "discipline_letter",
      "identity",
    ])
      for (const status of ["clean", "legacy_unscanned", "scan_error"])
        assert.equal(
          (await inspectFileUsage(unused, root, { ...file, category, malware_scan_status: status }))
            .status,
          "eligible",
        );
    assert.equal(
      (await inspectFileUsage(unused, root, { ...file, malware_scan_status: "infected" }))
        .reasonCode,
      "malware_infected",
    );
    assert.equal(
      await inspectFileUsage({ query: async () => ({ rows: [{ exists: 1 }] }) }, root, {
        ...file,
        lifecycle_status: "draft",
        onboarding_draft_id: "2",
      }),
      null,
    );
    assert.equal(
      (await inspectMaintenancePath(root, { ...file, object_key: "org_2/file" })).valid,
      false,
    );
    assert.equal(
      (await inspectMaintenancePath(root, { ...file, object_key: "org_1/../file" })).valid,
      false,
    );
    await symlink(path.join(root, "org_1"), path.join(root, "org_1", "link"), "junction");
    assert.equal(
      (await inspectMaintenancePath(path.join(root, "unmounted"), file)).reasonCode,
      "storage_unavailable",
    );
    assert.equal(
      (await inspectMaintenancePath(root, { ...file, object_key: "org_1/link/file" })).valid,
      false,
    );
  } finally {
    if (
      path.dirname(root) === path.resolve(os.tmpdir()) &&
      path.basename(root).startsWith("sitou-reference-")
    )
      await rm(root, { recursive: true, force: true });
  }
});
