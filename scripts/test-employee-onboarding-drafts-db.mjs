import crypto from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.development", quiet: true });

if (!process.env.PGDATABASE || /prod/i.test(process.env.PGDATABASE))
  throw new Error("Uji integrasi hanya boleh memakai database development.");

const client = new pg.Client({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT || 5432),
});

try {
  await client.connect();
  await client.query("BEGIN");

  // Membership nyata memastikan foreign key diuji tanpa membuat data identitas sintetis permanen.
  const membership = await client.query(`
    SELECT organization_id, user_id
    FROM user_organization_roles
    WHERE organization_id IS NOT NULL
    ORDER BY id
    LIMIT 1
  `);
  if (!membership.rowCount) throw new Error("Membership organisasi development tidak ditemukan.");

  const { organization_id: organizationId, user_id: userId } = membership.rows[0];
  await client.query(
    `UPDATE employee_onboarding_drafts
     SET status='discarded'
     WHERE organization_id=$1 AND created_by_user_id=$2 AND status IN ('active','finalizing')`,
    [organizationId, userId],
  );
  const inserted = await client.query(
    `INSERT INTO employee_onboarding_drafts(organization_id,created_by_user_id,payload)
     VALUES($1,$2,$3::jsonb)
     RETURNING id,version`,
    [organizationId, userId, JSON.stringify({ employeeNo: "ROLLBACK-ONLY" })],
  );
  const draft = inserted.rows[0];

  let duplicateRejected = false;
  await client.query("SAVEPOINT duplicate_draft");
  try {
    await client.query(
      `INSERT INTO employee_onboarding_drafts(organization_id,created_by_user_id)
       VALUES($1,$2)`,
      [organizationId, userId],
    );
  } catch (error) {
    duplicateRejected = error.code === "23505";
    await client.query("ROLLBACK TO SAVEPOINT duplicate_draft");
  }
  if (!duplicateRejected) throw new Error("Constraint satu draft aktif tidak bekerja.");

  // Metadata SK membuktikan kategori dan foreign key draft telah aktif.
  await client.query(
    `INSERT INTO stored_files(
       organization_id,onboarding_draft_id,object_key,original_name,mime_type,
       size_bytes,sha256,category,uploaded_by_user_id
     ) VALUES($1,$2,$3,$4,'application/pdf',4,$5,'assignment_decree',$6)`,
    [
      organizationId,
      draft.id,
      `integration/${crypto.randomUUID()}.pdf`,
      "integration.pdf",
      crypto.createHash("sha256").update("test").digest("hex"),
      userId,
    ],
  );

  const updated = await client.query(
    `UPDATE employee_onboarding_drafts
     SET current_step=1,version=version+1
     WHERE id=$1 AND organization_id=$2 AND version=$3
     RETURNING version`,
    [draft.id, organizationId, draft.version],
  );
  if (updated.rows[0]?.version !== draft.version + 1)
    throw new Error("Optimistic concurrency draft tidak bekerja.");

  console.log("Uji integrasi draft onboarding pegawai lulus (rollback).");
} finally {
  await client.query("ROLLBACK").catch(() => {});
  await client.end().catch(() => {});
}
