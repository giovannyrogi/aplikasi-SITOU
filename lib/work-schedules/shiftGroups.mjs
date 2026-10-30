import { minute, validateRules } from "./rules.mjs";

/** Pilihan shift membagi jam dalam 24 jam. Ujung rentang boleh bersentuhan. */
export function validateShiftChoices(shifts) {
  const issues = [];
  const ranges = [];
  const names = new Set();
  for (const [index, shift] of shifts.entries()) {
    const name = (shift.name || "").trim().toLocaleLowerCase("id");
    if (names.has(name))
      issues.push({
        path: ["shifts", index, "name"],
        message: "Nama shift sudah digunakan. Gunakan nama berbeda.",
      });
    names.add(name);
    try {
      validateRules(shift.rules);
      if (shift.rules.type !== "fixed") throw new Error("Tentukan jam masuk dan jam pulang shift.");
      const start = minute(shift.rules.startTime);
      const end = minute(shift.rules.endTime) + (shift.rules.nextDay ? 1440 : 0);
      for (const prior of ranges) {
        if (
          [-1440, 0, 1440].some(
            (offset) => start < prior.end + offset && end > prior.start + offset,
          )
        )
          issues.push({
            path: ["shifts", index, "rules", "startTime"],
            message: `Jam shift bertabrakan dengan ${prior.name}. Ubah jam masuk atau jam pulangnya.`,
          });
      }
      ranges.push({ start, end, name: shift.name });
    } catch (error) {
      issues.push({ path: ["shifts", index, "rules", "endTime"], message: error.message });
    }
  }
  return issues;
}
