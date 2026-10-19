"use client";

import { Box, Divider, useTheme } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";

/** Isi kartu laporan; bingkai, nomor baris, dan pagination tetap milik ResponsiveDataView. */
export default function InventoryReportCardContent({
  identity,
  status,
  facts,
  quantities,
  people,
  action,
}) {
  const theme = useTheme();
  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
      <Box sx={{ display: "grid", gap: 2, minWidth: 0 }}>
        {identity}
        {status ? <Box sx={{ display: "flex", justifyContent: "flex-start" }}>{status}</Box> : null}
      </Box>
      <Box
        component="dl"
        sx={{ m: 0, display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 2 }}
      >
        {facts.map(({ label, value, fullWidth }) => (
          <Box key={label} sx={{ minWidth: 0, gridColumn: fullWidth ? "1 / -1" : undefined }}>
            <FontStyle component="dt" fontSize={12} sx={{ color: "text.secondary", mb: 1 }}>
              {label}
            </FontStyle>
            <FontStyle
              component="dd"
              fontSize={13.5}
              fontWeight={600}
              sx={{ m: 0, overflowWrap: "anywhere" }}
            >
              {value || "Tidak tersedia"}
            </FontStyle>
          </Box>
        ))}
      </Box>
      {people ? <Box sx={{ display: "grid", gap: 2 }}>{people}</Box> : null}
      <Box
        component="dl"
        aria-label="Jumlah barang"
        sx={{
          m: 0,
          p: 2,
          borderRadius: 2,
          bgcolor: theme.ui.panelSubtleBg,
          display: "grid",
          gap: 2,
        }}
      >
        {quantities.map(({ label, value, emphasis }) => (
          <Box
            key={label}
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) fit-content(60%)",
              gap: 1,
              ...(emphasis ? { pt: 2, borderTop: `1px solid ${theme.ui.panelBorderSubtle}` } : {}),
            }}
          >
            <FontStyle
              component="dt"
              fontSize={13}
              fontWeight={emphasis ? 700 : 500}
              sx={{ alignSelf: "center" }}
            >
              {label}
            </FontStyle>
            <FontStyle
              component="dd"
              fontSize={emphasis ? 16 : 13.5}
              fontWeight={emphasis ? 700 : 600}
              sx={{
                m: 0,
                textAlign: "right",
                overflowWrap: "anywhere",
                fontVariantNumeric: "tabular-nums",
                color: emphasis ? theme.status.info.text : "text.primary",
              }}
            >
              {value}
            </FontStyle>
          </Box>
        ))}
      </Box>
      {action ? (
        <Box sx={{ display: "grid", gap: 3 }}>
          <Divider />
          {action}
        </Box>
      ) : null}
    </Box>
  );
}
