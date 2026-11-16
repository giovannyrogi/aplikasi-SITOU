"use client";

import { useState } from "react";
import { Box } from "@mui/material";
import dayjs from "dayjs";
import { Button, Skeleton } from "antd";
import {
  CalendarOutlined,
  ClockCircleOutlined,
  CoffeeOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  PictureOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { alpha } from "@mui/material/styles";
import AppModal from "@/app/components/modals/AppModal";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import ErrorState from "@/app/components/data-display/ErrorState";
import FontStyle from "@/app/components/font-style/FontStyle";
import PhotoAvatar from "@/app/components/data-display/PhotoAvatar";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import useDashboardData from "@/app/components/dashboard/useDashboardData";
import {
  attendanceClock,
  attendanceLocalDate,
  attendanceRowIndicators,
  attendanceTime,
} from "@/lib/reports/attendancePresentation.mjs";
import AttendanceEventMap from "./AttendanceEventMap";
const pairGrid = {
  display: "grid",
  gap: 1.25,
  gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
};
const eventCardSx = (theme) => ({
  display: "grid",
  alignContent: "start",
  gap: 1,
  minWidth: 0,
  border: 1,
  borderColor: alpha(theme.palette.text.primary, 0.11),
  borderRadius: 2.5,
  p: 1.25,
  background: `linear-gradient(155deg, ${theme.palette.background.paper} 48%, ${alpha(theme.palette.primary.main, 0.022)})`,
  boxShadow: `0 3px 7px ${alpha(theme.palette.text.primary, 0.045)}, inset 0 1px ${theme.palette.background.paper}`,
});
const liftOnHover = {
  "@media (hover: hover) and (prefers-reduced-motion: no-preference)": {
    transition: "transform 180ms ease-out, box-shadow 180ms ease-out",
    "&:hover": { transform: "translateY(-2px)", boxShadow: 2 },
  },
};

function AttendancePhoto({ url, title, event, recorded, canViewPhotos, onPreview }) {
  const [failed, setFailed] = useState(false);
  const canPreview = Boolean(url && !failed);
  let caption;
  if (!recorded) caption = title + " belum tercatat.";
  else if (!event.id) caption = "Foto dan rincian absen tidak tersedia.";
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
    maxWidth: "100%",
    minHeight: canPreview ? 44 : 76,
    bgcolor: (theme) => theme.ui.panelSubtleBg,
    border: 1,
    borderColor: "divider",
    borderRadius: 2.25,
    overflow: "hidden",
    p: 0,
    color: "text.secondary",
  };
  return (
    <Box sx={{ display: "grid", gap: 1, minWidth: 0 }}>
      {canPreview ? (
        <>
          <Box
            component="button"
            type="button"
            aria-label={"Perbesar foto " + title.toLowerCase()}
            onClick={() => onPreview({ url, title: "Foto " + title.toLowerCase() })}
            sx={{
              ...imageSx,
              ...liftOnHover,
              cursor: "zoom-in",
              background: (theme) =>
                `radial-gradient(ellipse at 50% 10%, ${theme.palette.background.paper}, ${theme.ui.panelSubtleBg} 90%)`,
              boxShadow: "inset 0 2px 6px rgba(16, 30, 53, 0.07)",
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
                display: "block",
                width: "100%",
                maxWidth: "100%",
                height: { xs: 126, sm: 120 },
                objectFit: "contain",
              }}
            />
          </Box>
          <FontStyle align="center" color="text.secondary" fontSize={12}>
            Tekan untuk memperbesar foto
          </FontStyle>
        </>
      ) : (
        <Box sx={{ ...imageSx, gap: 0.5, px: 1, py: 1.5 }}>
          <PictureOutlined aria-hidden="true" style={{ fontSize: 20 }} />
          <FontStyle fontSize={12} align="center" color="text.secondary">
            {caption}
          </FontStyle>
        </Box>
      )}
    </Box>
  );
}

function DetailSection({ title, Icon, tone, children }) {
  return (
    <Box
      component="section"
      sx={(theme) => ({
        minWidth: 0,
        border: 1,
        borderColor: tone ? alpha(theme.palette[tone].main, 0.19) : "divider",
        borderRadius: 3.25,
        background: `linear-gradient(165deg, ${tone ? alpha(theme.palette[tone].main, 0.045) : theme.ui.panelSubtleBg}, ${theme.palette.background.paper} 83%)`,
        boxShadow: `0 5px 14px ${alpha(theme.palette.text.primary, 0.055)}, inset 0 1px ${theme.palette.background.paper}`,
      })}
    >
      <Box
        component="header"
        sx={(theme) => ({
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          py: 1.125,
          px: 1.25,
          borderRadius: "inherit",
          borderEndStartRadius: 0,
          borderEndEndRadius: 0,
          color: tone ? theme.palette[tone].dark : theme.palette.text.primary,
          background: tone
            ? `linear-gradient(120deg, ${alpha(theme.palette[tone].main, 0.095)}, ${alpha(theme.palette[tone].main, 0.032)})`
            : `linear-gradient(120deg, ${theme.ui.panelSubtleBg}, ${theme.palette.background.paper})`,
          borderBottom: tone ? undefined : "1px solid",
          borderColor: "divider",
        })}
      >
        <Box
          sx={{
            display: "grid",
            placeItems: "center",
            width: 32,
            height: 32,
            borderRadius: 1.5,
            flexShrink: 0,
            background: (theme) =>
              `linear-gradient(150deg, ${theme.palette.background.paper}, ${tone ? alpha(theme.palette[tone].main, 0.18) : theme.ui.panelSubtleBg})`,
            boxShadow: "0 2px 4px rgba(16, 30, 53, 0.08), inset 0 1px 0 rgba(255,255,255,.8)",
          }}
        >
          <Icon aria-hidden />
        </Box>
        <FontStyle component="h3" fontSize={15} fontWeight={700}>
          {title}
        </FontStyle>
      </Box>
      <Box sx={{ display: "grid", gap: 1.5, minWidth: 0, p: 1.25, pt: 1.75 }}>{children}</Box>
    </Box>
  );
}

const timelineSurface = (theme, tone) => ({
  border: 1,
  borderColor: alpha(theme.palette[tone].main, 0.18),
  borderRadius: 2,
  background: `linear-gradient(160deg, ${theme.palette.background.paper}, ${alpha(theme.palette[tone].main, 0.055)})`,
  boxShadow: `inset 0 2px 5px ${alpha(theme.palette[tone].main, 0.075)}`,
});

const timelineBand = (theme, tone) => ({
  py: 0.75,
  color: theme.palette[tone].dark,
  background: `linear-gradient(155deg, ${alpha(theme.palette[tone].main, 0.16)}, ${alpha(theme.palette[tone].main, 0.065)})`,
});

function DateTimeline({ days, renderEntries, tone }) {
  return (
    <Box
      sx={(theme) => ({
        display: "grid",
        gridTemplateColumns: `repeat(${days.size === 2 ? 2 : 1}, minmax(0, 1fr))`,
        ...timelineSurface(theme, tone),
      })}
    >
      {[...days].map(([date, entries], index) => (
        <Box key={date} sx={{ minWidth: 0, position: "relative" }}>
          {index > 0 && (
            <Box
              sx={(theme) => ({
                position: "absolute",
                zIndex: 1,
                ...(days.size === 2
                  ? { insetBlock: 0, insetInlineStart: 0, borderInlineStart: "1px dashed" }
                  : { insetInline: 0, top: 0, borderTop: "1px dashed" }),
                borderColor: alpha(theme.palette[tone].dark, 0.45),
              })}
            >
              <Box
                component="span"
                sx={{
                  position: "absolute",
                  top: 0,
                  left: days.size === 2 ? 0 : "50%",
                  transform: "translate(-50%, -50%)",
                  px: 0.75,
                  borderRadius: 8,
                  bgcolor: tone + ".dark",
                  color: "common.white",
                  boxShadow: 1,
                  fontSize: 10,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                00.00
              </Box>
            </Box>
          )}
          <Box
            sx={(theme) => ({
              ...timelineBand(theme, tone),
              px: 0.75,
              borderStartStartRadius: index === 0 ? 7 : 0,
              borderStartEndRadius: days.size === 1 || (days.size === 2 && index === 1) ? 7 : 0,
            })}
          >
            <FontStyle component="h4" align="center" fontSize={15} fontWeight={700}>
              {dayjs(date).format("D MMM")}
            </FontStyle>
          </Box>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.75,
              p: 1,
            }}
          >
            {renderEntries(entries)}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function ScheduleTimeline({ row, timezone, tone }) {
  if (!row.schedule.length) {
    if (row.holiday_name || ["holiday", "off"].includes(row.attendance_status)) return null;
    return (
      <FontStyle color="text.secondary">
        {row.holiday_name || "Tidak ada jam kerja terjadwal."}
      </FontStyle>
    );
  }
  const days = new Map();
  for (const { starts_at, ends_at } of row.schedule) {
    const start = attendanceLocalDate(starts_at, timezone);
    const end = attendanceLocalDate(ends_at, timezone);
    const startTime = attendanceClock(starts_at, timezone);
    const endTime = attendanceClock(ends_at, timezone);
    if (!days.has(start)) days.set(start, []);
    if (!days.has(end)) days.set(end, []);
    if (start === end) {
      days.get(start).push({ time: `${startTime}–${endTime}` });
    } else {
      days.get(start).push({ time: startTime, label: "Mulai" });
      days.get(end).push({ time: endTime, label: "Selesai" });
    }
  }
  return (
    <DateTimeline
      tone={tone}
      days={new Map([...days].sort(([a], [b]) => a.localeCompare(b)))}
      renderEntries={(entries) =>
        entries.map(({ time, label }, index) => (
          <Box
            key={`${time}-${index}`}
            sx={(theme) => ({
              display: "grid",
              gap: 0.25,
              justifyItems: "center",
              textAlign: "center",
              py: 0.5,
              px: 0.75,
              minWidth: 0,
              maxWidth: "100%",
              border: 1,
              borderColor: alpha(theme.palette[tone].main, 0.17),
              borderRadius: 2,
              background: `linear-gradient(160deg, ${theme.palette.background.paper}, ${alpha(theme.palette[tone].main, 0.07)})`,
              boxShadow: `0 2px 3px ${alpha(theme.palette[tone].dark, 0.14)}, inset 0 1px ${theme.palette.background.paper}`,
              color: tone + ".dark",
            })}
          >
            {label && (
              <FontStyle component="span" fontSize={12}>
                {label}
              </FontStyle>
            )}
            <FontStyle
              component="span"
              fontSize={14}
              fontWeight={700}
              sx={{ fontVariantNumeric: "tabular-nums" }}
            >
              {time}
            </FontStyle>
          </Box>
        ))
      }
    />
  );
}

function HolidaySchedule({ name, scheduled }) {
  return (
    <Box
      sx={(theme) => ({
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        minWidth: 0,
        p: 1.25,
        border: 1,
        borderColor: alpha(theme.palette.success.main, 0.19),
        borderRadius: 2.5,
        background: `radial-gradient(ellipse at 95% 0%, ${alpha(theme.palette.success.main, 0.15)}, transparent 65%), linear-gradient(150deg, ${theme.palette.background.paper}, ${alpha(theme.palette.success.main, 0.05)})`,
        boxShadow: `0 4px 10px ${alpha(theme.palette.success.dark, 0.09)}, inset 0 1px ${theme.palette.background.paper}`,
      })}
    >
      <Box
        sx={(theme) => ({
          display: "grid",
          placeItems: "center",
          width: 42,
          height: 42,
          flexShrink: 0,
          borderRadius: 2.5,
          color: "success.dark",
          background: `linear-gradient(145deg, ${theme.palette.background.paper}, ${alpha(theme.palette.success.main, 0.16)})`,
          boxShadow: `0 3px 5px ${alpha(theme.palette.success.dark, 0.12)}, inset 0 1px ${theme.palette.background.paper}`,
        })}
      >
        <CoffeeOutlined aria-hidden />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <FontStyle component="div" fontSize={14} fontWeight={700} color="success.dark">
          {name}
        </FontStyle>
        <FontStyle component="div" fontSize={12} color="text.secondary">
          {scheduled ? "Ada jam kerja terjadwal pada hari ini." : "Tidak ada jam kerja terjadwal."}
        </FontStyle>
      </Box>
    </Box>
  );
}

function RecordedTimeline({ events, timezone, workDate }) {
  const entries = events.map((event) => {
    const zone = event.organization_timezone_snapshot || timezone;
    return {
      key: event.id ? event.event_date + "-" + event.id : event.event_type,
      type: event.event_type,
      date: attendanceLocalDate(event.occurred_at, zone),
      time: attendanceClock(event.occurred_at, zone),
    };
  });
  const days = new Set(entries.length ? entries.map(({ date }) => date) : [workDate]);
  const incoming = entries.filter(({ type }) => type === "check_in");
  const outgoing = entries.filter(({ type }) => type === "check_out");
  const dateBand = (theme) => timelineBand(theme, "primary");
  const midnight =
    days.size === 2 &&
    incoming.length &&
    outgoing.length &&
    incoming.every(({ date }) => date === incoming[0].date) &&
    outgoing.every(({ date }) => date === outgoing[0].date) &&
    incoming[0].date < outgoing[0].date;
  return (
    <Box sx={(theme) => timelineSurface(theme, "primary")}>
      {days.size === 1 && (
        <Box
          sx={(theme) => ({
            ...dateBand(theme),
            borderStartStartRadius: 7,
            borderStartEndRadius: 7,
          })}
        >
          <FontStyle component="h4" align="center" fontSize={15} fontWeight={700}>
            {dayjs(days.values().next().value).format("D MMM")}
          </FontStyle>
        </Box>
      )}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          position: "relative",
        }}
      >
        {Boolean(midnight) && (
          <Box
            component="span"
            sx={{
              position: "absolute",
              zIndex: 1,
              top: 0,
              left: "50%",
              transform: "translate(-50%, -50%)",
              px: 0.75,
              borderRadius: 8,
              bgcolor: "primary.dark",
              color: "common.white",
              boxShadow: 1,
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            00.00
          </Box>
        )}
        {[
          ["Masuk", "success", incoming],
          ["Pulang", "info", outgoing],
        ].map(([label, tone, direction], index) => (
          <Box
            key={label}
            component="section"
            aria-label={`Jam absen ${label.toLowerCase()}`}
            sx={{
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              ...(index === 1 && {
                borderInlineStart: "1px dashed",
                borderColor: (theme) => alpha(theme.palette.primary.main, 0.32),
              }),
            }}
          >
            {days.size > 1 && (
              <Box
                sx={(theme) => ({
                  ...dateBand(theme),
                  ...(index === 0 ? { borderStartStartRadius: 7 } : { borderStartEndRadius: 7 }),
                })}
              >
                <FontStyle component="h4" fontSize={15} fontWeight={700} align="center">
                  {[...new Set(direction.map(({ date }) => dayjs(date).format("D MMM")))].join(
                    " · ",
                  ) || "—"}
                </FontStyle>
              </Box>
            )}
            <Box
              sx={{
                display: "grid",
                flex: 1,
                alignContent: "center",
                justifyItems: "center",
                gap: 0.75,
                py: 1.25,
                px: 0.75,
              }}
            >
              {direction.length ? (
                direction.map(({ key, date, time }) => (
                  <Box
                    key={key}
                    sx={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 0,
                      maxWidth: "100%",
                      textAlign: "center",
                      columnGap: 0.75,
                      rowGap: 0.5,
                    }}
                  >
                    {direction.some((entry) => entry.date !== date) && (
                      <FontStyle
                        component="div"
                        fontSize={12}
                        color="text.secondary"
                        sx={{ flexBasis: "100%" }}
                      >
                        {dayjs(date).format("D MMM")}
                      </FontStyle>
                    )}
                    <FontStyle
                      component="span"
                      fontSize={{ xs: "1rem", sm: "1.0625rem", lg: "1.125rem" }}
                      fontWeight={700}
                      sx={{ lineHeight: 1.25, fontVariantNumeric: "tabular-nums" }}
                    >
                      {time}
                    </FontStyle>
                    <CompactInfoChip label={label} tone={tone} />
                  </Box>
                ))
              ) : (
                <FontStyle
                  aria-label={`Absen ${label.toLowerCase()}: belum ada catatan`}
                  fontSize={12}
                  color="text.secondary"
                  align="center"
                  sx={{ display: "grid", placeItems: "center", minHeight: 24 }}
                >
                  Absen {label.toLowerCase()} belum tercatat
                </FontStyle>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function AttendanceNotes({ events, timezone, workDate }) {
  const notes = events.filter((event) => event.attendance_note?.trim());
  if (!notes.length) return null;
  return (
    <Box
      component="section"
      aria-label="Catatan Pegawai"
      sx={(theme) => ({
        display: "grid",
        gap: 1.5,
        minWidth: 0,
        mt: 0.5,
        p: { xs: 1.5, sm: 2 },
        border: 1,
        borderColor: "divider",
        borderRadius: 2.5,
        bgcolor: theme.palette.background.paper,
        boxShadow: "0 3px 8px rgba(16, 30, 53, 0.06)",
      })}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <FileTextOutlined aria-hidden />
        <FontStyle component="h4" fontSize={14} fontWeight={700}>
          Catatan Pegawai
        </FontStyle>
      </Box>
      <Box component="ul" sx={{ display: "grid", gap: 1.5, listStyle: "none", m: 0, p: 0 }}>
        {notes.map((event) => (
          <Box
            component="li"
            key={event.event_date + "-" + event.id}
            sx={{ minWidth: 0, "& + &": { pt: 1.5, borderTop: 1, borderColor: "divider" } }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                columnGap: 1.5,
                rowGap: 0.25,
              }}
            >
              <FontStyle component="h5" fontSize={13} fontWeight={700}>
                {event.event_type === "check_in" ? "Absen masuk" : "Absen pulang"}
              </FontStyle>
              <FontStyle component="span" fontSize={12} color="text.secondary">
                {attendanceTime(
                  event.occurred_at,
                  event.organization_timezone_snapshot || timezone,
                  workDate,
                )}
              </FontStyle>
            </Box>
            <FontStyle
              component="p"
              fontSize={13}
              sx={{ mt: 0.5, lineHeight: 1.6, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}
            >
              {event.attendance_note}
            </FontStyle>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default function AttendanceSummaryDetails({ row, organizationId, onClose }) {
  const [preview, setPreview] = useState(null);
  const base = "/api/reports/attendance-summary/" + row.id;
  const query = new URLSearchParams({ organizationId });
  const { data, loading, error, retry } = useDashboardData(base + "?" + query);
  const detail = data?.row || row;
  const holidayName =
    detail.holiday_name ||
    {
      holiday: "Hari libur",
      off: "Libur jadwal",
    }[detail.attendance_status];
  const emptyHoliday = Boolean(
    holidayName && !data?.events.length && !detail.first_check_in && !detail.last_check_out,
  );
  const photoUrl = (id) => (id ? base + "/photos/" + id + "?" + query : null);
  const profilePhoto = photoUrl(detail.profile_photo_file_id);
  const missingDirections = ["check_in", "check_out"].filter(
    (type) => !data?.events.some((event) => event.event_type === type),
  );
  const summaryEvents = missingDirections.map((event_type) => ({
    event_type,
    occurred_at: event_type === "check_in" ? detail.first_check_in : detail.last_check_out,
  }));
  const eventCards = [
    ...summaryEvents.filter((event) => event.event_type === "check_in"),
    ...(data?.events || []),
    ...summaryEvents.filter((event) => event.event_type === "check_out"),
  ];
  const timelineEvents = data
    ? eventCards
        .filter((event) => event.occurred_at)
        .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at))
    : [];
  return (
    <>
      <AppModal
        open={!preview}
        keepMounted
        title="Rincian absensi"
        description="Lihat jadwal kerja dan bukti absen pegawai."
        descriptionAlign="left"
        icon="navigation:work-schedules"
        onClose={onClose}
        width={720}
        contentSx={{ p: { xs: 1.25, sm: 2 }, pt: 1 }}
        footer={<Button onClick={onClose}>Tutup</Button>}
      >
        {loading && <Skeleton active paragraph={{ rows: 5 }} />}
        {error && <ErrorState message={error.message} onRetry={retry} />}
        {data && (
          <Box sx={{ display: "grid", gap: 1.75, minWidth: 0 }}>
            <Box
              component="section"
              aria-label="Identitas Pegawai"
              sx={(theme) => ({
                minWidth: 0,
                p: { xs: 1.5, sm: 2 },
                border: 1,
                borderColor: "divider",
                borderRadius: 3.25,
                background: `linear-gradient(145deg, ${theme.palette.background.paper} 45%, ${theme.ui.panelSubtleBg})`,
                boxShadow: `0 5px 14px ${alpha(theme.palette.text.primary, 0.06)}, inset 0 1px ${theme.palette.background.paper}`,
              })}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                <Box
                  sx={(theme) => ({
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    width: 58,
                    height: 58,
                    borderRadius: 2.75,
                    background: `linear-gradient(145deg, ${theme.palette.background.paper}, ${alpha(theme.palette.primary.main, 0.13)})`,
                    boxShadow: `0 4px 8px ${alpha(theme.palette.primary.dark, 0.11)}, inset 0 1px ${theme.palette.background.paper}`,
                  })}
                >
                  <PhotoAvatar
                    name={detail.full_name}
                    photoUrl={profilePhoto}
                    variant="rounded"
                    fallbackIcon={<UserOutlined aria-hidden style={{ fontSize: 27 }} />}
                    size={54}
                    onPreview={({ imageUrl, title }) => setPreview({ url: imageUrl, title })}
                    photoLabel="Foto Pegawai"
                  />
                </Box>
                <Box sx={{ display: "grid", gap: 0.25, minWidth: 0 }}>
                  <FontStyle
                    component="h3"
                    fontSize={{ xs: 16, sm: 19 }}
                    fontWeight={700}
                    sx={{ lineHeight: 1.25 }}
                  >
                    {detail.full_name}
                  </FontStyle>
                  <FontStyle color="text.secondary" fontSize={12}>
                    {detail.employee_no ? `NIP ${detail.employee_no}` : "NIP belum tersedia"}
                  </FontStyle>
                  <FontStyle component="div" color="text.secondary" fontSize={12}>
                    {[detail.organization_unit_name, detail.location_name]
                      .filter(Boolean)
                      .join(" · ")}
                  </FontStyle>
                </Box>
              </Box>
            </Box>
            <DetailSection
              title="Jadwal kerja"
              Icon={CalendarOutlined}
              tone={holidayName ? "success" : "info"}
            >
              {holidayName && (
                <HolidaySchedule name={holidayName} scheduled={Boolean(detail.schedule.length)} />
              )}
              <ScheduleTimeline
                row={detail}
                timezone={data.timezone}
                tone={holidayName ? "success" : "info"}
              />
            </DetailSection>
            <DetailSection title="Absensi tercatat" Icon={ClockCircleOutlined} tone="primary">
              {!emptyHoliday && (
                <RecordedTimeline
                  events={timelineEvents}
                  timezone={data.timezone}
                  workDate={detail.work_date}
                />
              )}
              {emptyHoliday ? (
                <FontStyle color="text.secondary">Belum ada absen tercatat.</FontStyle>
              ) : (
                <Box sx={pairGrid}>
                  {eventCards.map((event) => {
                    const title = event.event_type === "check_in" ? "Absen masuk" : "Absen pulang";
                    const recorded = Boolean(event.occurred_at);
                    return (
                      <Box
                        component="article"
                        key={event.id ? event.event_date + "-" + event.id : event.event_type}
                        sx={eventCardSx}
                      >
                        <FontStyle component="h4" fontWeight={650}>
                          {title}
                        </FontStyle>
                        <AttendancePhoto
                          event={event}
                          title={title}
                          recorded={recorded}
                          url={photoUrl(event.photo_id)}
                          canViewPhotos={data.canViewPhotos}
                          onPreview={setPreview}
                        />
                      </Box>
                    );
                  })}
                </Box>
              )}
              <AttendanceNotes
                events={data.events}
                timezone={data.timezone}
                workDate={detail.work_date}
              />
            </DetailSection>
            {(!emptyHoliday || attendanceRowIndicators(detail).length > 0) && (
              <DetailSection title="Peta absensi" Icon={EnvironmentOutlined} tone="info">
                <AttendanceEventMap
                  events={data.events}
                  provider={data.mapProvider}
                  name={detail.full_name}
                  photo={profilePhoto}
                  timezone={data.timezone}
                  allowed={data.canViewPhotos}
                  rowIndicators={attendanceRowIndicators(detail)}
                  rowMetrics={detail}
                />
              </DetailSection>
            )}
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
