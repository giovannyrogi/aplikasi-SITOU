"use client";

import { useState } from "react";
import ContractEmployeesModal from "./ContractEmployeesModal";
import { Box, IconButton, Tooltip } from "@mui/material";
import AppIcon from "@/app/components/icons/AppIcon";
import AppIconTile from "@/app/components/icons/AppIconTile";
import FontStyle from "@/app/components/font-style/FontStyle";
import { formatChartTooltipCategory } from "./chartAdapter";

/** Jadwal kontrak mendatang; modal bulan memakai filter sumber laporan yang sama. */
export default function ContractEndingSummary({ data }) {
  const [selected, setSelected] = useState(null);
  const rows = (data?.categories || []).map((period, index) => ({ period, count: Number(data?.series?.[0]?.data[index] || 0) }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const format = (value) => new Intl.NumberFormat("id-ID").format(value);
  const monthFilters = (period) => {
    const lastDay = new Date(`${period}-01T00:00:00Z`);
    lastDay.setUTCMonth(lastDay.getUTCMonth()+1);
    lastDay.setUTCDate(0);
    const startDate = `${period}-01` < data.startDate ? data.startDate : `${period}-01`;
    return { organizationId: data.organizationId, group: "upcoming", period: "custom", startDate, endDate: lastDay.toISOString().slice(0,10), contractStatus: "active", successor: "all" };
  };
  return <Box sx={{ minWidth: 0, display: "grid", gap: 2 }}>
    <Box sx={{ display: "flex", alignItems: "center", gap: 2, pb: 2, borderBottom: "1px solid", borderColor: "divider" }}>
      <Box><FontStyle fontSize={30} fontWeight={700} sx={{ lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>{format(total)}</FontStyle><FontStyle fontSize={12} sx={{ mt: 0.5, color: "text.secondary" }}>kontrak akan berakhir</FontStyle></Box>
    </Box>
    <Box role="region" aria-label="Jadwal kontrak berakhir per bulan" tabIndex={0} sx={{ maxHeight: 320, overflowY: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" }, "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 } }}>
      {rows.map((row) => <Box key={row.period} sx={{ py: 2, px: 0.5, display: "grid", gridTemplateColumns: "40px minmax(0,1fr) auto", gap: 1.5, alignItems: "center", borderBottom: "1px solid", borderColor: "divider", "&:last-child": { borderBottom: 0 }, ...(row.count > 0 && data.canOpenReport ? { "&:hover": { bgcolor: "action.hover" } } : {}) }}>
        <AppIconTile icon="solar:calendar-date-bold-duotone" tone={row.count ? "brand" : "neutral"} size={40} iconSize={20} />
        <Box sx={{ minWidth: 0 }}>
          <FontStyle fontSize={13} fontWeight={600}>{formatChartTooltipCategory(row.period)}</FontStyle>
          {row.count ? <FontStyle fontSize={12} sx={{ mt: 0.5, color: "text.secondary" }}><Box component="span" sx={{ fontSize: 16, fontWeight: 700, color: "text.primary", fontVariantNumeric: "tabular-nums" }}>{format(row.count)}</Box> kontrak berakhir</FontStyle>
            : <FontStyle fontSize={12} sx={{ mt: 0.5, color: "text.secondary" }}>Tidak ada kontrak berakhir</FontStyle>}
        </Box>
        {row.count > 0 && data.canOpenReport ? <Tooltip title={`Lihat pegawai - ${formatChartTooltipCategory(row.period)}`}><IconButton onClick={()=>setSelected(row.period)} aria-label={`Lihat pegawai dengan kontrak berakhir ${formatChartTooltipCategory(row.period)}`} sx={{ width: 44, height: 44, borderRadius: 1, color: "primary.main", border: "1px solid", borderColor: "divider", "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 } }}><AppIcon icon="solar:eye-linear" width={20}/></IconButton></Tooltip> : null}
      </Box>)}
    </Box>
    {selected && data.canOpenReport ? <ContractEmployeesModal key={selected} period={selected} filters={monthFilters(selected)} onClose={()=>setSelected(null)} /> : null}
  </Box>;
}
