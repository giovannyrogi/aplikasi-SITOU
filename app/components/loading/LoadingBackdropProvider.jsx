"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import LoadingBackdrop from "./Backdrop";
import Notification from "../Notifications/Notification";
import { navigationRecoveryHref, scheduleNavigationDeadline } from "@/lib/ui/navigationLoading.mjs";

const LoadingBackdropContext = createContext(null);
const DEFAULT_MESSAGE = "Memproses...";

export function LoadingBackdropProvider({ children }) {
  const [state, setState] = useState({ open: false, message: DEFAULT_MESSAGE });
  const activeProcesses = useRef(new Map());
  const navigationToken = useRef(null);
  const cancelNavigationDeadline = useRef(null);
  const [navigationWarning, setNavigationWarning] = useState(false);

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
      cancelNavigationDeadline.current?.();
      setNavigationWarning(false);
      const currentToken = navigationToken.current;

      if (currentToken && activeProcesses.current.has(currentToken)) {
        activeProcesses.current.set(currentToken, { message });
      } else {
        const token = Symbol("navigation-loading");
        navigationToken.current = token;
        activeProcesses.current.set(token, { message });
      }
      // Hanya token navigasi yang dilepas; upload/simpan memakai token proses tersendiri.
      cancelNavigationDeadline.current = scheduleNavigationDeadline(
        navigationToken.current,
        (token) => {
          if (navigationToken.current !== token) return;
          activeProcesses.current.delete(token);
          navigationToken.current = null;
          cancelNavigationDeadline.current = null;
          synchronizeBackdrop();
          // Router client dapat tertahan pada request RSC lama. Buka tujuan yang sama
          // lewat request dokumen baru; autentikasi dan izin server tetap diperiksa.
          const recoveryHref = navigationRecoveryHref(options.href, window.location.origin);
          if (recoveryHref && activeProcesses.current.size === 0) {
            try {
              window.location.assign(recoveryHref);
              return;
            } catch {
              // Jika browser menolak pemulihan, tetap sediakan pemberitahuan manual.
            }
          }
          setNavigationWarning(true);
        },
      );

      synchronizeBackdrop();
    },
    [synchronizeBackdrop],
  );

  const finishNavigationLoading = useCallback(() => {
    cancelNavigationDeadline.current?.();
    cancelNavigationDeadline.current = null;
    const token = navigationToken.current;
    if (!token) return;

    activeProcesses.current.delete(token);
    navigationToken.current = null;
    synchronizeBackdrop();
  }, [synchronizeBackdrop]);
  useEffect(() => {
    // Back/Forward dan pemulihan halaman dapat membatalkan route sebelum pathname berubah.
    const finishRestoredPage = (event) => {
      if (event.type === "popstate" || event.persisted) finishNavigationLoading();
    };
    window.addEventListener("popstate", finishRestoredPage);
    window.addEventListener("pageshow", finishRestoredPage);
    return () => {
      cancelNavigationDeadline.current?.();
      window.removeEventListener("popstate", finishRestoredPage);
      window.removeEventListener("pageshow", finishRestoredPage);
    };
  }, [finishNavigationLoading]);

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
      <Notification
        open={navigationWarning}
        severity="warning"
        message="Perpindahan halaman belum selesai. Pilih menu kembali atau muat ulang halaman."
        autoHideDuration={7000}
        onClose={() => setNavigationWarning(false)}
      />
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
