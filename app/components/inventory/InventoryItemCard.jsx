"use client";

import { useState } from "react";
import { Box, useTheme } from "@mui/material";
import AppIcon from "@/app/components/icons/AppIcon";
import FontStyle from "@/app/components/font-style/FontStyle";

function ItemMedia({ item, organizationId, onPreview, compact }) {
  const theme = useTheme();
  const [broken, setBroken] = useState(false);
  const photoUrl = item?.photo_file_id && organizationId
    ? `/api/uploads/${encodeURIComponent(item.photo_file_id)}?organizationId=${encodeURIComponent(organizationId)}`
    : null;
  const hasPhoto = Boolean(photoUrl && !broken);

  return (
    <Box sx={{
      width: compact ? { xs: 64, sm: 72 } : { xs: 88, sm: 112 },
      height: compact ? { xs: 64, sm: 72 } : { xs: 88, sm: 112 },
      flexShrink: 0, borderRadius: 2, overflow: "hidden",
      bgcolor: theme.ui.panelSubtleBg,
      border: `1px solid ${theme.ui.panelBorderSubtle}`,
      boxShadow: theme.shadows[1],
    }}>
      {hasPhoto ? (
        <Box component="button" type="button" aria-label={`Perbesar foto barang ${item.name}`}
          onClick={() => onPreview?.(item, photoUrl)}
          sx={{ display: "block", width: "100%", height: "100%", p: 0, border: 0,
            cursor: "zoom-in", bgcolor: "transparent",
            "&:focus-visible": { outline: `3px solid ${theme.palette.primary.main}`, outlineOffset: -3 } }}>
          <Box component="img" src={photoUrl} alt={`Foto ${item.name}`} loading="lazy"
            onError={() => setBroken(true)} sx={{ width: "100%", height: "100%", objectFit: "cover" }}/>
        </Box>
      ) : (
        <Box role="img" aria-label={`Foto ${item?.name || "barang"} belum tersedia`}
          sx={{ height: "100%", display: "grid", alignContent: "center", justifyItems: "center",
            gap: 0.5, color: theme.ui.mutedText }}>
          <AppIcon icon="solar:gallery-wide-bold-duotone" width={compact ? 23 : 27}/>
          <FontStyle fontSize={compact ? 10 : 10.5} sx={{ textAlign: "center" }}>Tanpa foto</FontStyle>
        </Box>
      )}
    </Box>
  );
}

/** Kerangka kartu dan identitas barang bersama untuk katalog dan ringkasan transaksi. */
export default function InventoryItemCard({ item, organizationId, onPreview, action, meta, compact = false,
  interactive = false, showAttributes = false, component = "article", children, ...rootProps }) {
  const theme = useTheme();
  return (
    <Box component={component} {...rootProps} sx={{
      minWidth: 0, p: { xs: 1.5, sm: 2 },
      border: `1px solid ${theme.ui.panelBorderSubtle}`, borderRadius: 2.5,
      bgcolor: theme.ui.panelBg, boxShadow: theme.ui.panelShadow,
      display: "grid", alignContent: "start", gap: 2,
      ...(interactive ? { transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
        "&:hover": { transform: "translateY(-3px)", borderColor: theme.ui.panelBorder, boxShadow: theme.shadows[3] },
        "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover": { transform: "none" } } } : {}),
    }}>
      <Box sx={{ display: "flex", gap: { xs: 1.5, sm: 2 }, minWidth: 0, alignItems: "flex-start" }}>
        <ItemMedia item={item} organizationId={organizationId} onPreview={onPreview} compact={compact}/>
        <Box sx={{ display: "grid", alignContent: "start", gap: 0.75, minWidth: 0, flex: 1 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 0.5, minWidth: 0 }}>
            <FontStyle component="h3" fontSize={{ xs: 14, sm: 15 }} fontWeight={700}
              sx={{ minWidth: 0, overflowWrap: "anywhere", lineHeight: 1.4 }}>{item?.name || "Barang"}</FontStyle>
            {action}
          </Box>
          {item?.code ? <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText, overflowWrap: "anywhere" }}>{item.code}</FontStyle> : null}
          {meta}
        </Box>
      </Box>
      {showAttributes ? <Box sx={{
        display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5,
        pt: 1.5, borderTop: `1px solid ${theme.ui.panelBorderSubtle}`,
      }}>
        {[["Kategori", item?.category_name], ["Satuan dasar", item?.unit_name || item?.unit]].map(([label, value]) => (
          <Box key={label} sx={{ minWidth: 0 }}>
            <FontStyle fontSize={11} sx={{ color: theme.ui.mutedText, mb: 0.5 }}>{label}</FontStyle>
            <FontStyle fontSize={12.5} fontWeight={600} sx={{ overflowWrap: "anywhere" }}>{value || "—"}</FontStyle>
          </Box>
        ))}
      </Box> : null}
      {children}
    </Box>
  );
}
