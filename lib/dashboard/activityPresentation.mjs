/** Naikkan saat kontrak ikon/tone berubah agar snapshot dashboard lama tidak dipakai kembali. */
export const ACTIVITY_PRESENTATION_VERSION = 1;

/** Ikon semantik dan tone tema bersama: warna melengkapi label, tidak menggantikannya. */
export function dashboardActivityPresentation(action = "", entityType = "") {
  if (action === "login.success") return { icon: "activity:login", tone: "success" };
  if (action.includes("password")) return { icon: "activity:security", tone: "warning" };
  if (action.includes("export")) return { icon: "activity:export", tone: "info" };
  if (action.startsWith("employee_import.")) return { icon: "activity:import", tone: "secondary" };
  if (action.endsWith(".revoke")) return { icon: "activity:revoke", tone: "secondary" };
  if (action.endsWith(".cancel") || action.endsWith(".deactivate"))
    return { icon: "activity:cancel", tone: "warning" };
  if (action.endsWith(".expire") || action.endsWith(".supersede"))
    return { icon: "activity:history", tone: "neutral" };
  if (action === "employee.terminate") return { icon: "activity:terminate", tone: "danger" };
  if (action === "leave_request.approve") return { icon: "activity:leave", tone: "success" };
  if (action.startsWith("leave_balance.")) return { icon: "activity:balance", tone: "secondary" };
  if (action.startsWith("disciplinary_action."))
    return { icon: "activity:discipline", tone: "warning" };
  if (action.startsWith("discipline_case.")) return { icon: "activity:case", tone: "warning" };
  if (action.endsWith(".correct")) return { icon: "activity:edit", tone: "info" };
  if (
    ["employee.update", "employee.profile_sections.update", "profile_self.update"].includes(action)
  )
    return { icon: "activity:edit", tone: "info" };
  if (action.startsWith("employment_contract.")) return { icon: "activity:contract", tone: "info" };
  if (action === "employee.create") return { icon: "activity:employee-add", tone: "success" };
  if (action.startsWith("organization_account."))
    return { icon: "activity:security", tone: "info" };
  if (action.startsWith("employee_assignment."))
    return { icon: "activity:assignment", tone: "secondary" };
  if (action.startsWith("profile_self.") || entityType === "employee")
    return { icon: "activity:profile", tone: "info" };
  if (action === "report.view") return { icon: "activity:view", tone: "info" };
  if (action === "retirement_policy.update") return { icon: "activity:policy", tone: "secondary" };
  if (
    [
      "location",
      "organization_unit",
      "organization_unit_type",
      "position",
      "employment_type",
      "leave_type",
      "disciplinary_action_type",
    ].includes(entityType)
  )
    return { icon: "activity:settings", tone: "info" };
  return { icon: "activity:history", tone: "neutral" };
}
