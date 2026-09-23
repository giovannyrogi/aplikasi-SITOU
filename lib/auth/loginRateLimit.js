import { createHash } from "node:crypto";
import pool from "@/lib/dbConfig";

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const ACTION = "auth.login.failed";

const normalizeKey = (ipAddress, username) =>
  createHash("sha256")
    .update(`${String(ipAddress || "unknown").trim()}::${String(username || "").trim().toLowerCase()}`)
    .digest("hex");

const windowStart = () => new Date(Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS);

export async function checkLoginRateLimit(ipAddress, username) {
  const startedAt = windowStart();
  const result = await pool.query(
    `SELECT request_count FROM security_rate_limit_buckets
     WHERE action=$1 AND bucket_key=$2 AND window_started_at=$3`,
    [ACTION, normalizeKey(ipAddress, username), startedAt],
  );
  const count = Number(result.rows[0]?.request_count || 0);
  return {
    allowed: count < MAX_FAILED_ATTEMPTS,
    retryAfter: count < MAX_FAILED_ATTEMPTS
      ? 0
      : Math.max(1, Math.ceil((startedAt.getTime() + WINDOW_MS - Date.now()) / 1000)),
  };
}

export async function recordLoginFailure(ipAddress, username) {
  const startedAt = windowStart();
  await pool.query(
    `INSERT INTO security_rate_limit_buckets
      (action,bucket_key,window_started_at,request_count,expires_at)
     VALUES($1,$2,$3,1,$4)
     ON CONFLICT(action,bucket_key,window_started_at)
     DO UPDATE SET request_count=security_rate_limit_buckets.request_count+1`,
    [ACTION, normalizeKey(ipAddress, username), startedAt, new Date(startedAt.getTime() + WINDOW_MS * 2)],
  );
}

export async function clearLoginFailures(ipAddress, username) {
  await pool.query(
    `DELETE FROM security_rate_limit_buckets WHERE action=$1 AND bucket_key=$2`,
    [ACTION, normalizeKey(ipAddress, username)],
  );
}
