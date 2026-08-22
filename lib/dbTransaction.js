import pool from "@/lib/dbConfig";

/** Menjalankan use case multi-query secara atomik dan selalu melepas koneksi pool. */
export async function withTransaction(process) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await process(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
