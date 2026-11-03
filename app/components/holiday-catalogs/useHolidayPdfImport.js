"use client";
import { useEffect, useRef, useState } from "react";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { scheduleRequest, requestKey } from "@/app/components/work-schedules/ScheduleFields";

/** One upload/job lifecycle shared by the draft form and its OCR review stage. */
export default function useHolidayPdfImport({ year, onPrepared }) {
  const [file, setFile] = useState(null);
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const receipt = useRef(null);
  const generation = useRef(0);
  const prepared = useRef(onPrepared);
  useEffect(() => {
    prepared.current = onPrepared;
  }, [onPrepared]);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const processing = busy || ["queued", "running"].includes(job?.status);
  const resolved = Boolean(job && ["ready", "incomplete"].includes(job.status));
  const reset = () => {
    generation.current++;
    receipt.current = null;
    setFile(null);
    setJob(null);
    setError("");
    setBusy(false);
  };
  useEffect(() => {
    if (!job?.id || !["queued", "running"].includes(job.status)) return;
    const current = generation.current;
    const controller = new AbortController();
    let timer,
      polling = false;
    const poll = async () => {
      if (polling || controller.signal.aborted || document.visibilityState === "hidden") return;
      polling = true;
      try {
        const response = await scheduleRequest(
          `/api/system/holiday-catalogs/pdf-imports/${job.id}`,
          null,
          controller.signal,
        );
        if (controller.signal.aborted || current !== generation.current) return;
        setJob(response.data);
        setError("");
        if (["ready", "incomplete"].includes(response.data.status))
          prepared.current?.(response.data);
        else if (["queued", "running"].includes(response.data.status))
          timer = setTimeout(poll, 2000);
      } catch (e) {
        if (!controller.signal.aborted && current === generation.current) {
          setError(
            e.code
              ? e.message
              : "Status pembacaan belum dapat dimuat. Periksa koneksi, lalu coba lagi.",
          );
          timer = setTimeout(poll, 4000);
        }
      } finally {
        polling = false;
      }
    };
    const visibility = () => {
      clearTimeout(timer);
      if (!controller.signal.aborted && document.visibilityState !== "hidden") void poll();
    };
    if (document.visibilityState !== "hidden") timer = setTimeout(poll, 500);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [job?.id, job?.status, retry]);
  const upload = async (selected = file) => {
    if (!selected || busy) return;
    const current = ++generation.current;
    setBusy(true);
    setError("");
    setFile(selected);
    setJob(null);
    if (receipt.current?.file !== selected || receipt.current?.year !== year)
      receipt.current = { file: selected, year, key: requestKey() };
    try {
      const body = new FormData();
      body.set("file", selected);
      body.set("year", String(year));
      body.set("requestKey", receipt.current.key);
      const response = await runWithLoadingBackdrop(
        () => scheduleRequest("/api/system/holiday-catalogs/pdf-imports", body),
        { message: "Memeriksa dan mengunggah dokumen..." },
      );
      if (current === generation.current)
        setJob({ id: response.data.id, status: "queued", stage: "checking", progress: 0 });
    } catch (e) {
      if (current === generation.current)
        setError(
          e.code ? e.message : "Dokumen belum berhasil diunggah. Periksa koneksi, lalu coba lagi.",
        );
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
  return {
    file,
    job,
    error,
    busy,
    processing,
    resolved,
    upload,
    reset,
    setError,
    retry: () => setRetry((n) => n + 1),
  };
}
