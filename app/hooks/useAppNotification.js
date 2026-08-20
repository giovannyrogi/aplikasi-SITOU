"use client";

import { useCallback, useState } from "react";
export default function useAppNotification() {
  const [state, setState] = useState({ open: false, message: "", severity: "info" });
  const show = useCallback(
    (message, severity = "success") => setState({ open: true, message, severity }),
    [],
  );
  const close = useCallback(() => setState((current) => ({ ...current, open: false })), []);
  return { notification: state, showNotification: show, closeNotification: close };
}
