import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/app/utils/auth";

/** Kompatibilitas tautan lama; seluruh dashboard kini berada pada rute terpusat. */
export default async function EmployeeDashboardPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  redirect("/dashboard");
}
