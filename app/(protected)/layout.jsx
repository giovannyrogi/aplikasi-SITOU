import { headers } from "next/headers";
import { canUseHrisRoute } from "@/lib/access/hrisPolicy.mjs";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/app/utils/auth";
import ProtectedShell from "@/app/components/navbar/ProtectedShell";
import { getAccessSnapshot } from "@/lib/access/packages";

export default async function ProtectedLayout({ children }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (!canUseHrisRoute(user, (await headers()).get("x-sitou-path") || "", "GET"))
    redirect("/dashboard");

  return (
    <ProtectedShell user={{ ...user, access: await getAccessSnapshot(user) }}>
      {children}
    </ProtectedShell>
  );
}
