"use client";
import { useCallback, cloneElement } from "react";
import { Box, Skeleton } from "@mui/material";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import InventoryDashboard from "./InventoryDashboard";
import EmployeeProfileBanner from "./EmployeeProfileBanner";
import useDashboardData from "./useDashboardData";
import ErrorState from "@/app/components/data-display/ErrorState";
import FontStyle from "@/app/components/font-style/FontStyle";

export default function DashboardWorkspace({ view, children }) {
  const user = useAuthenticatedUser();
  const employee = user.role_code === "employee";
  const employeeState = useDashboardData(
    view === "personal" || (employee && view === "inventory")
      ? "/api/dashboard/employee_self"
      : null,
    { blocking: true },
  );
  const accountState = useDashboardData(
    !employee && user.access?.personalVisible ? "/api/account/profile" : null,
    { blocking: true },
  );
  // Shell menjadi satu sumber snapshot izin, termasuk saat API menolak akses.
  const refresh = useCallback(() => window.dispatchEvent(new Event("sitou:permission-denied")), []);
  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
      {employee && view ? (
        employeeState.data ? (
          <EmployeeProfileBanner data={employeeState.data} user={user} />
        ) : employeeState.error ? (
          <EmployeeProfileBanner user={user} />
        ) : (
          <Skeleton variant="rounded" height={220} />
        )
      ) : (
        <EmployeeProfileBanner user={user} accountProfile={accountState.data} />
      )}
      {view === "inventory" ? (
        <InventoryDashboard onForbidden={refresh} />
      ) : !view ? (
        <FontStyle sx={{ color: "text.secondary" }}>
          Belum ada ringkasan yang dapat dibuka. Minta pengelola akses memberikan izin yang
          diperlukan.
        </FontStyle>
      ) : view === "personal" && employeeState.error ? (
        <ErrorState message={employeeState.error.message} onRetry={employeeState.retry} />
      ) : children && view === "personal" ? (
        cloneElement(children, {
          dashboardState: employeeState,
        })
      ) : (
        children
      )}
    </Box>
  );
}
