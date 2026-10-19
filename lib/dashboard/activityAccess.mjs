import { dashboardActivityPresentation } from "./activityPresentation.mjs";
import { hrisLevel, accountCapabilities } from "../access/hrisPolicy.mjs";
import { dashboardSectionsFor } from "./accessPolicy.mjs";
import {
  ORGANIZATION_ACTIVITY_ACTIONS,
  formatDashboardActivity,
  formatDashboardActivitySubject,
} from "./config.mjs";

/** Satu filter izin untuk ringkasan dan modal riwayat aktivitas. */
export function dashboardActivityAccess(actor) {
  const allowed = new Set(dashboardSectionsFor(actor));
  const activityActions = ORGANIZATION_ACTIVITY_ACTIONS.filter((action) => {
    if (action === "login.success") return allowed.has("employees");
    if (
      action.startsWith("employee.") ||
      action.startsWith("employee_import.") ||
      action.startsWith("profile_self.") ||
      action.startsWith("employment_contract.") ||
      action.startsWith("employee_assignment.")
    )
      return allowed.has("employees");
    if (action.startsWith("discipline_") || action.startsWith("disciplinary_action."))
      return allowed.has("employees") || hrisLevel(actor, "disciplinary-actions-report");
    if (action.startsWith("leave_request.") || action.startsWith("leave_balance."))
      return allowed.has("leave");
    if (action.startsWith("organization_account."))
      return accountCapabilities(actor).canManageAccounts;
    if (action.startsWith("report."))
      return Boolean(
        hrisLevel(actor, "expiring-contracts-report") ||
        hrisLevel(actor, "retirement-report") ||
        hrisLevel(actor, "disciplinary-actions-report"),
      );
    if (action.startsWith("retirement_policy."))
      return Boolean(hrisLevel(actor, "retirement-policy"));
    const masters = {
      location: "master-locations",
      organization_unit: "master-organization-units",
      organization_unit_type: "master-organization-unit-types",
      position: "master-positions",
      employment_type: "master-employment-types",
      leave_type: "leave-settings",
      disciplinary_action_type: "disciplinary-action-settings",
    };
    return Boolean(hrisLevel(actor, masters[action.split(".")[0]]));
  });
  const reportKinds = [
    ["expiring-contracts", "expiring-contracts-report"],
    ["retirements", "retirement-report"],
    ["disciplinary-actions", "disciplinary-actions-report"],
  ]
    .filter(([, key]) => hrisLevel(actor, key))
    .map(([kind]) => kind);
  return {
    activityActions,
    reportKinds,
    canManageAllAccountRoles: accountCapabilities(actor).canManageAllAccountRoles,
  };
}

/** Menyiapkan label aktivitas audit tanpa mengirim payload audit sensitif ke browser. */
export function mapActivities(rows) {
  return rows.map((row) => ({
    id: row.id,
    ...dashboardActivityPresentation(row.action, row.entity_type),
    label: formatDashboardActivity(row.action, row.entity_type),
    actor: row.actor_name || "Sistem",
    subject: row.timezone ? formatDashboardActivitySubject(row) : null,
    timezone: row.timezone || "Asia/Makassar",
    occurredAt: row.occurred_at,
  }));
}
