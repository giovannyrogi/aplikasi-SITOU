import { redirect } from "next/navigation";
import { inventoryLegacyDestination } from "@/lib/inventory/navigation.mjs";
export default async function Page({ searchParams }) {
  redirect(inventoryLegacyDestination("master-data", await searchParams));
}
