import DashboardClient from "@/app/components/dashboard/DashboardClient";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/app/utils/auth";
import { getAccessSnapshot } from "@/lib/access/packages";
import { DASHBOARD_DESTINATIONS, defaultDashboardView } from "@/lib/dashboard/navigation.mjs";

/** Tautan lama dan tujuan login selalu menuju ringkasan pertama yang berizin. */
export default async function DashboardPage({ searchParams }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const access = await getAccessSnapshot(user);
  const params = await searchParams;
  const view = params?.tab === "inventory" && access.inventoryVisible
    ? "inventory" : defaultDashboardView(user.role_code, access);
  if (view) redirect(DASHBOARD_DESTINATIONS[view].path);
  return <DashboardClient view={null} />;
}
