"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import PageHeader from "@/app/components/layout/PageHeader";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import WarehousePanel from "./WarehousePanel";
import CatalogPanel from "./CatalogPanel";
/** Menjaga konteks organisasi URL dan mereset panel ketika organisasi berubah. */
export default function InventoryWorkspace({ section }) {
  const user = useAuthenticatedUser();
  const query = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { startNavigationLoading, finishNavigationLoading } = useLoadingBackdrop();
  const organizationId =
    user.role_code === "superadmin" ? query.get("organizationId") : String(user.organization_id);
  const queryString = query.toString();
  useEffect(() => {
    finishNavigationLoading();
  }, [queryString, finishNavigationLoading]);
  const organizationFilter =
    user.role_code === "superadmin" ? (
      <OrganizationSelect
        allowClear
        value={organizationId || undefined}
        onChange={(id) => {
          const params = new URLSearchParams();
          if (id) params.set("organizationId", id);
          startNavigationLoading({ message: "Memuat organisasi..." });
          router.push(pathname + (params.size ? `?${params}` : ""));
        }}
      />
    ) : null;
  if (["items", "categories", "units"].includes(section))
    return (
      <CatalogPanel
        key={`${organizationId}-${section}`}
        kind={section}
        organizationId={organizationId}
        organizationFilter={organizationFilter}
      />
    );
  if (section === "warehouses")
    return (
      <WarehousePanel
        key={organizationId || "empty"}
        organizationId={organizationId}
        organizationFilter={organizationFilter}
      />
    );
  return (
    <PageHeader
      title={
        { stock: "Stok Barang", transactions: "Transaksi Barang", reports: "Distribusi Barang" }[
          section
        ]
      }
    />
  );
}
