"use client";
import { useEffect, useState, useCallback } from "react";
import { readApiResponse, normalizeRequestError } from "@/lib/api/clientError";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";

/** Respons lama tidak boleh menimpa organisasi/filter baru. */
export default function useDashboardData(url, { blocking = false } = {}) {
  const { startLoading } = useLoadingBackdrop();
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({ url: null, data: null, error: null });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const finishLoading = blocking ? startLoading({ message: "Memuat dashboard..." }) : () => {};
    fetch(url, { cache: "no-store", signal: controller.signal })
      .then(readApiResponse)
      .then((body) => {
        if (!controller.signal.aborted) setState({ url, data: body.data, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ url, data: null, error: normalizeRequestError(error) });
      })
      .finally(finishLoading);
    return () => {
      controller.abort();
      finishLoading();
    };
  }, [url, reload, blocking, startLoading]);
  return {
    data: state.url === url ? state.data : null,
    error: state.url === url ? state.error : null,
    loading: !!url && state.url !== url,
    retry: useCallback(() => {
      setState({ url: null, data: null, error: null });
      setReload((n) => n + 1);
    }, []),
  };
}
