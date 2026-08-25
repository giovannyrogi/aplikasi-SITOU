import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.development", quiet: true });

const client = new pg.Client({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT || 5432),
});

/** Memastikan operasi menghasilkan unique violation dan tidak lolos diam-diam. */
async function expectDuplicate(query, values) {
  await client.query("SAVEPOINT duplicate_check");
  try {
    await client.query(query, values);
    throw new Error("Database menerima identitas pegawai duplikat.");
  } catch (error) {
    if (error.code !== "23505") throw error;
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT duplicate_check");
  }
}

try {
  await client.connect();
  await client.query("BEGIN");
  const organization = await client.query("SELECT id FROM organizations ORDER BY id LIMIT 1");
  if (!organization.rows[0])
    throw new Error("Database development belum memiliki organisasi test.");
  const organizationId = organization.rows[0].id;
  const suffix = String(Date.now());
  const employeeNo = `IMP-${suffix}`;
  const nationalId = suffix.padStart(16, "0").slice(-16);
  await client.query(
    `INSERT INTO employees(organization_id,employee_no,full_name,national_id,employment_status,deleted_at)
     VALUES ($1,$2,'Pegawai Import Sintetis',$3,'draft',now())`,
    [organizationId, employeeNo, nationalId],
  );
  await expectDuplicate(
    "INSERT INTO employees(organization_id,employee_no,full_name,national_id) VALUES ($1,$2,'Duplikat Nomor',$3)",
    [organizationId, employeeNo.toLowerCase(), String(BigInt(nationalId) + 1n).padStart(16, "0")],
  );
  await expectDuplicate(
    "INSERT INTO employees(organization_id,employee_no,full_name,national_id) VALUES ($1,$2,'Duplikat NIK',$3)",
    [organizationId, `${employeeNo}-LAIN`, nationalId],
  );
  console.log("Constraint NIP dan NIK menolak duplikasi termasuk soft-deleted.");
} finally {
  await client.query("ROLLBACK").catch(() => {});
  await client.end().catch(() => {});
}
