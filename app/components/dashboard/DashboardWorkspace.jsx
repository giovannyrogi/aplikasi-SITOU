"use client";
import { useEffect, useCallback, cloneElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Box } from "@mui/material";
import DetailTabs from "@/app/components/navigation/DetailTabs";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import InventoryDashboard from "./InventoryDashboard";

export default function DashboardWorkspace({ initialAccess, children }) {
  const user = useAuthenticatedUser();
  const access = user.access || initialAccess;
  const query = useSearchParams(), router = useRouter(), pathname = usePathname();
  const visible = !!access?.inventoryVisible;
  const active = visible && query.get("tab") === "inventory" ? "inventory" : "dashboard";
  const change = useCallback((tab) => {
    const params = new URLSearchParams(query.toString());
    if (tab === "inventory") params.set("tab", tab); else params.delete("tab");
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  }, [pathname, query, router]);
  // Shell menjadi satu sumber snapshot izin, termasuk saat API menolak akses.
  const refresh = useCallback(() => window.dispatchEvent(new Event("sitou:permission-denied")), []);
  useEffect(() => { if (!visible && query.get("tab") === "inventory") change("dashboard"); }, [visible, query, change]);
  const navigation = visible ? <DetailTabs embedded underline ariaLabel="Tab Dashboard" activeKey={active} onChange={change}
    items={[{ key: "dashboard", label: "Dashboard" }, { key: "inventory", label: "Inventaris" }]} /> : null;
  return <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
    {active === "inventory" ? <InventoryDashboard navigation={navigation} onForbidden={refresh} /> : cloneElement(children, { navigation })}
  </Box>;
}
