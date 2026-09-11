import { Suspense } from "react";
import EmployeeReport from "@/app/components/reports/EmployeeReport";
/** Halaman proyeksi pensiun dengan filter URL. */
export default function RetirementReportPage() {
  return (
    <Suspense fallback={<p>Memuat laporan…</p>}>
      <EmployeeReport kind="retirements" />
    </Suspense>
  );
}
