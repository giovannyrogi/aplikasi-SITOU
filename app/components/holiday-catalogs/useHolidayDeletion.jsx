"use client";
import usePermanentDeletion from "@/app/components/actions/usePermanentDeletion";

export default function useHolidayDeletion({ kind, organizationId, onDeleted, onMessage }) {
  const catalog = kind === "catalog";
  return usePermanentDeletion({
    endpointFor: (item) =>
      catalog
        ? `/api/system/holiday-catalogs/${item.id}/deletion`
        : `/api/work-calendars/${item.id}/deletion`,
    confirmationFor: () =>
      `${catalog ? "Katalog" : "Kalender"} dan seluruh tanggalnya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`,
    organizationId: catalog ? null : organizationId,
    onDeleted,
    onMessage,
  });
}
