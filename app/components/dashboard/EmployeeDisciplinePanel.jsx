"use client";
import { useEffect, useRef, useState } from "react";
import DataPanel from "@/app/components/data-display/DataPanel";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import DisciplineCaseDetailModal from "@/app/components/discipline/DisciplineCaseDetailModal";
import Notification from "@/app/components/Notifications/Notification";
import useAppNotification from "@/app/hooks/useAppNotification";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { readApiResponse, normalizeRequestError } from "@/lib/api/clientError";
import DisciplineHistoryList from "./DisciplineHistoryList";

export default function EmployeeDisciplinePanel({ discipline }) {
  const [detail, setDetail] = useState(null);
  const [opening, setOpening] = useState(false);
  const requestRef = useRef(null);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  useEffect(() => () => requestRef.current?.abort(), []);
  async function openDetail(row) {
    if (requestRef.current) return;
    const request = new AbortController();
    requestRef.current = request;
    setOpening(true);
    try {
      const body = await runWithLoadingBackdrop(
        () =>
          fetch(`/api/dashboard/discipline_self/${row.case_id}`, {
            cache: "no-store",
            signal: request.signal,
          }).then(readApiResponse),
        { message: "Membuka rincian kasus disiplin..." },
      );
      if (!request.signal.aborted) setDetail(body.data);
    } catch (error) {
      if (!request.signal.aborted) showNotification(normalizeRequestError(error).message, "error");
    } finally {
      requestRef.current = null;
      if (!request.signal.aborted) setOpening(false);
    }
  }
  return (
    <>
      <DataPanel
        title="Sanksi & teguran"
        description={<CompactInfoChip label={discipline.active ? `${discipline.active} sanksi masih aktif` : "Tidak ada sanksi aktif"} tone={discipline.active ? "danger" : "success"} />}
        contentSx={{ p: 0 }}
      >
        <DisciplineHistoryList items={discipline.recent} opening={opening} onOpen={openDetail} />
      </DataPanel>
      <DisciplineCaseDetailModal
        open={!!detail}
        disciplineCase={detail}
        organizationId={detail?.organization_id}
        onClose={() => setDetail(null)}
      />
      <Notification {...notification} onClose={closeNotification} />
    </>
  );
}
