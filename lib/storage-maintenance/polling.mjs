/** Polling hanya diperlukan ketika masih ada pemeriksaan/penghapusan yang berjalan. */
export function hasPendingStorageRun(summary, runs = []) {
  return Number(summary?.active_run_count || 0) > 0 ||
    runs.some((run) => run.status === "queued" || run.status === "running");
}
