"use client";
import AppCollapse from "@/app/components/data-display/AppCollapse";
import { Box } from "@mui/material";
import { Checkbox } from "antd";
import { mobileDataTypography } from "@/app/components/data-display/mobileDataTypography.mjs";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
export const categoryLabel = (category) =>
  category === "national"
    ? "Libur nasional"
    : category === "joint_leave"
      ? "Cuti bersama"
      : "Libur organisasi";
export const displayDate = (date) =>
  new Date(date + "T00:00:00Z").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
export default function HolidayDateList({
  days,
  selected,
  onSelect,
  reason = () => "",
  previous = () => null,
  sourceInfo,
}) {
  const choice = (d) =>
    onSelect ? (
      <Checkbox
        checked={selected.includes(d.id)}
        disabled={Boolean(reason(d))}
        onChange={(e) => onSelect(d.id, e.target.checked)}
        aria-label={`Pilih ${d.name}, ${displayDate(d.date)}`}
        style={{ minHeight: 44, minWidth: 44, display: "flex", alignItems: "center" }}
      />
    ) : null;
  const name = (d) => (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      <FontStyle fontWeight={600}>{d.name}</FontStyle>
      {reason(d) && <FontStyle color="text.secondary">{reason(d)}</FontStyle>}
      {previous(d) && <FontStyle color="text.secondary">Sebelumnya: {previous(d)}</FontStyle>}
      {sourceInfo?.(d)}
    </Box>
  );
  return (
    <Box sx={{ minWidth: 0, ...mobileDataTypography }}>
      <AppCollapse
        defaultActiveKey={[]}
        items={["national", "joint_leave"].map((category) => {
          const rows = days.filter((d) => d.category === category);
          const chosen = onSelect ? rows.filter((d) => selected.includes(d.id)).length : 0;
          return {
            key: category,
            forceRender: true,
            label: (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 1.5,
                  minWidth: 0,
                }}
              >
                <FontStyle fontSize={14} fontWeight={600}>
                  {categoryLabel(category)}
                </FontStyle>
                <FontStyle fontSize={14} color="text.secondary">
                  {rows.length} tanggal{onSelect ? ` · ${chosen} dipilih` : ""}
                </FontStyle>
              </Box>
            ),
            children: (
              <ResponsiveDataView
                data={rows}
                rowKey="id"
                scrollX={500}
                columns={[
                  ...(onSelect ? [{ title: "Pilih", width: 65, render: (_, d) => choice(d) }] : []),
                  { title: "Tanggal", dataIndex: "date", width: 160, render: displayDate },
                  { title: "Nama hari libur", render: (_, d) => name(d) },
                ]}
                emptyDescription="Tidak ada tanggal pada kategori ini."
                renderCard={(d) => (
                  <Box sx={{ display: "grid", gap: 1 }}>
                    {onSelect && choice(d)}
                    <FontStyle>{displayDate(d.date)}</FontStyle>
                    {name(d)}
                    <CompactInfoChip
                      label={categoryLabel(category)}
                      tone={category === "national" ? "success" : "info"}
                    />
                  </Box>
                )}
              />
            ),
          };
        })}
      />
    </Box>
  );
}
