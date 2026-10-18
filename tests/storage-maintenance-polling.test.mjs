import assert from "node:assert/strict";
import test from "node:test";
import { hasPendingStorageRun } from "../lib/storage-maintenance/polling.mjs";

test("polling penyimpanan hanya saat proses menunggu atau berjalan", () => {
  assert.equal(hasPendingStorageRun(null, []), false);
  assert.equal(hasPendingStorageRun({ active_run_count: 0 }, [{ status: "completed" }]), false);
  assert.equal(hasPendingStorageRun({ active_run_count: 1 }, []), true);
  assert.equal(hasPendingStorageRun({ active_run_count: 0 }, [{ status: "queued" }]), true);
  assert.equal(hasPendingStorageRun({ active_run_count: 0 }, [{ status: "running" }]), true);
});
