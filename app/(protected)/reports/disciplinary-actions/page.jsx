import { Suspense } from "react";
import DisciplinaryReport from "@/app/components/reports/DisciplinaryReport";

export default function DisciplinaryActionsReportPage() {
  return (
    <Suspense fallback={<p>Memuat laporan…</p>}>
      <DisciplinaryReport />
    </Suspense>
  );
}
