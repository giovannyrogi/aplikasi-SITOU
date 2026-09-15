import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions";
import RetirementPolicy from "@/app/components/organization-settings/RetirementPolicy";

/** Pengaturan organisasi hanya tersedia untuk role dan permission pembaca kebijakan. */
export default async function RetirementPolicyPage() {
  const { user, response } = await requirePermission("retirement_policy.read");
  if (response || !["superadmin", "hrd", "leader"].includes(user?.role_code))
    redirect("/dashboard");
  return (
    <Suspense fallback={<p>Memuat kebijakan pensiun…</p>}>
      <RetirementPolicy />
    </Suspense>
  );
}
