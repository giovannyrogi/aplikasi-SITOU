import dotenv from "dotenv";
import pg from "pg";
import {
  purgeLocalObjects,
  quarantineLocalObjects,
  restoreLocalObjects,
} from "../lib/files/localLifecycle.mjs";

dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env.production" : ".env.development",
  quiet: true,
});

const client = new pg.Client({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT || 5432),
});

let processed = 0;
try {
  await client.connect();
  const candidates = await client.query(
    `SELECT id::text,organization_id::text
     FROM employee_onboarding_drafts
     WHERE status='active' AND expires_at<=now()
     ORDER BY id`,
  );
  for (const draft of candidates.rows) {
    let quarantined = [];
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        `SELECT id FROM employee_onboarding_drafts
         WHERE id=$1 AND organization_id=$2 AND status='active' AND expires_at<=now()
         FOR UPDATE`,
        [draft.id, draft.organization_id],
      );
      if (!locked.rows[0]) {
        await client.query("ROLLBACK");
        continue;
      }
      const files = await client.query(
        `SELECT id::text,object_key FROM stored_files
         WHERE organization_id=$1 AND onboarding_draft_id=$2
           AND lifecycle_status='draft' FOR UPDATE`,
        [draft.organization_id, draft.id],
      );
      quarantined = await quarantineLocalObjects(files.rows, "draft-expiry");
      await client.query(
        `UPDATE employee_onboarding_drafts SET status='expired',version=version+1
         WHERE id=$1 AND organization_id=$2`,
        [draft.id, draft.organization_id],
      );
      await client.query(
        `UPDATE stored_files
         SET lifecycle_status='deleted',deleted_at=now(),deletion_reason_code='draft_expired'
         WHERE organization_id=$1 AND onboarding_draft_id=$2 AND lifecycle_status='draft'`,
        [draft.organization_id, draft.id],
      );
      await client.query("COMMIT");
      await purgeLocalObjects(quarantined);
      await client.query(
        `UPDATE stored_files
         SET lifecycle_status='purged',content_purged_at=now()
         WHERE organization_id=$1 AND onboarding_draft_id=$2 AND lifecycle_status='deleted'`,
        [draft.organization_id, draft.id],
      );
      processed += 1;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      await restoreLocalObjects(quarantined).catch(() => {});
      throw error;
    }
  }
  console.log(`${processed} draft pegawai kedaluwarsa diproses.`);
} finally {
  await client.end().catch(() => {});
}
