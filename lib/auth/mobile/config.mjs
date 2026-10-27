const MAX_SESSION_TTL_MINUTES = 7 * 24 * 60;

/** Durasi berasal dari environment backend; jangan melampaui constraint sesi database. */
export function getMobileSessionTtlMinutes() {
  const value = process.env.AUTH_MOBILE_SESSION_TTL_MINUTES?.trim() || "";
  const minutes = Number(value);
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(minutes) || minutes > MAX_SESSION_TTL_MINUTES) {
    const error = new Error("AUTH_MOBILE_SESSION_TTL_MINUTES wajib bilangan bulat 1–10080.");
    error.code = "AUTH_CONFIGURATION_ERROR";
    throw error;
  }
  return minutes;
}
