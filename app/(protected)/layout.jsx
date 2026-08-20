import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/app/utils/auth";
import ProtectedShell from "@/app/components/navbar/ProtectedShell";

export default async function ProtectedLayout({ children }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  return <ProtectedShell user={user}>{children}</ProtectedShell>;
}
