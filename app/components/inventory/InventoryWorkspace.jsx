"use client";
import { useEffect } from "react";
import { Box } from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/app/components/layout/PageHeader";
import DetailTabs from "@/app/components/navigation/DetailTabs";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import WarehousePanel from "./WarehousePanel";
const TITLES = {
  stock: "Stok Barang",
  transactions: "Transaksi Barang",
  reports: "Laporan Distribusi",
  "master-data": "Data Master Inventaris",
};
export default function InventoryWorkspace({ section }) {
  const user = useAuthenticatedUser();
  const query = useSearchParams();
  const router = useRouter();
  const { startNavigationLoading, finishNavigationLoading } = useLoadingBackdrop();
  const organizationId =
    user.role_code === "superadmin" ? query.get("organizationId") : String(user.organization_id);
  const queryString = query.toString();
  useEffect(() => {
    finishNavigationLoading();
  }, [queryString, finishNavigationLoading]);
  const navigate = (key, value) => {
    const params = new URLSearchParams(queryString);
    params.set(key, value);
    startNavigationLoading({ message: "Membuka Inventaris..." });
    router.push(`/inventory/${section}?${params}`);
  };
  const activeTab = ["items", "categories", "units", "warehouses"].includes(query.get("tab"))
    ? query.get("tab")
    : "warehouses";
  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
      <PageHeader
        title={TITLES[section]}
        action={
          user.role_code === "superadmin" ? (
            <OrganizationSelect
              value={organizationId || undefined}
              onChange={(id) => navigate("organizationId", id)}
              style={{ width: "100%", minWidth: 220, maxWidth: 320 }}
            />
          ) : undefined
        }
      />
      {section === "master-data" && organizationId ? (
        <DetailTabs
          embedded
          ariaLabel="Data master Inventaris"
          activeKey={activeTab}
          onChange={(tab) => navigate("tab", tab)}
          items={[
            { key: "items", label: "Barang", children: null },
            { key: "categories", label: "Kategori", children: null },
            { key: "units", label: "Satuan", children: null },
            {
              key: "warehouses",
              label: "Gudang",
              children: <WarehousePanel key={organizationId} organizationId={organizationId} />,
            },
          ]}
        />
      ) : null}
    </Box>
  );
}
