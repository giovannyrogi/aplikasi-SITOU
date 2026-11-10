/** A day off remains a day off. This is an attendance opportunity, not a planned shift. */
export function holidayWorkSession(day) {
  if (
    !day.assignmentId ||
    !["off", "holiday"].includes(day.status) ||
    !day.allowHolidayAttendance ||
    day.sessions.length
  )
    return null;
  return {
    sessionNo: 1,
    workDate: day.date,
    name: "Bekerja saat libur",
    startsAt: null,
    endsAt: null,
    holidayWork: true,
    holidayName: day.holidayName || "Libur mingguan",
    rules: { type: "holiday_work", breakMinutes: 0, deductBreak: false },
  };
}

export function holidayAssessment() {
  return {
    offerNote: true,
    status: "holiday_work",
    message: "Bekerja saat libur",
    timing: {
      version: 2,
      category: "not_applicable",
      referenceAt: null,
      offsetSeconds: null,
      earlyArrivalMinutes: null,
      lateMinutes: null,
      earlyLeaveMinutes: null,
      lateDepartureMinutes: null,
      lateToleranceMinutes: null,
      earlyLeaveToleranceMinutes: null,
    },
  };
}
