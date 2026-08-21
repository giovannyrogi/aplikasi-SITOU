"use client";

import { Box, Divider, Paper, useTheme } from "@mui/material";
import FontStyle from "../font-style/FontStyle";

/** Membungkus judul daftar, toolbar, dan data view dalam satu permukaan operasional. */
export default function DataPanel({ title, description, toolbar, children }) {
  const theme = useTheme();

  return (
    <Paper
      component="section"
      elevation={0}
      sx={{
        minWidth: 0,
        overflow: "hidden",
        bgcolor: theme.ui.panelBg,
        border: `1px solid ${theme.ui.panelBorder}`,
        borderRadius: 2,
        boxShadow: theme.ui.panelShadow,
      }}
    >
      {(title || description) && (
        <Box sx={{ px: { xs: 2, sm: 2.5, lg: 3 }, pt: { xs: 2, sm: 2.5 }, pb: 2 }}>
          {title ? (
            <FontStyle component="h2" fontSize={{ xs: 15, sm: 16 }} fontWeight={700}>
              {title}
            </FontStyle>
          ) : null}
          {description ? (
            <FontStyle fontSize={11.5} sx={{ mt: 0.5, color: theme.ui.mutedText }}>
              {description}
            </FontStyle>
          ) : null}
        </Box>
      )}
      {toolbar ? (
        <>
          <Divider sx={{ borderColor: theme.ui.panelBorderSubtle }} />
          <Box sx={{ px: { xs: 2, sm: 2.5, lg: 3 }, py: 2 }}>{toolbar}</Box>
        </>
      ) : null}
      {title || description || toolbar ? (
        <Divider sx={{ borderColor: theme.ui.panelBorderSubtle }} />
      ) : null}
      <Box sx={{ minWidth: 0, p: { xs: 2, sm: 2.5, lg: 3 } }}>{children}</Box>
    </Paper>
  );
}
