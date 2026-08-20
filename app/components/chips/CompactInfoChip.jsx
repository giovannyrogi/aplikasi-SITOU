"use client";

import React from "react";
import { Chip, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";

/**
 * Chip ringkas untuk metadata tabel seperti jenis permohonan, sektor,
 * dan komoditas agar tinggi, padding, dan baseline konsisten.
 */
export default function CompactInfoChip({ label, color, sx }) {
  const theme = useTheme();
  const resolvedColor = color || theme.palette.primary.main;

  return (
    <Chip
      size="small"
      label={label || "-"}
      sx={{
        height: 23,
        maxWidth: "100%",
        flexShrink: 0,
        borderRadius: 1.2,
        color: resolvedColor,
        bgcolor: alpha(resolvedColor, 0.09),
        border: `1px solid ${alpha(resolvedColor, 0.22)}`,
        "& .MuiChip-label": {
          px: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontSize: 11.5,
          fontWeight: 700,
          lineHeight: 1,
        },
        ...sx,
      }}
    />
  );
}
