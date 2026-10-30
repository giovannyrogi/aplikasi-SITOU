const GROUP_LABELS = Object.freeze({
  hris: "Kepegawaian",
  inventory: "Inventaris",
  platform: "Platform",
});

/** Presentasi setelah filter izin. Urutan kelompok mengikuti kemunculan pertama. */
export function sidebarGroups(submenus) {
  const groups = [];
  for (const submenu of submenus) {
    const label = GROUP_LABELS[submenu.sidebarGroup || submenu.access?.kind] || "Lainnya";
    const existing = groups.find((group) => group.label === label);
    if (existing) existing.items.push(submenu);
    else groups.push({ label, items: [submenu] });
  }
  return groups;
}
