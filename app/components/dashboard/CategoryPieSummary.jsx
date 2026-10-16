"use client";

import { Box, useTheme } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";
import DonutChart from "./DonutChart";

/** Komposisi jenis dengan jumlah eksplisit, termasuk kategori bernilai nol. */
export default function CategoryPieSummary({ data, unit = "cuti/izin", emptyDescription }) {
  const theme = useTheme();
  const labels = data?.labels || [];
  const values = labels.map((_, index) => Number(data?.series[index] || 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  const format = (value) => new Intl.NumberFormat("id-ID").format(value);
  const colors = [theme.palette.primary.main, theme.status.info.main, theme.status.warning.main, theme.status.success.main, theme.palette.secondary.main, theme.status.neutral.main];
  return <Box sx={{ display: "grid", gap: 2, minWidth: 0 }}>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "minmax(0,1.05fr) minmax(0,1fr)" }, gap: 3, alignItems: "center", minWidth: 0 }}>
      {total ? <DonutChart type="donut" totalLabel="Total cuti & izin" data={{ labels, series: values }} unit={unit} colors={colors} legend={false} height={260} />
        : <Box sx={{ minHeight: 180, display: "grid", placeItems: "center", textAlign: "center" }}><FontStyle fontSize={13} sx={{ color: "text.secondary" }}>{emptyDescription || `Belum ada ${unit} yang disetujui tahun ini.`}</FontStyle></Box>}
      <Box sx={{ width: "100%", maxWidth: 288, minWidth: 0, justifySelf: { xs: "center", sm: "start" }, pr: { xs: 0, sm: 2 } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, pb: 1, px: 1 }}>
          <FontStyle fontSize={11} fontWeight={600} sx={{ color: "text.secondary" }}>Jenis cuti & izin</FontStyle>
          <FontStyle fontSize={11} fontWeight={600} sx={{ color: "text.secondary" }}>Jumlah</FontStyle>
        </Box>
        <Box component="ul" aria-label="Jumlah cuti dan izin per jenis" tabIndex={0} sx={{ m: 0, p: 0, listStyle: "none", minWidth: 0, maxHeight: 240, overflowY: "auto", overscrollBehavior: "contain", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" }, "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 } }}>
          {labels.length ? labels.map((label, index) => <Box component="li" key={`${label}:${index}`} sx={{ display: "grid", gridTemplateColumns: "8px minmax(0,1fr) auto", alignItems: "center", gap: 1.25, minHeight: 44, px: 1, py: 1, borderBottom: "1px solid", borderColor: "divider", "&:last-child": { borderBottom: 0 } }}>
            <Box aria-hidden sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: colors[index % colors.length] }} />
            <FontStyle fontSize={12} sx={{ overflowWrap: "anywhere", lineHeight: 1.5 }}>{label}</FontStyle><FontStyle fontSize={14} fontWeight={700} sx={{ fontVariantNumeric: "tabular-nums" }}>{format(values[index])}</FontStyle>
          </Box>) : <FontStyle fontSize={12}>Jenis cuti dan izin belum tersedia.</FontStyle>}
        </Box>
        {labels.length > 5 ? <FontStyle fontSize={11} sx={{ mt: 1, px: 1, color: "text.secondary" }}>Gulir untuk melihat jenis lainnya.</FontStyle> : null}
      </Box>
    </Box>
  </Box>;
}
