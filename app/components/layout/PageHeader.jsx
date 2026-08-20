"use client";

import { Box, useTheme } from "@mui/material";
import FontStyle from "../font-style/FontStyle";

export default function PageHeader({ eyebrow = "Data Master", title, description, count, action }) {
  const theme = useTheme();
  return (
    <Box
      component="header"
      sx={{
        display: "flex",
        alignItems: { xs: "stretch", sm: "flex-start" },
        justifyContent: "space-between",
        flexDirection: { xs: "column", sm: "row" },
        gap: 2,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <FontStyle
          fontSize={11}
          fontWeight={600}
          sx={{ color: theme.palette.primary.main, textTransform: "uppercase" }}
        >
          {eyebrow}
        </FontStyle>
        <Box sx={{ mt: 0.5, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <FontStyle component="h1" fontSize={{ xs: 20, sm: 24 }} fontWeight={700}>
            {title}
          </FontStyle>
          {Number.isFinite(count) ? (
            <FontStyle
              component="span"
              fontSize={11.5}
              fontWeight={600}
              sx={{
                px: 1,
                py: 0.4,
                borderRadius: 999,
                color: theme.palette.primary.main,
                bgcolor: theme.ui.navUserBg,
              }}
            >
              {count} data
            </FontStyle>
          ) : null}
        </Box>
        {description ? (
          <FontStyle
            fontSize={12.5}
            sx={{ mt: 0.75, maxWidth: 720, color: theme.ui.mutedText, lineHeight: 1.65 }}
          >
            {description}
          </FontStyle>
        ) : null}
      </Box>
      {action ? (
        <Box
          sx={{
            flexShrink: 0,
            alignSelf: { xs: "stretch", sm: "center" },
            "& .ant-btn": { width: { xs: "100%", sm: "auto" } },
          }}
        >
          {action}
        </Box>
      ) : null}
    </Box>
  );
}
