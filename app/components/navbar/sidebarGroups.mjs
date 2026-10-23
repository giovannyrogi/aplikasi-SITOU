const GROUP_LABELS = Object.freeze({
  hris: "Kepegawaian",
  inventory: "Inventaris",
  platform: "Platform",
});

/** Kelompok presentasi dibuat setelah penyaringan izin, tanpa mengubah urutan menu. */
export function sidebarGroups(submenus) {
  const groups = [];
  for (const submenu of submenus) {
    const label = GROUP_LABELS[submenu.access?.kind] || "Lainnya";
    const previous = groups.at(-1);
    if (previous?.label === label) previous.items.push(submenu);
    else groups.push({ label, items: [submenu] });
  }
  return groups;
}
