"use client";
import { Box } from "@mui/material";
import AppNotice from "@/app/components/data-display/AppNotice";
import AppCollapse from "@/app/components/data-display/AppCollapse";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import { hoursLabel } from "@/lib/work-schedules/dailyAdjustment.mjs";
import { addDays } from "@/lib/work-schedules/rules.mjs";

const dateFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "UTC" });
const calendarDate = (date) => new Date(`${date}T00:00:00Z`);
const periodLabel = (from, until) =>
  dateFormatter.formatRange(calendarDate(from), calendarDate(until));

const displayHours = (sessions) =>
  sessions.map(({ rules }) => ({
    label: hoursLabel({ ...rules, nextDay: false }),
    nextDay: Boolean(rules.nextDay),
  }));

function reviewPeriods(changes, adding) {
  const periods = [];
  for (const row of changes) {
    const before = displayHours(row.before);
    const changedHours = adding
      ? row.after.filter(({ startsAt, endsAt }) =>
          row.before.every((hour) => hour.startsAt !== startsAt || hour.endsAt !== endsAt),
        )
      : row.after;
    const change = displayHours(changedHours);
    const signature = JSON.stringify([before, change, row.dayOffLabel]);
    const last = periods.at(-1);
    if (
      last?.employeeId === row.employeeId &&
      last.signature === signature &&
      addDays(last.until, 1) === row.date
    )
      last.until = row.date;
    else periods.push({ ...row, before, change, signature, until: row.date });
  }
  return periods;
}

function HoursList({ sessions }) {
  return sessions.length ? (
    <Box component="ul" sx={{ display: "grid", gap: 0.75, listStyle: "none", m: 0, p: 0 }}>
      {sessions.map(({ label, nextDay }, index) => (
        <Box component="li" key={`${label}:${index}`}>
          <FontStyle component="span" fontSize={14} sx={{ fontVariantNumeric: "tabular-nums" }}>
            {label}
          </FontStyle>
          {nextDay && (
            <FontStyle fontSize={13} color="text.secondary">
              Berakhir hari berikutnya
            </FontStyle>
          )}
        </Box>
      ))}
    </Box>
  ) : (
    <FontStyle fontSize={14} color="text.secondary">
      Tidak ada jam kerja
    </FontStyle>
  );
}

function ReviewField({ label, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <FontStyle component="dt" fontSize={13} color="text.secondary">
        {label}
      </FontStyle>
      <FontStyle component="dd" fontSize={14} fontWeight={500} sx={{ m: 0, mt: 0.5 }}>
        {children}
      </FontStyle>
    </Box>
  );
}

export default function DailyAdjustmentReview({ review, page, pageSize }) {
  const {
    input,
    scheduleName,
    shiftLabel,
    employeeCount,
    dayCount,
    existingCount,
    changes,
    previousAdjustments,
  } = review;
  const adding = input.mode === "add";
  const periods = reviewPeriods(changes.slice((page - 1) * pageSize, page * pageSize), adding);
  return (
    <Box
      sx={(theme) => ({
        display: "grid",
        gap: 2,
        mt: 2.5,
        p: 2,
        minWidth: 0,
        border: `1px solid ${theme.ui.panelBorderSubtle}`,
        borderRadius: 2,
        bgcolor: theme.ui.panelSubtleBg,
      })}
    >
      <Box
        component="dl"
        sx={{
          m: 0,
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        <ReviewField label="Periode">
          {periodLabel(input.from, input.until)}
          <FontStyle
            component="span"
            fontSize={13}
            color="text.secondary"
            sx={{ display: "block" }}
          >
            {employeeCount} Pegawai · {dayCount} hari
          </FontStyle>
        </ReviewField>
        <ReviewField label="Jenis perubahan">
          {adding ? "Tambah jam kerja" : "Ganti jam kerja"}
          {scheduleName && (
            <FontStyle
              component="span"
              fontSize={13}
              color="text.secondary"
              sx={{ display: "block" }}
            >
              {[scheduleName, shiftLabel].filter(Boolean).join(" · ")}
            </FontStyle>
          )}
        </ReviewField>
      </Box>
      {!adding && existingCount > 0 && (
        <AppNotice
          tone="warning"
          description={`${existingCount} perubahan harian sebelumnya akan diganti.`}
          descriptionAlign="left"
        />
      )}
      <Box
        component="section"
        aria-label="Jam kerja"
        sx={{ pt: 1.5, borderTop: 1, borderColor: "divider", minWidth: 0 }}
      >
        {periods.length === 0 && (
          <FontStyle fontSize={14} color="text.secondary">
            Tidak ada perubahan jam kerja.
          </FontStyle>
        )}
        <AppCollapse
          key={page}
          defaultActiveKey={periods.length ? [`${periods[0].employeeId}:${periods[0].date}`] : []}
          items={periods.map((row) => ({
            key: `${row.employeeId}:${row.date}`,
            label: (
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
                  <FontStyle fontSize={14} fontWeight={600}>
                    {periodLabel(row.date, row.until)}
                  </FontStyle>
                  {row.dayOffLabel && <CompactInfoChip label={row.dayOffLabel} tone="info" wrap />}
                </Box>
                {employeeCount > 1 && (
                  <FontStyle fontSize={13} sx={{ mt: 0.5 }}>
                    {row.employeeName} · NIP {row.employeeNo}
                  </FontStyle>
                )}
              </Box>
            ),
            children: (
              <Box sx={{ display: "grid", gap: 2 }}>
                <Box
                  component="dl"
                  sx={{
                    display: "grid",
                    gap: 2,
                    m: 0,
                    gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
                  }}
                >
                  <ReviewField label="Jam kerja yang berlaku">
                    <HoursList sessions={row.before} />
                  </ReviewField>
                  <ReviewField label={adding ? "Jam kerja tambahan" : "Jam kerja pengganti"}>
                    <HoursList sessions={row.change} />
                  </ReviewField>
                </Box>
                <Box component="dl" sx={{ m: 0, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                  <ReviewField label="Alasan perubahan">{input.reason}</ReviewField>
                </Box>
              </Box>
            ),
          }))}
        />
      </Box>
      {previousAdjustments?.entries.length > 0 && (
        <Box>
          <FontStyle fontSize={14} fontWeight={600} sx={{ mb: 1 }}>
            Perubahan sebelumnya
          </FontStyle>
          <AppCollapse
            items={previousAdjustments.entries.map((entry) => ({
              key: entry.id,
              label: (
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
                  <FontStyle fontSize={14}>{periodLabel(entry.from, entry.until)}</FontStyle>
                  <CompactInfoChip
                    label={entry.mode === "add" ? "Tambah jam kerja" : "Ganti jam kerja"}
                    tone="neutral"
                  />
                </Box>
              ),
              children: (
                <Box component="dl" sx={{ m: 0, display: "grid", gap: 1.5 }}>
                  {employeeCount > 1 && (
                    <ReviewField label="Pegawai">
                      {Array.from(new Map(changes.map((row) => [row.employeeId, row.employeeName])))
                        .filter(([id]) => entry.employeeIds.includes(id))
                        .map(([, name]) => name)
                        .join(", ")}
                    </ReviewField>
                  )}
                  <ReviewField label="Alasan perubahan">
                    {entry.reason || "Alasan tidak tersedia."}
                  </ReviewField>
                </Box>
              ),
            }))}
          />
          {previousAdjustments.limited && (
            <FontStyle fontSize={13} color="text.secondary" sx={{ mt: 1 }}>
              Menampilkan 20 perubahan terakhir pada periode ini.
            </FontStyle>
          )}
        </Box>
      )}
    </Box>
  );
}
