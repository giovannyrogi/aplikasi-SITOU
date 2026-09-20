import dotenv from "dotenv";
import pg from "pg";
import { BIRTHDAY_SUMMARY_SQL } from "../lib/dashboard/birthdayQuery.mjs";

dotenv.config({ path: ".env.development", quiet: true });

const client = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

try {
  await client.connect();
  const result = await client.query(`
    WITH scenarios(name,as_of,birth_month,birth_day) AS (VALUES
      ('today','2026-09-20'::date,9,20),
      ('day_30','2026-09-20'::date,10,20),
      ('day_31','2026-09-20'::date,10,21),
      ('cross_year','2026-12-20'::date,1,5),
      ('feb_29_non_leap','2026-02-20'::date,2,29)
    ), calendar AS (
      SELECT scenario.name,scenario.as_of,day::date AS celebration_date,
        extract(month FROM day)::int AS birth_month,
        extract(day FROM day)::int AS birth_day,
        (day::date-scenario.as_of)::int AS days_until
      FROM scenarios scenario
      CROSS JOIN LATERAL generate_series(
        scenario.as_of,scenario.as_of+30,interval '1 day'
      ) AS value(day)
      UNION ALL
      SELECT scenario.name,scenario.as_of,day::date,2,29,
        (day::date-scenario.as_of)::int
      FROM scenarios scenario
      CROSS JOIN LATERAL generate_series(
        scenario.as_of,scenario.as_of+30,interval '1 day'
      ) AS value(day)
      WHERE extract(month FROM day)=2 AND extract(day FROM day)=28
        AND extract(day FROM (date_trunc('month',day)+interval '1 month - 1 day'))=28
    )
    SELECT scenario.name,calendar.celebration_date::text,calendar.days_until
    FROM scenarios scenario
    LEFT JOIN calendar ON calendar.name=scenario.name
      AND calendar.birth_month=scenario.birth_month
      AND calendar.birth_day=scenario.birth_day
    ORDER BY scenario.name
  `);
  const values = Object.fromEntries(result.rows.map((row) => [row.name, row]));
  if (values.today.days_until !== 0 || values.today.celebration_date !== "2026-09-20")
    throw new Error("Ulang tahun hari ini tidak dihitung dengan benar.");
  if (values.day_30.days_until !== 30 || values.day_30.celebration_date !== "2026-10-20")
    throw new Error("Batas inklusif hari ke-30 tidak dihitung dengan benar.");
  if (values.day_31.days_until !== null || values.day_31.celebration_date !== null)
    throw new Error("Hari ke-31 seharusnya berada di luar rentang.");
  if (values.cross_year.days_until !== 16 || values.cross_year.celebration_date !== "2027-01-05")
    throw new Error("Ulang tahun lintas tahun tidak dihitung dengan benar.");
  if (
    values.feb_29_non_leap.days_until !== 8 ||
    values.feb_29_non_leap.celebration_date !== "2026-02-28"
  )
    throw new Error("Ulang tahun 29 Februari pada tahun nonkabisat tidak dihitung benar.");
  const organization = await client.query(
    "SELECT id::text,timezone FROM organizations ORDER BY id LIMIT 1",
  );
  let productionRows = null;
  let scopedRows = null;
  if (organization.rows[0]) {
    const asOf = (
      await client.query("SELECT (now() AT TIME ZONE $1)::date::text AS value", [
        organization.rows[0].timezone,
      ])
    ).rows[0].value;
    productionRows = (
      await client.query(BIRTHDAY_SUMMARY_SQL, [organization.rows[0].id, asOf, null])
    ).rowCount;
    const location = await client.query(
      "SELECT id::text FROM locations WHERE organization_id=$1 AND is_active ORDER BY id LIMIT 1",
      [organization.rows[0].id],
    );
    if (location.rows[0]) {
      scopedRows = (
        await client.query(BIRTHDAY_SUMMARY_SQL, [
          organization.rows[0].id,
          asOf,
          [location.rows[0].id],
        ])
      ).rowCount;
      if (scopedRows > productionRows)
        throw new Error("Scope lokasi menghasilkan data melebihi seluruh organisasi.");
    }
  }
  console.log(
    JSON.stringify(
      {
        ready: true,
        scenarios: values,
        productionQueryRows: productionRows,
        scopedQueryRows: scopedRows,
      },
      null,
      2,
    ),
  );
} finally {
  await client.end().catch(() => {});
}
