"use client";
import { useState } from "react";
import { Button, Pagination } from "antd";
import { Box } from "@mui/material";
import AppModal from "@/app/components/modals/AppModal";
import FontStyle from "@/app/components/font-style/FontStyle";
import ShiftGroupSummary from "./ShiftGroupSummary";
import ScheduleSummary, { HolidayAttendanceNotice } from "./ScheduleSummary";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import AppNotice from "@/app/components/data-display/AppNotice";
import dayjs from "dayjs";

/** Konfirmasi terpisah; hanya tombol akhir yang memanggil penyimpanan. */
export default function ScheduleReview({ review, calendarName, busy, onBack, onSave }) {
  const [page, setPage] = useState(1);
  const v = review.payload;
  return (
    <AppModal
      open
      title="Ringkasan jadwal"
      size="lg"
      description="Periksa kembali hari dan jam kerja sebelum menyimpan."
      onClose={onBack}
      disableClose={busy}
      footer={
        <>
          <Button disabled={busy} onClick={onBack}>
            Ubah jadwal
          </Button>
          <Button type="primary" loading={busy} onClick={onSave}>
            Simpan jadwal
          </Button>
        </>
      }
    >
      <Box sx={{ display: "grid", gap: 3 }}>
        {v.effectiveFrom && (
          <AppNotice
            descriptionAlign="left"
            title={`Mulai berlaku ${dayjs(v.effectiveFrom).format("DD MMM YYYY")}`}
            description={`Jadwal sebelum tanggal tersebut tetap menggunakan pengaturan lama. Alasan perubahan: ${v.reason}`}
          />
        )}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
            gap: 2,
            overflowWrap: "anywhere",
          }}
        >
          <Box>
            <FontStyle fontSize={13} color="text.secondary">
              Nama jadwal
            </FontStyle>
            <FontStyle fontSize={14} fontWeight={600} sx={{ mt: 0.5 }}>
              {v.name}
            </FontStyle>
          </Box>
          <Box>
            <FontStyle fontSize={13} color="text.secondary">
              Status
            </FontStyle>
            <Box sx={{ mt: 0.5 }}>
              <CompactInfoChip
                label={v.isActive ? "Aktif" : "Nonaktif"}
                tone={v.isActive ? "success" : "neutral"}
              />
            </Box>
          </Box>
          <Box>
            <FontStyle fontSize={13} color="text.secondary">
              Pola jadwal
            </FontStyle>
            <FontStyle fontSize={14} sx={{ mt: 0.5 }}>
              {review.workType === "shift"
                ? "Kerja shift"
                : v.patternType === "weekly"
                  ? "Berulang setiap minggu"
                  : `Berulang setiap ${v.cycleDays} hari`}
            </FontStyle>
          </Box>
          <Box>
            <FontStyle fontSize={13} color="text.secondary">
              Kalender libur
            </FontStyle>
            <FontStyle fontSize={14} sx={{ mt: 0.5 }}>
              {calendarName || (v.calendarId ? "Kalender yang dipilih" : "Tanpa kalender tambahan")}
            </FontStyle>
          </Box>
        </Box>
        <HolidayAttendanceNotice allowed={v.allowHolidayAttendance} />
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
