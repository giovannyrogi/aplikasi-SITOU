import DashboardClient from "@/app/components/dashboard/DashboardClient";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/app/utils/auth";
import { getAccessSnapshot } from "@/lib/access/packages";
import { dashboardViews } from "@/lib/dashboard/navigation.mjs";

export default async function DashboardViewPage({ params }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const { view } = await params;
  const access = await getAccessSnapshot(user);
  if (!dashboardViews(user.role_code, access).includes(view)) redirect("/dashboard");
  return <DashboardClient view={view} />;
}
