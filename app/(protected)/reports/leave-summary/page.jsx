import { Suspense } from "react";
import LeaveSummaryReport from "@/app/components/reports/LeaveSummaryReport";
export default function LeaveSummaryPage() {
  return (
    <Suspense fallback={<p>Memuat rekap…</p>}>
      <LeaveSummaryReport />
    </Suspense>
  );
}
