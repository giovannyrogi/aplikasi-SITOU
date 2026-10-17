import { createHmac, timingSafeEqual } from "node:crypto";
import pool from "@/lib/dbConfig";
import { ServiceError } from "@/lib/api/routeHelpers";
import { requireSelfDisciplineAccess } from "./selfAccess";

const sign = (body) =>
  createHmac("sha256", process.env.AUTH_SESSION_SECRET).update(body).digest("base64url");
function decodeCursor(value, actor) {
  if (!value) return null;
  try {
    if (value.length > 1500) throw new Error();
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
      cursor.version !== 1 ||
      cursor.user !== String(actor.id) ||
      cursor.organization !== String(actor.organization_id) ||
      !/^[1-9]\d{0,18}$/.test(cursor.id) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(cursor.date) ||
      !Number.isFinite(Date.parse(cursor.date))
    )
      throw new Error();
    return cursor;
  } catch {
    throw new ServiceError(
      "CURSOR_INVALID",
      "Riwayat berubah. Buka kembali dari halaman pertama.",
      400,
    );
  }
}

/** Riwayat resmi milik sesi, satu snapshot query dengan keyset tanggal terbit + ID. */
export async function readOwnDisciplineHistory(actor, encoded, database = pool) {
  await requireSelfDisciplineAccess(actor, actor.organization_id, database);
  const cursor = decodeCursor(encoded, actor);
  const {
    rows: [result],
  } = await database.query(
    `WITH official AS (
    SELECT a.id,a.discipline_case_id::text AS case_id,a.action_name_snapshot AS name,
      a.issued_date,to_char(a.effective_from,'YYYY-MM-DD') AS start_date,
      to_char(a.effective_until,'YYYY-MM-DD') AS end_date,
      CASE WHEN a.status='active' AND a.effective_until<(now() AT TIME ZONE o.timezone)::date THEN 'expired'
        WHEN a.status='active' AND a.effective_from>(now() AT TIME ZONE o.timezone)::date THEN 'scheduled' ELSE a.status END AS status
    FROM disciplinary_actions a JOIN employees e ON e.organization_id=a.organization_id AND e.id=a.employee_id
    JOIN organizations o ON o.id=a.organization_id
    WHERE a.organization_id=$1 AND e.user_id=$2 AND e.deleted_at IS NULL AND a.status<>'draft'
  ), page AS (
    SELECT id::text,case_id,name,to_char(issued_date,'YYYY-MM-DD') AS issued_date,start_date,end_date,status
    FROM official source WHERE ($3::date IS NULL OR (source.issued_date,source.id)<($3::date,$4::bigint))
    ORDER BY source.issued_date DESC,source.id DESC LIMIT 11
  ) SELECT (SELECT count(*)::int FROM official) AS total,
    (SELECT count(*)::int FROM official WHERE status='active') AS active,
    COALESCE((SELECT jsonb_agg(page ORDER BY issued_date DESC,id::bigint DESC) FROM page),'[]'::jsonb) AS items`,
    [actor.organization_id, actor.id, cursor?.date || null, cursor?.id || null],
  );
  const hasMore = result.items.length > 10;
  const items = result.items.slice(0, 10);
  let next = null;
  if (hasMore) {
    const last = items.at(-1);
    const body = Buffer.from(
      JSON.stringify({
        version: 1,
        user: String(actor.id),
        organization: String(actor.organization_id),
        date: last.issued_date,
        id: last.id,
      }),
    ).toString("base64url");
    next = `${body}.${sign(body)}`;
  }
  return { items, active: result.active, total: result.total, next };
}
