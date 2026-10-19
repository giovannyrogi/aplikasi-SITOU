import { createHmac, timingSafeEqual } from "node:crypto";
const sign = (body) =>
  createHmac("sha256", process.env.AUTH_SESSION_SECRET)
    .update(`dashboard-activity:${body}`)
    .digest("base64url");
export function encodeActivityCursor(row, scope) {
  const body = Buffer.from(
    JSON.stringify({
      v: 1,
      scope,
      time: row.cursor_time,
      id: row.id,
      expiresAt: Date.now() + 30 * 60 * 1000,
    }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}
/** Cursor terikat akun, organisasi, izin, dan lokasi; waktu mempertahankan mikrodetik PostgreSQL. */
export function decodeActivityCursor(value, scope) {
  if (!value) return null;
  try {
    if (typeof value !== "string" || value.length > 1500) throw new Error();
    const [body, signature, extra] = value.split(".");
    const expected = sign(body);
    if (
      extra ||
      !signature ||
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
      throw new Error();
    const cursor = JSON.parse(Buffer.from(body, "base64url").toString());
    if (
      cursor.v !== 1 ||
      cursor.scope !== scope ||
      !/^[1-9]\d{0,18}$/.test(cursor.id) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(cursor.time) ||
      !Number.isFinite(Date.parse(cursor.time)) ||
      !Number.isFinite(cursor.expiresAt) ||
      cursor.expiresAt <= Date.now()
    )
      throw new Error();
    return cursor;
  } catch {
    throw new Error("CURSOR_INVALID");
  }
}
