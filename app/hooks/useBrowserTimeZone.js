"use client";

import { useSyncExternalStore } from "react";

function readBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function subscribe(callback) {
  window.addEventListener("focus", callback);
  document.addEventListener("visibilitychange", callback);
  return () => {
    window.removeEventListener("focus", callback);
    document.removeEventListener("visibilitychange", callback);
  };
}

/** Deteksi pengaturan perangkat setelah hydration; tidak memakai jamnya untuk audit. */
export default function useBrowserTimeZone() {
  return useSyncExternalStore(subscribe, readBrowserTimeZone, () => "UTC");
}
