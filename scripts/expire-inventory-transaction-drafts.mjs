import dotenv from "dotenv";
import pg from "pg";

dotenv.config({path:process.env.NODE_ENV==="production"?".env.production":".env.development",quiet:true});
const client=new pg.Client({user:process.env.PGUSER,password:process.env.PGPASSWORD,host:process.env.PGHOST,database:process.env.PGDATABASE,port:Number(process.env.PGPORT||5432)});
let processed=0;
try {
  await client.connect();
  const candidates=(await client.query(`SELECT id,organization_id FROM inventory_transactions
    WHERE status='draft' AND draft_discarded_at IS NULL AND draft_expires_at<=now()
    ORDER BY draft_expires_at LIMIT 500`)).rows;
  for(const draft of candidates){
    try {
      await client.query("BEGIN");
      const locked=(await client.query(`SELECT id FROM inventory_transactions WHERE organization_id=$1 AND id=$2
        AND status='draft' AND draft_discarded_at IS NULL AND draft_expires_at<=now() FOR UPDATE`,[draft.organization_id,draft.id])).rows[0];
      if(!locked){await client.query("ROLLBACK");continue;}
      const files=(await client.query(`SELECT file.id::text,file.object_key FROM inventory_transaction_files linked
        JOIN stored_files file ON file.organization_id=linked.organization_id AND file.id=linked.file_id
        WHERE linked.organization_id=$1 AND linked.transaction_id=$2 AND file.lifecycle_status='draft' FOR UPDATE OF file`,[draft.organization_id,draft.id])).rows;
      await client.query("DELETE FROM inventory_transaction_files WHERE organization_id=$1 AND transaction_id=$2",[draft.organization_id,draft.id]);
      await client.query(`UPDATE stored_files SET lifecycle_status='deleted',deleted_at=now(),deletion_reason_code='draft_expired'
        WHERE organization_id=$1 AND inventory_transaction_draft_id=$2 AND lifecycle_status='draft'`,[draft.organization_id,draft.id]);
      await client.query(`UPDATE inventory_transactions SET draft_discarded_at=now(),draft_payload=NULL,updated_at=now()
        WHERE organization_id=$1 AND id=$2`,[draft.organization_id,draft.id]);
      await client.query(`INSERT INTO audit_logs(organization_id,action,entity_type,entity_id,after_data)
        VALUES($1,'inventory.transaction.draft_expire','inventory_transaction',$2,$3::jsonb)`,[draft.organization_id,draft.id,JSON.stringify({fileCount:files.length})]);
      for(const file of files)await client.query(`INSERT INTO file_purge_jobs(organization_id,stored_file_id,object_key)
        VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[draft.organization_id,file.id,file.object_key]);
      await client.query("COMMIT");
      processed++;
    }catch(error){await client.query("ROLLBACK").catch(()=>{});throw error;}
  }
  console.log(`${processed} draft transaksi barang kedaluwarsa diproses.`);
}finally{await client.end().catch(()=>{});}
