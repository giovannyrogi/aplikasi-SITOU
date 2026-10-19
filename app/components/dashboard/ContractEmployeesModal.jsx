"use client";

import { useState } from "react";
import { Box } from "@mui/material";
import { Button } from "antd";
import AppModal from "@/app/components/modals/AppModal";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import DataPagination from "@/app/components/data-display/DataPagination";
import {
  ReportIdentity,
  ReportRemaining,
  ReportCardFields,
  reportDate,
} from "@/app/components/reports/ReportEmployeeFields";
import FontStyle from "@/app/components/font-style/FontStyle";
import { formatChartTooltipCategory } from "./chartAdapter";
import useDashboardData from "./useDashboardData";

/** Daftar bulanan privat dari API laporan; menutup modal mempertahankan posisi dashboard. */
export default function ContractEmployeesModal({ period, filters, onClose }) {
  const [cursors, setCursors] = useState([null]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [photo, setPhoto] = useState(null);
  const query = new URLSearchParams({ ...filters, pageSize: String(pageSize) });
  if (cursors[page]) query.set("cursor", cursors[page]);
  const { data, loading, error, retry } = useDashboardData(
    `/api/reports/expiring-contracts?${query}`,
  );
  const columns = [
    {
      key: "employee",
      title: "Pegawai",
      width: 250,
      render: (_, row) => <ReportIdentity row={row} onPreview={setPhoto} />,
    },
    {
      key: "location",
      title: "Lokasi",
      width: 180,
      render: (_, row) => row.location_name || "Belum ditempatkan",
    },
    {
      key: "position",
      title: "Jabatan",
      width: 180,
      render: (_, row) => row.position_name || "Belum tersedia",
    },
    {
      key: "date",
      title: "Tanggal akhir",
      width: 130,
      render: (_, row) => reportDate(row.due_date),
    },
    {
      key: "remaining",
      title: "Sisa waktu",
      width: 150,
      render: (_, row) => <ReportRemaining row={row} />,
    },
  ];
  return (
    <>
      <AppModal
        open
        title={`Kontrak Berakhir - ${formatChartTooltipCategory(period)}`}
        description="Daftar pegawai dengan kontrak aktif yang akan berakhir pada bulan ini."
        icon="solar:calendar-date-bold-duotone"
        size="xl"
        onClose={onClose}
        contentResetKey={`${page}-${pageSize}`}
        pagination={
          !error ? (
            <DataPagination
              cursor={{ page: page + 1, next: data?.nextCursor }}
              total={data?.total}
              displayedCount={data?.rows?.length}
              summary={loading ? "Memuat jumlah data..." : undefined}
              sx={{ pt: 0 }}
              pageSize={pageSize}
              loading={loading}
              onPrevious={() => setPage(page - 1)}
              onNext={() => {
                if (!data?.nextCursor) return;
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
        <Box sx={{ display: "grid", gap: 2, minWidth: 0 }}>
          {data ? (
            <FontStyle fontSize={13} fontWeight={600}>
              {new Intl.NumberFormat("id-ID").format(data.total)} kontrak akan berakhir
            </FontStyle>
          ) : null}
          <ResponsiveDataView
            data={data?.rows || []}
            columns={columns}
            rowKey="id"
            rowOffset={data?.rowOffset || 0}
            scrollX={900}
            loading={loading}
            error={error?.message}
            onRetry={retry}
            emptyDescription="Tidak ada kontrak aktif yang akan berakhir pada bulan ini."
            renderCard={(row) => (
              <Box sx={{ minWidth: 0 }}>
                <ReportIdentity row={row} onPreview={setPhoto} />
                <ReportCardFields
                  fields={[
                    ["Lokasi", row.location_name || "Belum ditempatkan"],
                    ["Jabatan", row.position_name || "Belum tersedia"],
                    ["Tanggal akhir", reportDate(row.due_date)],
                    ["Sisa waktu", <ReportRemaining key="remaining" row={row} />],
                  ]}
                />
              </Box>
            )}
          />
        </Box>
      </AppModal>
      <ImagePreviewModal
        open={!!photo}
        imageUrl={photo?.imageUrl}
        alt={photo?.alt}
        title="Pas foto pegawai"
        onClose={() => setPhoto(null)}
      />
    </>
  );
}
