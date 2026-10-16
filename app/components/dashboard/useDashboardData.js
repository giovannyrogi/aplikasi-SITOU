"use client";
import { useEffect, useState, useCallback } from "react";
import { readApiResponse, normalizeRequestError } from "@/lib/api/clientError";

/** Respons lama tidak boleh menimpa organisasi/filter baru. */
export default function useDashboardData(url) {
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({ url: null, data: null, error: null });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { cache: "no-store", signal: controller.signal }).then(readApiResponse)
      .then((body) => { if (!controller.signal.aborted) setState({ url, data: body.data, error: null }); })
      .catch((error) => { if (!controller.signal.aborted) setState({ url, data: null, error: normalizeRequestError(error) }); });
    return () => controller.abort();
  }, [url, reload]);
  return { data: state.url === url ? state.data : null, error: state.url === url ? state.error : null,
    loading: !!url && state.url !== url, retry: useCallback(() => { setState({ url: null, data: null, error: null }); setReload((n) => n + 1); }, []) };
}
