import { connection } from "next/server";

export default async function AuthLayout({ children }) {
  // CSP nonces are generated per request, so auth pages must not be prerendered.
  await connection();
  return children;
}
