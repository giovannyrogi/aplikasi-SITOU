import { Suspense } from "react";
import EmployeeReport from "@/app/components/reports/EmployeeReport";
/** Halaman pemantauan akhir kontrak dengan filter URL. */
export default function ContractReportPage() {
  return (
    <Suspense fallback={<p>Memuat laporan…</p>}>
      <EmployeeReport kind="expiring-contracts" />
    </Suspense>
  );
}
