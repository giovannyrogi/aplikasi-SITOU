export const DEFAULT_MINIMUM_LOADING_MS = 2000;

/** Menunggu sisa durasi minimum tanpa menunda dimulainya proses utama. */
export function waitForMinimumDuration(startedAt, minimumMs = DEFAULT_MINIMUM_LOADING_MS) {
  const remainingMs = Math.max(0, minimumMs - (Date.now() - startedAt));
  return new Promise((resolve) => setTimeout(resolve, remainingMs));
}
