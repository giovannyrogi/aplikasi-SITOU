const WARNING_LEVEL = Object.freeze({ oral_warning: 0, sp1: 1, sp2: 2, sp3: 3 });

/** Tanggal kalender ISO; hari ini berasal dari zona organisasi di server. */
export function disciplinaryDateErrors({ incidentDate, issuedDate, effectiveFrom, status, today }) {
  const errors = {};
  if (incidentDate && issuedDate && issuedDate < incidentDate)
    errors.issuedDate = "Tanggal terbit tidak boleh sebelum tanggal kejadian.";
  if (incidentDate && effectiveFrom && effectiveFrom < incidentDate)
    errors.effectiveFrom = "Tanggal mulai berlaku tidak boleh sebelum tanggal kejadian.";
  else if (issuedDate && effectiveFrom && effectiveFrom < issuedDate)
    errors.effectiveFrom = "Tanggal mulai berlaku tidak boleh sebelum tanggal terbit.";
  if (status === "active" && today) {
    if (issuedDate && issuedDate > today)
      errors.issuedDate = "Tanggal terbit mendatang hanya dapat disimpan sebagai draft.";
    if (effectiveFrom && effectiveFrom > today)
      errors.effectiveFrom = "Tanggal mulai berlaku mendatang hanya dapat disimpan sebagai draft.";
  }
  return errors;
}

/** SP2/SP3 tanpa tahap sebelumnya yang berlaku memerlukan keputusan langsung beralasan. */
export function needsDirectEscalation(type, currentActions) {
  const previous = { sp2: "sp1", sp3: "sp2" }[type.system_key];
  return Boolean(previous && !currentActions.some((action) => action.system_key === previous));
}

/** Hanya tahapan teguran/SP memiliki urutan; nama master tidak dipakai menebak tingkat. */
export function actionTypeRestriction(type, currentActions) {
  if (currentActions.some((action) => String(action.action_type_id) === String(type.id)))
    return "Jenis sanksi ini masih berlaku.";
  const level = WARNING_LEVEL[type.system_key];
  if (
    level !== undefined &&
    currentActions.some((action) => {
      const currentLevel = WARNING_LEVEL[action.system_key];
      return currentLevel !== undefined && currentLevel >= level;
    })
  )
    return "Tahapan ini sama atau lebih rendah dari sanksi yang masih berlaku.";
  return null;
}

/** Konfirmasi hanya berlaku untuk daftar keputusan yang benar-benar ditinjau HRD. */
export function sameReplacementActions(expected, actions) {
  const ids = [...new Set(expected.map(String))].sort();
  return JSON.stringify(ids) === JSON.stringify(actions.map((action) => String(action.id)).sort());
}
