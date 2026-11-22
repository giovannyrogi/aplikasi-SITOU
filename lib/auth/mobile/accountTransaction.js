import { withTransaction } from "@/lib/dbTransaction";
import { LoginError } from "../loginError";

/** Batasi antrean kunci akun sebelum batas respons klien mobile tercapai. */
export async function withMobileAccountTransaction(process) {
  try {
    return await withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '3s'");
      await client.query("SET LOCAL statement_timeout = '10s'");
      return process(client);
    });
  } catch (error) {
    if (error.code === "55P03" || error.code === "57014") {
      throw new LoginError(
        "ACCOUNT_BUSY",
        "Akun sedang diproses. Tunggu sebentar, lalu coba lagi.",
        503,
      );
    }
    throw error;
  }
}
