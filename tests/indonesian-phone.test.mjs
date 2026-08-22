import assert from "node:assert/strict";
import test from "node:test";
import {
  getIndonesianMobileLocalValue,
  isValidIndonesianMobile,
  normalizeIndonesianMobile,
  optionalIndonesianMobileSchema,
} from "../lib/validation/indonesianPhone.js";

test("normalisasi nomor Indonesia menghasilkan format E.164 yang konsisten", () => {
  assert.equal(normalizeIndonesianMobile("0821-2345-6789"), "+6282123456789");
  assert.equal(normalizeIndonesianMobile("6282123456789"), "+6282123456789");
  assert.equal(normalizeIndonesianMobile("+62 821 2345 6789"), "+6282123456789");
  assert.equal(normalizeIndonesianMobile("82123456789"), "+6282123456789");
  assert.equal(normalizeIndonesianMobile(""), null);
});

test("validator menolak nomor non-seluler dan panjang yang tidak wajar", () => {
  assert.equal(isValidIndonesianMobile("82123456789"), true);
  assert.equal(isValidIndonesianMobile("0215551234"), false);
  assert.equal(isValidIndonesianMobile("8123"), false);
  assert.equal(optionalIndonesianMobileSchema.safeParse("nomor-rahasia").success, false);
});

test("nilai input lokal tidak membawa prefix +62 ke field yang diketik pengguna", () => {
  assert.equal(getIndonesianMobileLocalValue("+6282123456789"), "82123456789");
});
