import EmployeeDetail from "@/app/components/employees/EmployeeDetail";

/** Route detail meneruskan ID ke komponen client agar session dan loading provider tetap digunakan. */
export default async function EmployeeDetailPage({ params }) {
  const { id } = await params;
  return <EmployeeDetail employeeId={id} />;
}
