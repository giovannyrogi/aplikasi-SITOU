"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "antd";
import { Box } from "@mui/material";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import FontStyle from "@/app/components/font-style/FontStyle";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { scheduleRequest, requestKey } from "@/app/components/work-schedules/ScheduleFields";

/** Shared destructive workflow; never layers a second modal over an editor. */
export default function useHolidayDeletion({ kind, organizationId, onDeleted, onMessage }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pendingCleanup, setPendingCleanup] = useState([]);
  const cleanupMessages = useRef(new Map());
  useEffect(() => {
    if (!pendingCleanup.length) return;
    const controller = new AbortController();
    let timer,
      polling = false;
    const poll = async () => {
      if (polling || controller.signal.aborted || document.visibilityState === "hidden") return;
      polling = true;
      for (const job of pendingCleanup) {
        try {
          const r = await scheduleRequest(
            job.endpoint + job.query + (job.query ? "&" : "?") + "requestKey=" + job.key,
            null,
            controller.signal,
          );
          if (controller.signal.aborted) return;
          if (r.data.state === "deleted" && !r.data.cleanupPending) {
            setPendingCleanup((items) => items.filter((x) => x.key !== job.key));
            cleanupMessages.current.delete(job.key);
            onMessage("Dokumen katalog yang dihapus telah selesai dibersihkan.");
          } else if (r.data.message && cleanupMessages.current.get(job.key) !== r.data.message) {
            cleanupMessages.current.set(job.key, r.data.message);
            onMessage(r.data.message, "warning");
          }
        } catch (e) {
          if (["SESSION_EXPIRED", "FORBIDDEN"].includes(e.code))
            setPendingCleanup((items) => items.filter((x) => x.key !== job.key));
        }
      }
      polling = false;
      if (!controller.signal.aborted && document.visibilityState !== "hidden")
        timer = setTimeout(poll, 10000);
    };
    const visibility = () => {
      clearTimeout(timer);
      if (document.visibilityState !== "hidden") void poll();
    };
    if (document.visibilityState !== "hidden") timer = setTimeout(poll, 10000);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [pendingCleanup, onMessage]);
  const complete = async (result, job) => {
    setState(null);
    onMessage(result.message || "Data berhasil dihapus permanen.");
    if (result.cleanupPending) {
      cleanupMessages.current.set(job.key, result.message);
      setPendingCleanup((items) => [...items.filter((x) => x.key !== job.key), job]);
    }
    try {
      await onDeleted();
    } catch {
      onMessage("Data berhasil dihapus. Muat ulang daftar untuk melihat perubahan.", "warning");
    }
  };
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const show = async (item) => {
    if (busy) return;
    const endpoint =
      kind === "catalog"
        ? `/api/system/holiday-catalogs/${item.id}/deletion`
        : `/api/work-calendars/${item.id}/deletion`;
    const query =
      kind === "calendar" ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
    setBusy(true);
    try {
      const r = await runWithLoadingBackdrop(() => scheduleRequest(endpoint + query), {
        message: "Memeriksa penggunaan data...",
      });
      setState({
        preview: r.data,
        endpoint,
        query,
        org: organizationId,
        key: requestKey(),
        error: "",
      });
    } catch (e) {
      onMessage(
        e.code
          ? e.message
          : "Penggunaan data belum dapat diperiksa. Periksa koneksi, lalu coba lagi.",
        "error",
      );
      if (e.code === "ALREADY_DELETED") await onDeleted();
    } finally {
      setBusy(false);
    }
  };
  const check = async () => {
    if (!state || busy) return;
    setBusy(true);
    try {
      const r = await runWithLoadingBackdrop(
        () =>
          scheduleRequest(
            `${state.endpoint}${state.query}${state.query ? "&" : "?"}requestKey=${state.key}`,
          ),
        { message: "Memeriksa status penghapusan..." },
      );
      if (r.data.state === "deleted") {
        await complete(r.data, state);
      } else
        setState((s) => ({
          ...s,
          unknown: false,
          error:
            "Penghapusan belum tercatat. Anda dapat mencoba kembali dengan permintaan yang sama.",
        }));
    } catch (e) {
      setState((s) => ({
        ...s,
        error: e.code
          ? e.message
          : "Status belum dapat diperiksa. Periksa koneksi, lalu coba lagi.",
      }));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (busy || !state?.preview.eligible) return;
    setBusy(true);
    try {
      const r = await runWithLoadingBackdrop(
        () =>
          scheduleRequest(state.endpoint, {
            version: state.preview.version,
            requestKey: state.key,
            ...(kind === "calendar" ? { organizationId: String(state.org) } : {}),
          }),
        { message: "Menghapus data..." },
      );
      await complete(r.data, state);
    } catch (e) {
      // A transport failure is ambiguous: reconcile the same receipt before retry.
      const unknown =
        !e.code ||
        ["NETWORK_ERROR", "TIMEOUT", "INVALID_RESPONSE", "DELETE_STATUS_UNKNOWN"].includes(e.code);
      setState((s) => ({
        ...s,
        unknown,
        error: unknown
          ? "Status penghapusan belum dapat dipastikan. Periksa status sebelum mencoba kembali."
          : e.message,
        blocked: [
          "CATALOG_USED",
          "CALENDAR_USED",
          "HISTORY_UNVERIFIED",
          "DOCUMENT_UNSAFE",
          "DOCUMENT_QUARANTINED",
          "VERSION_CONFLICT",
          "ALREADY_DELETED",
          "FORBIDDEN",
          "SESSION_EXPIRED",
        ].includes(e.code),
      }));
    } finally {
      setBusy(false);
    }
  };
  const p = state?.preview;
  const dialog = (
    <ConfirmDialog
      open={Boolean(state)}
      title={p?.eligible ? "Hapus permanen?" : "Penghapusan diblokir"}
      description={p?.name}
      danger
      loading={busy}
      confirmText="Hapus permanen"
      hideConfirm={!p?.eligible || state?.blocked || state?.unknown}
      onClose={() => setState(null)}
      onConfirm={remove}
    >
      <Box sx={{ display: "grid", gap: 2 }}>
        {p?.organization && <FontStyle fontSize={14}>Organisasi: {p.organization}</FontStyle>}
        <FontStyle fontSize={14}>
          {p?.eligible
            ? (kind === "catalog" ? "Katalog" : "Kalender") +
              " dan seluruh tanggalnya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
            : p?.message}
        </FontStyle>
        {p?.usageCount > 0 && (
          <>
            <FontStyle fontSize={14} fontWeight={600}>
              Digunakan pada {p.usageCount} referensi
            </FontStyle>
            {p.usages.map((u, i) => (
              <FontStyle key={i}>
                {u.name}
                {u.organization ? " · " + u.organization : ""}
              </FontStyle>
            ))}
            {p.usageCount > p.usages.length && (
              <FontStyle fontSize={14}>Menampilkan {p.usages.length} referensi pertama.</FontStyle>
            )}
          </>
        )}
        {p?.eligible && p?.revisionEffect && (
          <FontStyle fontSize={14}>{p.revisionEffect}</FontStyle>
        )}
        {p?.eligible && p?.document && (
          <FontStyle fontSize={14}>
            Dokumen: {p.document.name}.{" "}
            {p.document.shared
              ? "Tetap disimpan karena digunakan revisi lain."
              : "Dokumen juga akan dibersihkan setelah data dihapus."}
          </FontStyle>
        )}
        {state?.error && (
          <FontStyle fontSize={14} role="alert" color="error.main">
            {state.error}
          </FontStyle>
        )}
        {state?.unknown && (
          <Button onClick={check} disabled={busy}>
            Periksa status
          </Button>
        )}
      </Box>
    </ConfirmDialog>
  );
  return { show, dialog, busy };
}
