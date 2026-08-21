"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import LoadingBackdrop from "./Backdrop";

const LoadingBackdropContext = createContext(null);
const DEFAULT_MESSAGE = "Memproses...";

export function LoadingBackdropProvider({ children }) {
  const [state, setState] = useState({ open: false, message: DEFAULT_MESSAGE });
  const activeProcesses = useRef(new Map());
  const navigationToken = useRef(null);

  const synchronizeBackdrop = useCallback(() => {
    const processes = Array.from(activeProcesses.current.values());
    const latestProcess = processes.at(-1);

    const nextState = {
      open: processes.length > 0,
      message: latestProcess?.message || DEFAULT_MESSAGE,
    };
    setState((current) =>
      current.open === nextState.open && current.message === nextState.message
        ? current
        : nextState,
    );
  }, []);

  const startLoading = useCallback(
    (options = {}) => {
      const token = Symbol("loading-process");
      activeProcesses.current.set(token, {
        message: options.message || DEFAULT_MESSAGE,
      });
      synchronizeBackdrop();

      let finished = false;
      return () => {
        if (finished) return;
        finished = true;
        activeProcesses.current.delete(token);
        synchronizeBackdrop();
      };
    },
    [synchronizeBackdrop],
  );

  const runWithLoadingBackdrop = useCallback(
    async (process, options = {}) => {
      const finishLoading = startLoading(options);
      try {
        return await process();
      } finally {
        finishLoading();
      }
    },
    [startLoading],
  );

  const startNavigationLoading = useCallback(
    (options = {}) => {
      const message = options.message || "Membuka halaman...";
      const currentToken = navigationToken.current;

      if (currentToken && activeProcesses.current.has(currentToken)) {
        activeProcesses.current.set(currentToken, { message });
      } else {
        const token = Symbol("navigation-loading");
        navigationToken.current = token;
        activeProcesses.current.set(token, { message });
      }

      synchronizeBackdrop();
    },
    [synchronizeBackdrop],
  );

  const finishNavigationLoading = useCallback(() => {
    const token = navigationToken.current;
    if (!token) return;

    activeProcesses.current.delete(token);
    navigationToken.current = null;
    synchronizeBackdrop();
  }, [synchronizeBackdrop]);

  const value = useMemo(
    () => ({
      isLoading: state.open,
      startLoading,
      runWithLoadingBackdrop,
      startNavigationLoading,
      finishNavigationLoading,
    }),
    [
      finishNavigationLoading,
      runWithLoadingBackdrop,
      startLoading,
      startNavigationLoading,
      state.open,
    ],
  );

  return (
    <LoadingBackdropContext.Provider value={value}>
      {children}
      <LoadingBackdrop open={state.open} message={state.message} />
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
