import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseMultipartToPrivateTemp } from "../lib/api/multipart.js";

test("multipart chunked diproses ke storage privat dan cleanup menghapus temporary file", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sitou-multipart-"));
  const previousRoot = process.env.UPLOAD_ROOT;
  process.env.UPLOAD_ROOT = root;
  try {
    const body = new FormData();
    body.set("payload", JSON.stringify({ action: "replace" }));
    body.set("file", new Blob([Buffer.from("file-test")], { type: "application/pdf" }), "test.pdf");
    const request = new Request("http://localhost/api/employees/1/contracts", {
      method: "POST",
      body,
    });
    assert.equal(request.headers.has("content-length"), false);

    const parsed = await parseMultipartToPrivateTemp(request);
    assert.equal(parsed.get("payload"), JSON.stringify({ action: "replace" }));
    assert.equal(Buffer.from(await parsed.get("file").arrayBuffer()).toString(), "file-test");
    await parsed.cleanup();

    const temporaryDirectory = path.join(root, ".tmp", "multipart");
    assert.deepEqual(await readdir(temporaryDirectory), []);
  } finally {
    if (previousRoot === undefined) delete process.env.UPLOAD_ROOT;
    else process.env.UPLOAD_ROOT = previousRoot;
    await rm(root, { recursive: true, force: true });
  }
});

test("cleanup multipart idempotent walaupun file belum dibaca", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sitou-multipart-"));
  const previousRoot = process.env.UPLOAD_ROOT;
  process.env.UPLOAD_ROOT = root;
  try {
    const body = new FormData();
    body.set("payload", "{}");
    body.set("file", new Blob([Buffer.from("unused")]), "unused.bin");
    const parsed = await parseMultipartToPrivateTemp(
      new Request("http://localhost/api/employees/imports", { method: "POST", body }),
    );
    await parsed.cleanup();
    await parsed.cleanup();
    assert.deepEqual(await readdir(path.join(root, ".tmp", "multipart")), []);
  } finally {
    if (previousRoot === undefined) delete process.env.UPLOAD_ROOT;
    else process.env.UPLOAD_ROOT = previousRoot;
    await rm(root, { recursive: true, force: true });
  }
});
