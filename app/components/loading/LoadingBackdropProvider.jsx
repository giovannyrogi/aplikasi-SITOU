"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import LoadingBackdrop from "./Backdrop";

export const MINIMUM_LOADING_DURATION_MS = 2000;

const LoadingBackdropContext = createContext(null);

const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

export function LoadingBackdropProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("Memproses...");
  const activeProcesses = useRef(0);

  const runWithLoadingBackdrop = useCallback(async (process, options = {}) => {
    const startedAt = Date.now();
    const minimumDuration = Math.max(
      MINIMUM_LOADING_DURATION_MS,
      Number(options.minimumDuration) || 0,
    );

    activeProcesses.current += 1;
    setMessage(options.message || "Memproses...");
    setOpen(true);

    try {
      return await process();
    } finally {
      const remainingDuration = minimumDuration - (Date.now() - startedAt);
      if (remainingDuration > 0) await wait(remainingDuration);

      activeProcesses.current = Math.max(0, activeProcesses.current - 1);
      if (activeProcesses.current === 0) setOpen(false);
    }
  }, []);

  const value = useMemo(
    () => ({ isLoading: open, runWithLoadingBackdrop }),
    [open, runWithLoadingBackdrop],
  );

  return (
    <LoadingBackdropContext.Provider value={value}>
      {children}
      <LoadingBackdrop open={open} message={message} />
    </LoadingBackdropContext.Provider>
  );
}

export function useLoadingBackdrop() {
  const context = useContext(LoadingBackdropContext);

  if (!context) {
    throw new Error("useLoadingBackdrop harus digunakan di dalam LoadingBackdropProvider.");
  }

  return context;
}
