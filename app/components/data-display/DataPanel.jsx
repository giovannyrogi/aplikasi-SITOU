"use client";

import { Box, Divider, Paper, useTheme } from "@mui/material";
import FontStyle from "../font-style/FontStyle";
import TableExportMenu from "./TableExportMenu";

/** Membungkus judul daftar, toolbar, dan data view dalam satu permukaan operasional. */
export default function DataPanel({
  title,
  description,
  toolbar,
  children,
  contentSx,
  exportConfig,
}) {
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
      {(title || description || exportConfig?.enabled) && (
        <Box
          sx={{
            px: { xs: 2, sm: 2.5, lg: 3 },
            pt: { xs: 2, sm: 2.5 },
            pb: 2,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 2,
            alignItems: "start",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            {title ? (
              <FontStyle component="h2" fontSize={{ xs: 15, sm: 16 }} fontWeight={700}>
                {title}
              </FontStyle>
            ) : null}
            {description ? (
              <FontStyle
                component="div"
                fontSize={11.5}
                sx={{ mt: 0.5, color: theme.ui.mutedText }}
              >
                {description}
              </FontStyle>
            ) : null}
          </Box>
          {exportConfig?.enabled ? <TableExportMenu {...exportConfig} /> : null}
        </Box>
      )}
      {toolbar ? (
        <>
          <Divider sx={{ borderColor: theme.ui.panelBorderSubtle }} />
          <Box sx={{ px: { xs: 2, sm: 2.5, lg: 3 }, py: 2 }}>{toolbar}</Box>
        </>
      ) : null}
      {title || description || toolbar || exportConfig?.enabled ? (
        <Divider sx={{ borderColor: theme.ui.panelBorderSubtle }} />
      ) : null}
      <Box sx={{ minWidth: 0, p: 0, ...contentSx }}>{children}</Box>
    </Paper>
  );
}
