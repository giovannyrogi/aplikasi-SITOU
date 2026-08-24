import test from "node:test";
import assert from "node:assert/strict";
import { selfPasswordSchema, selfProfileUpdateSchema } from "../lib/account/schemas.js";

test("profil platform menerima identitas platform tanpa field kredensial", () => {
  const result = selfProfileUpdateSchema.safeParse({
    fullName: "Super Administrator",
    email: "admin@sitou.local",
    whatsapp: "+628123456789",
  });
  assert.equal(result.success, true);
});

test("profil mandiri menolak username dari payload update", () => {
  const result = selfProfileUpdateSchema.safeParse({
    preferredName: "Gio",
    username: "tidak-boleh-diubah",
  });
  assert.equal(result.success, false);
});

test("ganti password membutuhkan konfirmasi yang sama", () => {
  const result = selfPasswordSchema.safeParse({
    currentPassword: "Lama#123",
    newPassword: "Baru#123",
    confirmPassword: "Beda#123",
  });
  assert.equal(result.success, false);
});
