const DRAFT_ACTION_MANAGER_ROLES = new Set(["superadmin", "hrd"]);

/** Menentukan role yang boleh melihat tindakan disiplin sebelum resmi diterbitkan. */
export function canViewDraftDisciplinaryActions(actor) {
  return DRAFT_ACTION_MANAGER_ROLES.has(String(actor?.role_code || "").toLowerCase());
}
