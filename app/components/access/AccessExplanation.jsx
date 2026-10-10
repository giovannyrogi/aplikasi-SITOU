"use client";
import { Box } from "@mui/material";
import AppIcon from "@/app/components/icons/AppIcon";
import FontStyle from "@/app/components/font-style/FontStyle";
/** Uraian izin dengan hierarchy dan kontras yang sama pada form/rincian akses. */
export default function AccessExplanation({ children, title = "Kemampuan akses" }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1,
        p: 1.5,
        minWidth: 0,
        bgcolor: "action.hover",
        borderRadius: 1,
      }}
    >
      <AppIcon
        icon="solar:info-circle-bold"
        fontSize="16px"
        style={{ flexShrink: 0, marginTop: 2 }}
      />
      <Box sx={{ display: "grid", gap: 0.5, minWidth: 0 }}>
        <FontStyle fontSize={11.5} fontWeight={600}>
          {title}
        </FontStyle>
        <FontStyle
          explanation
          fontSize={12}
          color="text.secondary"
          sx={{ lineHeight: 1.6, overflowWrap: "anywhere" }}
        >
          {children}
        </FontStyle>
      </Box>
    </Box>
  );
}
