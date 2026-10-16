"use client";
import { Box, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import InventoryItemPhoto from "@/app/components/inventory/InventoryItemPhoto";

const quantity = (value) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(Number(value));

export default function StockAttentionCard({ item, organizationId, onPreview, isClone = false }) {
  const theme = useTheme();
  const empty = item.condition === "empty";
  const tone = {
    main: theme.palette.primary.main,
    text: theme.palette.primary.dark,
    background: theme.ui.panelAccentBg,
    border: alpha(theme.palette.primary.main, 0.2),
  };
  return (
    <Box
      component="article"
      sx={{
        minWidth: 0,
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        border: "1px solid",
        borderColor: theme.ui.panelBorderSubtle,
        borderTop: `3px solid ${tone.main}`,
        borderRadius: 2.5,
        bgcolor: theme.ui.panelBg,
        boxShadow: theme.ui.panelShadow,
        transition: "transform 200ms ease, box-shadow 200ms ease",
        "&:hover, &:focus-within": {
          transform: "translateY(-3px)",
          boxShadow: theme.ui.dashboardCardHoverShadow,
        },
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
          "&:hover, &:focus-within": { transform: "none" },
        },
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
        <CompactInfoChip
          label={empty ? "Stok habis" : "Stok segera habis"}
          color={tone.main}
        />
      </Box>
      <Box
        sx={{
          display: "grid",
          placeItems: "center",
          bgcolor: theme.ui.panelSubtleBg,
          borderRadius: 2,
          p: 1.5,
        }}
      >
        <InventoryItemPhoto
          item={item}
          organizationId={organizationId}
          onPreview={onPreview}
          size={104}
          fit="contain"
          tabIndex={isClone ? -1 : undefined}
        />
      </Box>
      <Box sx={{ display: "grid", gap: 0.75 }}>
        <FontStyle fontSize={14} fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
          {item.name}
        </FontStyle>
        <FontStyle fontSize={11.5} sx={{ color: "text.secondary", overflowWrap: "anywhere" }}>
          {item.warehouse_name}
        </FontStyle>
      </Box>
      <Box
        sx={{
          mt: "auto",
          p: 1.5,
          borderRadius: 2,
          bgcolor: tone.background,
          display: "grid",
          gap: 0.75,
        }}
      >
        <FontStyle fontSize={11.5} fontWeight={700} sx={{ color: tone.text }}>
          Stok tersedia
        </FontStyle>
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: 0.5,
            color: tone.text,
          }}
        >
          <FontStyle
            fontSize={26}
            fontWeight={700}
            sx={{ lineHeight: 1.2, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}
          >
            {quantity(item.quantity)}
          </FontStyle>
          <FontStyle fontSize={12} fontWeight={600} sx={{ overflowWrap: "anywhere" }}>
            {item.unit_name}
          </FontStyle>
        </Box>
        <Box sx={{ pt: 1, mt: 0.25, borderTop: "1px solid", borderColor: tone.border }}>
          <FontStyle fontSize={11.5} fontWeight={700} sx={{ color: theme.status.warning.text, overflowWrap: "anywhere" }}>
            Batas minimum:{" "}
            <Box component="span" sx={{ fontWeight: "inherit" }}>
              {quantity(item.minimum_stock)} {item.unit_name}
            </Box>
          </FontStyle>
        </Box>
      </Box>
    </Box>
  );
}
