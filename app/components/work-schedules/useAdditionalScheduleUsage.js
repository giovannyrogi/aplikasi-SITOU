"use client";
import { useEffect, useState } from "react";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { scheduleRequest } from "./ScheduleFields";

export default function useAdditionalScheduleUsage(enabled, payload) {
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({
    payload: null,
    retry: -1,
    loading: false,
    data: null,
    error: "",
  });
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!controller.signal.aborted)
        setState({ payload, retry, loading: true, data: null, error: "" });
    });
    runWithLoadingBackdrop(
      () =>
        scheduleRequest(
          "/api/work-schedules/exceptions/bulk/usage",
          JSON.parse(payload),
          controller.signal,
        ),
      { message: "Memeriksa jadwal yang sudah digunakan..." },
    )
      .then((response) => {
        if (!controller.signal.aborted)
          setState({ payload, retry, loading: false, data: response.data, error: "" });
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setState({
            payload,
            retry,
            loading: false,
            data: null,
            error:
              typeof failure.code === "string"
                ? failure.message
                : "Pilihan jadwal belum dapat diperiksa. Coba lagi.",
          });
      });
    return () => controller.abort();
  }, [enabled, payload, retry, runWithLoadingBackdrop]);
  const current = state.payload === payload && state.retry === retry;
  return {
    loading: enabled && (!current || state.loading),
    data: enabled && current ? state.data : null,
    error: enabled && current ? state.error : "",
    retry: () => setRetry((n) => n + 1),
  };
}
