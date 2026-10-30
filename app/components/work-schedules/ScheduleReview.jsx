"use client";
import { useState } from "react";
import { Button, Pagination } from "antd";
import { Box } from "@mui/material";
import AppModal from "@/app/components/modals/AppModal";
import FontStyle from "@/app/components/font-style/FontStyle";
import ShiftGroupSummary from "./ShiftGroupSummary";
import ScheduleSummary from "./ScheduleSummary";

/** Konfirmasi terpisah; hanya tombol akhir yang memanggil penyimpanan. */
export default function ScheduleReview({ review, calendarName, busy, onBack, onSave }) {
  const [page, setPage] = useState(1);
  const v = review.payload;
  return (
    <AppModal
      scrollHeaderWithContent
      open
      title="Ringkasan jadwal"
      size="lg"
      description="Periksa hari kerja, jam, dan pengaturan lainnya. Jadwal baru disimpan setelah Anda memilih Simpan jadwal."
      onClose={onBack}
      disableClose={busy}
      footer={
        <>
          <Button disabled={busy} onClick={onBack}>
            Kembali ke form
          </Button>
          <Button type="primary" loading={busy} onClick={onSave}>
            Simpan jadwal
          </Button>
        </>
      }
    >
      <Box sx={{ display: "grid", gap: 3 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
            gap: 2,
            overflowWrap: "anywhere",
          }}
        >
          <Box>
            <FontStyle fontSize={12.5} color="text.secondary">
              Nama jadwal
            </FontStyle>
            <FontStyle fontWeight={600}>{v.name}</FontStyle>
          </Box>
          <Box>
            <FontStyle fontSize={12.5} color="text.secondary">
              Status
            </FontStyle>
            <FontStyle>
              {v.isActive
                ? "Aktif — dapat dipilih untuk penetapan baru"
                : "Nonaktif — tidak dapat dipilih untuk penetapan baru"}
            </FontStyle>
          </Box>
          <Box>
            <FontStyle fontSize={12.5} color="text.secondary">
              Susunan hari
            </FontStyle>
            <FontStyle>
              {review.workType === "shift"
                ? "Kerja shift"
                : v.patternType === "weekly"
                  ? "Mingguan, Senin sampai Minggu"
                  : `Rotasi ${v.cycleDays} hari, berulang setelah hari terakhir`}
            </FontStyle>
          </Box>
          <Box>
            <FontStyle fontSize={12.5} color="text.secondary">
              Kalender libur
            </FontStyle>
            <FontStyle>
              {calendarName ||
                (v.calendarId ? "Kalender yang dipilih" : "Tidak menggunakan kalender libur")}
            </FontStyle>
          </Box>
        </Box>
        {review.workType === "shift" ? (
          <ShiftGroupSummary
            shifts={v.shifts}
            workingDays={v.workingDays}
            calendarName={calendarName || (v.calendarId ? "Kalender yang dipilih" : null)}
            holidayPolicy={v.holidayPolicy}
            showSettings
          />
        ) : (
          <ScheduleSummary
            days={review.days.slice((page - 1) * 7, page * 7)}
            patternType={v.patternType}
            calendarName={calendarName || (v.calendarId ? "Kalender yang dipilih" : null)}
            holidayPolicy={v.holidayPolicy}
            showSettings
          />
        )}
        {review.days?.length > 7 && (
          <Pagination
            current={page}
            pageSize={7}
            total={review.days.length}
            showSizeChanger={false}
            onChange={setPage}
          />
        )}
      </Box>
    </AppModal>
  );
}
