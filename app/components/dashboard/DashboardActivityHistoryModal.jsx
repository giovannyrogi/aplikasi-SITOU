"use client";
import { useState } from "react";
import { Box } from "@mui/material";
import { Button } from "antd";
import AppModal from "@/app/components/modals/AppModal";
import AppNotice from "@/app/components/data-display/AppNotice";
import DataPagination from "@/app/components/data-display/DataPagination";
import DashboardActivityRows from "./DashboardActivityRows";
import useDashboardData from "./useDashboardData";

/** Mount saat dibuka; request dibatalkan ketika modal ditutup atau halaman berganti. */
export default function DashboardActivityHistoryModal({ onClose }) {
  const [cursors, setCursors] = useState([null]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const query = new URLSearchParams({ pageSize: String(pageSize) });
  if (cursors[page]) query.set("cursor", cursors[page]);
  const { data, loading, error, retry } = useDashboardData(`/api/dashboard/activities?${query}`);
  return (
    <AppModal
      open
      title="Riwayat aktivitas"
      size="md"
      icon="solar:history-bold-duotone"
      description="Aktivitas pengelola organisasi, diurutkan dari yang terbaru."
      onClose={onClose}
      contentResetKey={`${page}-${pageSize}`}
      pagination={
        !error ? (
          <DataPagination
            cursor={{ page: page + 1, next: data?.nextCursor }}
            total={data?.total}
            displayedCount={data?.items?.length}
            pageSize={pageSize}
            loading={loading}
            ariaLabel="Navigasi riwayat aktivitas"
            summary={loading ? "Memuat jumlah data..." : undefined}
            sx={{ pt: 0 }}
            onPrevious={() => setPage((value) => Math.max(0, value - 1))}
            onNext={() => {
              if (!data?.nextCursor || loading) return;
              setCursors([...cursors.slice(0, page + 1), data.nextCursor]);
              setPage(page + 1);
            }}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCursors([null]);
              setPage(0);
            }}
          />
        ) : null
      }
      footer={
        <Button style={{ minHeight: 44 }} onClick={onClose}>
          Tutup
        </Button>
      }
    >
      <Box sx={{ minWidth: 0, display: "grid", gap: 2 }}>
        {error ? (
          <AppNotice
            tone="danger"
            title="Aktivitas belum dapat dimuat"
            description={error.message}
            action={<Button onClick={retry}>Coba lagi</Button>}
          />
        ) : (
          <DashboardActivityRows items={data?.items || []} loading={loading} spacing={0} />
        )}
      </Box>
    </AppModal>
  );
}
