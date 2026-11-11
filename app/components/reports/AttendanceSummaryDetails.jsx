"use client";

import { useState } from "react";
import { Box } from "@mui/material";
import { Button, Skeleton } from "antd";
import { PictureOutlined } from "@ant-design/icons";
import AppModal from "@/app/components/modals/AppModal";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import ErrorState from "@/app/components/data-display/ErrorState";
import FontStyle from "@/app/components/font-style/FontStyle";
import useDashboardData from "@/app/components/dashboard/useDashboardData";
import { ReportField, reportDate } from "./ReportEmployeeFields";
import { AttendanceIndicators, AttendanceState } from "./AttendanceSummaryFields";
import {
  attendanceMinutes,
  attendanceSchedule,
  attendanceTime,
} from "@/lib/reports/attendancePresentation.mjs";

const directions = [
  {
    type: "check_in",
    title: "Absen masuk",
    timeLabel: "Jam Masuk",
    summaryField: "first_check_in",
  },
  {
    type: "check_out",
    title: "Absen pulang",
    timeLabel: "Jam Pulang",
    summaryField: "last_check_out",
  },
];
const pairGrid = {
  display: "grid",
  gap: 2,
  gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
};
const sectionSx = {
  display: "grid",
  gap: 2,
  minWidth: 0,
  border: 1,
  borderColor: "divider",
  borderRadius: 2,
  p: { xs: 2, sm: 2.5 },
};

function EventFacts({ event, timezone, workDate, label }) {
  const timing = !event.assessment_version
    ? "unassessed"
    : event.timing_category === "on_time"
      ? "on_time_" + event.event_type
      : event.timing_category;
  return (
    <Box sx={{ display: "grid", gap: 1, minWidth: 0 }}>
      <ReportField label={label}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, minWidth: 0 }}>
          <FontStyle
            component="span"
            fontSize={16}
            fontWeight={600}
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            {attendanceTime(
              event.occurred_at,
              event.organization_timezone_snapshot || timezone,
              workDate,
            )}
          </FontStyle>
          <AttendanceIndicators
            indicators={[
              timing,
              event.geofence_status === "outside" && "outside_radius",
              event.near_boundary && "near_boundary",
              event.work_context,
            ]}
            lateMinutes={event.late_minutes}
          />
        </Box>
      </ReportField>
      {event.point_name_snapshot && (
        <ReportField label="Titik absensi">{event.point_name_snapshot}</ReportField>
      )}
      {event.attendance_note && (
        <ReportField label="Catatan Pegawai">{event.attendance_note}</ReportField>
      )}
    </Box>
  );
}

function AttendancePhoto({ url, title, event, recorded, canViewPhotos, onPreview }) {
  const [failed, setFailed] = useState(false);
  const canPreview = Boolean(url && !failed);
  let caption;
  if (canPreview) caption = "Tekan untuk memperbesar gambar";
  else if (!recorded) caption = title + " belum tercatat.";
  else if (!canViewPhotos) caption = "Akun Anda tidak memiliki izin melihat foto absensi.";
  else if (failed || event?.has_photo_reference)
    caption = title + " tercatat, tetapi foto tidak dapat ditampilkan.";
  else caption = title + " tercatat tanpa foto.";

  const imageSx = {
    position: "relative",
    display: "grid",
    placeItems: "center",
    minWidth: 0,
    width: "100%",
    height: { xs: 176, sm: 208, md: 224 },
    bgcolor: (theme) => theme.ui.panelSubtleBg,
    border: 1,
    borderColor: "divider",
    borderRadius: 2,
    overflow: "hidden",
    p: 0,
    color: "text.secondary",
  };
  return (
    <Box sx={{ display: "grid", gap: 1, minWidth: 0 }}>
      {canPreview ? (
        <Box
          component="button"
          type="button"
          aria-label={"Perbesar foto " + title.toLowerCase()}
          onClick={() => onPreview({ url, title: "Foto " + title.toLowerCase() })}
          sx={{
            ...imageSx,
            cursor: "zoom-in",
            "&:focus-visible": { outline: 2, outlineColor: "primary.main", outlineOffset: 2 },
          }}
        >
          <Box
            component="img"
            src={url}
            alt={"Foto " + title.toLowerCase()}
            loading="lazy"
            onError={() => setFailed(true)}
            sx={{
              position: "absolute",
              inset: 0,
              display: "block",
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </Box>
      ) : (
        <Box sx={imageSx}>
          <PictureOutlined aria-hidden="true" style={{ fontSize: 36 }} />
        </Box>
      )}
      <FontStyle fontSize={12} align="center" color="text.secondary">
        {caption}
      </FontStyle>
    </Box>
  );
}

export default function AttendanceSummaryDetails({ row, organizationId, onClose }) {
  const [preview, setPreview] = useState(null);
  const base = "/api/reports/attendance-summary/" + row.id;
  const query = new URLSearchParams({ organizationId });
  const { data, loading, error, retry } = useDashboardData(base + "?" + query);
  const detail = data?.row || row;
  const ranges = data ? attendanceSchedule(detail, data.timezone) : [];
  const groups = data
    ? directions.map((direction) => ({
        ...direction,
        events: data.events.filter((event) => event.event_type === direction.type),
      }))
    : [];
  return (
    <>
      <AppModal
        open={!preview}
        keepMounted
        title="Rincian absensi"
        description={detail.full_name + " · " + reportDate(detail.work_date)}
        icon="navigation:work-schedules"
        onClose={onClose}
        size="lg"
        footer={<Button onClick={onClose}>Tutup</Button>}
      >
        {loading && <Skeleton active paragraph={{ rows: 5 }} />}
        {error && <ErrorState message={error.message} onRetry={retry} />}
        {data && (
          <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
            <Box component="section" sx={sectionSx}>
              <FontStyle component="h3" fontWeight={700}>
                Informasi Pegawai
              </FontStyle>
              <Box sx={pairGrid}>
                <ReportField label="NIP">{detail.employee_no || "—"}</ReportField>
                <ReportField label="Lokasi">{detail.location_name || "—"}</ReportField>
                <ReportField label="Divisi & Unit">
                  {detail.organization_unit_name || "—"}
                </ReportField>
                <ReportField label="Jabatan">{detail.position_name || "—"}</ReportField>
                <ReportField label="Jenis kepegawaian">
                  {detail.employment_type_name || "—"}
                </ReportField>
                <ReportField label="Status">
                  <AttendanceState row={detail} />
                </ReportField>
              </Box>
            </Box>
            <Box
              component="section"
              sx={{ ...sectionSx, boxShadow: (theme) => theme.ui.panelShadow }}
            >
              <FontStyle component="h3" fontWeight={700}>
                Waktu absensi
              </FontStyle>
              <Box sx={pairGrid}>
                <ReportField label="Jadwal Kerja">
                  {ranges.length
                    ? ranges.map((range, index) => <Box key={index}>{range}</Box>)
                    : detail.holiday_name || "—"}
                </ReportField>
                <ReportField label="Durasi bersih">
                  {attendanceMinutes(detail.duration_complete ? detail.worked_minutes : null)}
                </ReportField>
              </Box>
              <Box sx={{ ...pairGrid, pt: 2, borderTop: 1, borderColor: "divider" }}>
                {groups.map(({ type, timeLabel, summaryField, events }) => (
                  <Box
                    key={type}
                    sx={{ display: "grid", gap: 2, alignContent: "start", minWidth: 0 }}
                  >
                    {events.length ? (
                      events.map((event) => (
                        <EventFacts
                          key={event.event_date + "-" + event.id}
                          event={event}
                          timezone={data.timezone}
                          workDate={detail.work_date}
                          label={timeLabel}
                        />
                      ))
                    ) : (
                      <ReportField label={timeLabel}>
                        {attendanceTime(detail[summaryField], data.timezone, detail.work_date)}
                      </ReportField>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
            <Box role="group" aria-label="Foto masuk dan pulang" sx={pairGrid}>
              {groups.map(({ type, title, summaryField, events }) => (
                <Box
                  key={type}
                  sx={{ display: "grid", alignContent: "start", gap: 1.5, minWidth: 0 }}
                >
                  <FontStyle fontWeight={600} fontSize={13}>
                    {title}
                  </FontStyle>
                  {(events.length ? events : [null]).map((event) => (
                    <AttendancePhoto
                      key={event ? event.event_date + "-" + event.id : type}
                      event={event}
                      title={title}
                      recorded={Boolean(event || detail[summaryField])}
                      url={
                        event?.photo_id ? base + "/photos/" + event.photo_id + "?" + query : null
                      }
                      canViewPhotos={data.canViewPhotos}
                      onPreview={setPreview}
                    />
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </AppModal>
      {preview && (
        <ImagePreviewModal
          open
          imageUrl={preview.url}
          title={preview.title}
          alt={preview.title}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}
