"use client";

import { Box, Divider, Paper, useTheme } from "@mui/material";
import FontStyle from "../font-style/FontStyle";
import TableExportMenu from "./TableExportMenu";
import { mobileDataTypography } from "./mobileDataTypography.mjs";

/** Membungkus judul daftar, toolbar, dan data view dalam satu permukaan operasional. */
export default function DataPanel({
  title,
  description,
  toolbar,
  action,
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
        ...mobileDataTypography,
        overflow: "hidden",
        bgcolor: theme.ui.panelBg,
        border: `1px solid ${theme.ui.panelBorder}`,
        borderRadius: 2,
        boxShadow: theme.ui.panelShadow,
      }}
    >
      {(title || description || action || exportConfig?.enabled) && (
        <Box
          sx={{
            px: { xs: 2, sm: 2.5, lg: 3 },
            pt: { xs: 2, sm: 2.5 },
            pb: 2,
            display: { xs: "flow-root", sm: "grid" },
            gridTemplateColumns: "minmax(0, 1fr) auto",
            columnGap: 2,
            rowGap: description ? 1 : 0,
            alignItems: "center",
          }}
        >
          {action || exportConfig?.enabled ? (
            <Box
              sx={{
                display: "flex",
                float: { xs: "right", sm: "none" },
                ml: { xs: 2, sm: 0 },
                gap: 1.5,
                alignItems: "center",
                alignSelf: "start",
                gridColumn: 2,
                gridRow: { xs: 1, sm: description ? "1 / span 2" : 1 },
              }}
            >
              {action}
              {exportConfig?.enabled ? <TableExportMenu {...exportConfig} /> : null}
            </Box>
          ) : null}
          <Box
            sx={{ minWidth: 0, gridColumn: 1, gridRow: 1, mb: { xs: description ? 1 : 0, sm: 0 } }}
          >
            {title ? (
              <FontStyle component="h2" fontSize={{ xs: 15, sm: 16 }} fontWeight={700}>
                {title}
              </FontStyle>
            ) : null}
          </Box>
          {description ? (
            <FontStyle
              explanation
              component="div"
              fontSize={12}
              sx={{ gridColumn: { xs: "1 / -1", sm: 1 }, gridRow: 2, color: theme.ui.mutedText }}
            >
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
      {title || description || toolbar || action || exportConfig?.enabled ? (
        <Divider sx={{ borderColor: theme.ui.panelBorderSubtle }} />
      ) : null}
      <Box sx={{ minWidth: 0, p: 0, ...contentSx }}>{children}</Box>
    </Paper>
  );
}
