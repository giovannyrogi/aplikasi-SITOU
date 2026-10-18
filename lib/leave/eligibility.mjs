/** Hanya aturan umum yang berlaku saat profil tidak memuat male/female. */
export function isLeaveTypeEligible(eligibleGender, employeeGender) {
  return eligibleGender === "all" || eligibleGender === employeeGender;
}
