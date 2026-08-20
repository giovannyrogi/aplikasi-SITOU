"use client";

import { Box } from "@mui/material";
import FontStyle from "../font-style/FontStyle";

/**
 * Footer copyright ringan yang bisa dipakai di halaman auth maupun halaman lain.
 * Komponen ini sengaja hanya mengatur teks copyright dan spacing aman agar
 * posisinya konsisten serta tidak menutupi konten di mobile.
 */
export default function AppCopyrightFooter({
  companyName = "Perumda Pasar Manado",
  appName,
  version,
  year = new Date().getFullYear(),
  sx = {},
}) {
  return (
    <Box
      component="footer"
      sx={{
        width: "100%",
        flexShrink: 0,
        pt: { xs: 1, sm: 1.25 },
        pb: {
          xs: "calc(16px + env(safe-area-inset-bottom))",
          sm: 2,
          md: 2.5,
        },
        px: { xs: 2, sm: 3 },
        bgcolor: "transparent",
        position: "relative",
        zIndex: 1,
        textAlign: "center",
        ...sx,
      }}
    >
      <FontStyle
        component="p"
        align="center"
        fontWeight={500}
        sx={{
          color: "rgba(17, 24, 39, 0.52)",
          fontSize: { xs: 11, sm: 12.5 },
          lineHeight: 1.5,
        }}
      >
        &copy; {year} {companyName}
        {appName ? ` · ${appName}${version ? ` ${version}` : ""}` : ""}
      </FontStyle>
    </Box>
  );
}
