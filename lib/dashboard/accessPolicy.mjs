import { hrisLevel, accountCapabilities, HRIS_MENUS } from "../access/hrisPolicy.mjs";
/** Dashboard adalah halaman dasar; grant dashboard lama tidak memberikan hak data. */
export function dashboardSectionsFor(actor) {
  if (actor.role_code === "employee") return [];
  const data = Boolean(hrisLevel(actor, "employees"));
  return [
    ...(data ? ["employees"] : []),
    ...(data || hrisLevel(actor, "expiring-contracts-report") ? ["contracts"] : []),
    ...(data || hrisLevel(actor, "retirement-report") ? ["retirement"] : []),
    ...(data || hrisLevel(actor, "disciplinary-actions-report") ? ["discipline"] : []),
    ...(hrisLevel(actor, "leave-requests") ? ["leave"] : []),
  ];
}
/** Fingerprint mencakup pilihan menu/capability agar cache lintas akun tidak membocorkan data. */
export function dashboardAccessFingerprint(actor) {
  return JSON.stringify({
    sections: dashboardSectionsFor(actor),
    menus: HRIS_MENUS.filter((menu) => menu.assignable).map((menu) => [
      menu.key,
      hrisLevel(actor, menu.key),
    ]),
    accounts: accountCapabilities(actor),
    configured: actor.hrisContext?.configured,
    fullAdmin: actor.hrisContext?.fullAdmin,
  });
}
