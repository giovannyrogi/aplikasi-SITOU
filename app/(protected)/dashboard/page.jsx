import DashboardClient from "@/app/components/dashboard/DashboardClient";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/app/utils/auth";

/** Merender dashboard role-aware di dalam protected shell. */
export default async function DashboardPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  return <DashboardClient />;
}
