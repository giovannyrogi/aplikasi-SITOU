export const DEFAULT_BACKUP_TIME_ZONE = "Asia/Makassar";

export function backupClock(createdAt, timeZone = "UTC") {
  const date = new Date(createdAt);
  if (!createdAt || !Number.isFinite(date.getTime()))
    throw new Error("Tanggal backup tidak valid.");
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZoneName: "shortOffset",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const known = {
    UTC: "UTC",
    "Asia/Jakarta": "WIB",
    "Asia/Makassar": "WITA",
    "Asia/Jayapura": "WIT",
  };
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(parts.timeZoneName);
  const label =
    known[timeZone] ||
    (match
      ? `UTC${match[1] === "+" ? "p" : "m"}${match[2].padStart(2, "0")}${match[3] || "00"}`
      : "UTC");
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    clock: `${parts.hour}-${parts.minute}-${parts.second}`,
    label,
  };
}

export function configuredBackupTimeZone() {
  const timeZone = process.env.BACKUP_TIME_ZONE || DEFAULT_BACKUP_TIME_ZONE;
  backupClock(new Date(), timeZone);
  return timeZone;
}

export function formatBackupDate(value, timeZone = "UTC") {
  if (!value) return "Belum tersedia";
  const aliases = { "Asia/Ujung_Pandang": "WITA", "Asia/Pontianak": "WIB" };
  const code = aliases[timeZone] || backupClock(value, timeZone).label;
  const label = code.replace(
    /^UTC([pm])(\d{2})(\d{2})$/,
    (_, sign, hour, minute) => `UTC${sign === "p" ? "+" : "-"}${hour}:${minute}`,
  );
  return (
    new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(new Date(value)) +
    " " +
    label
  );
}
