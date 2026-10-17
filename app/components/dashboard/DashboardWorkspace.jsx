"use client";
import { useEffect, useCallback, cloneElement } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Box, Skeleton } from "@mui/material";
import DetailTabs from "@/app/components/navigation/DetailTabs";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import InventoryDashboard from "./InventoryDashboard";
import EmployeeProfileBanner from "./EmployeeProfileBanner";
import useDashboardData from "./useDashboardData";
import ErrorState from "@/app/components/data-display/ErrorState";

export default function DashboardWorkspace({ initialAccess, children }) {
  const user = useAuthenticatedUser();
  const access = user.access || initialAccess;
  const employee = user.role_code === "employee";
  const employeeState = useDashboardData(employee ? "/api/dashboard/employee_self" : null);
  const accountState = useDashboardData(!employee && user.employee_id ? "/api/account/profile" : null);
  const query = useSearchParams(),
    pathname = usePathname();
  const visible = !!access?.inventoryVisible;
  const active = visible && query.get("tab") === "inventory" ? "inventory" : "dashboard";
  const change = useCallback(
    (tab) => {
      const params = new URLSearchParams(query.toString());
      if (tab === "inventory") params.set("tab", tab);
      else params.delete("tab");
      // Tab adalah state lokal workspace; history API menyelaraskan useSearchParams tanpa memuat ulang halaman server.
      window.history.replaceState(null, "", `${pathname}${params.size ? `?${params}` : ""}`);
    },
    [pathname, query],
  );
  // Shell menjadi satu sumber snapshot izin, termasuk saat API menolak akses.
  const refresh = useCallback(() => window.dispatchEvent(new Event("sitou:permission-denied")), []);
  useEffect(() => {
    if (!visible && query.get("tab") === "inventory") change("dashboard");
  }, [visible, query, change]);
  const navigation = visible ? (
    <DetailTabs
      embedded
      underline
      ariaLabel="Tab Dashboard"
      activeKey={active}
      onChange={change}
      items={[
        { key: "dashboard", label: "Dashboard" },
        { key: "inventory", label: "Inventaris" },
      ]}
    />
  ) : null;
  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
      {employee ? (
        employeeState.data ? (
          <EmployeeProfileBanner data={employeeState.data} user={user} />
        ) : employeeState.error ? (
          <ErrorState message={employeeState.error.message} onRetry={employeeState.retry} />
        ) : (
          <Skeleton variant="rounded" height={220} />
        )
      ) : (
        <EmployeeProfileBanner user={user} accountProfile={accountState.data} />
      )}
      {navigation}
      {active === "inventory" ? (
        <InventoryDashboard onForbidden={refresh} />
      ) : (
        cloneElement(children, {
          dashboardState: employeeState,
        })
      )}
    </Box>
  );
}
