import { redirect } from "next/navigation";

/** Route lama diarahkan ke pusat pengelolaan pegawai. */
export default function DisciplinePage() {
  redirect("/employees");
}
