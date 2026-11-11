import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireRole } from "@/app/utils/auth";
import AttendanceSummaryReport from "@/app/components/reports/AttendanceSummaryReport";

export default async function AttendanceSummaryPage() {
  const { response } = await requireRole(["superadmin", "hrd"]);
  if (response) redirect("/dashboard");
  return (
    <Suspense fallback={<p>Memuat rekap…</p>}>
      <AttendanceSummaryReport />
    </Suspense>
  );
}
