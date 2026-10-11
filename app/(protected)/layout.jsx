import { headers } from "next/headers";
import { canUseHrisRoute } from "@/lib/access/hrisPolicy.mjs";
import { pageAccessState } from "@/lib/access/liveAccessPolicy.mjs";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/app/utils/auth";
import ProtectedShell from "@/app/components/navbar/ProtectedShell";
import { getAccessSnapshot } from "@/lib/access/packages";

export default async function ProtectedLayout({ children }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const pathname = (await headers()).get("x-sitou-path") || "";
  if (!canUseHrisRoute(user, pathname, "GET")) redirect("/dashboard");
  const access = await getAccessSnapshot(user);
  if (!pageAccessState(user.role_code, access, pathname).canRead) redirect("/dashboard");

  return <ProtectedShell user={{ ...user, access }}>{children}</ProtectedShell>;
}
