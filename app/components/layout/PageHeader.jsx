"use client";

import { Box, Paper, useTheme } from "@mui/material";
import AppBreadcrumbs from "../navigation/AppBreadcrumbs";
import FontStyle from "../font-style/FontStyle";

/** Menyatukan konteks navigasi, judul, ringkasan, dan aksi utama setiap halaman. */
export default function PageHeader({
  title,
  description,
  action,
  breadcrumbs,
  menuList,
  leading,
  metadata,
}) {
  const theme = useTheme();

  return (
    <Paper
      component="header"
      elevation={0}
      sx={{
        position: "relative",
        width: "100%",
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden",
        p: { xs: 2, sm: 2.5, lg: 3 },
        bgcolor: theme.ui.panelBg,
        border: `1px solid ${theme.ui.panelBorder}`,
        borderRadius: "8px",
        boxShadow: theme.ui.panelShadow,
        "&::before": {
          content: '""',
          position: "absolute",
          inset: "0 auto 0 0",
          width: 4,
          bgcolor: theme.palette.primary.main,
        },
      }}
    >
      <AppBreadcrumbs items={breadcrumbs} menuList={menuList} fallbackLabel={title} />
      <Box
        sx={{
          mt: 1.5,
          display: "flex",
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
          flexDirection: { xs: "column", sm: "row" },
          gap: { xs: 2, sm: 3 },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
          {leading ? <Box sx={{ flexShrink: 0 }}>{leading}</Box> : null}
          <Box sx={{ minWidth: 0 }}>
            <FontStyle
              component="h1"
              fontSize={{ xs: 20, sm: 24 }}
              fontWeight={700}
              sx={{ overflowWrap: "anywhere" }}
            >
              {title}
            </FontStyle>
            {description ? (
              <FontStyle
                fontSize={12.5}
                sx={{
                  mt: 0.75,
                  maxWidth: 760,
                  color: theme.ui.mutedText,
                  lineHeight: 1.65,
                  overflowWrap: "anywhere",
                }}
              >
                {description}
              </FontStyle>
            ) : null}
            {metadata ? (
              <Box sx={{ mt: 1.25, display: "flex", gap: 0.75, flexWrap: "wrap" }}>{metadata}</Box>
            ) : null}
          </Box>
        </Box>
        {action ? (
          <Box
            sx={{
              flexShrink: 0,
              alignSelf: { xs: "stretch", sm: "center" },
              "& .ant-btn": { width: { xs: "100%", sm: "auto" }, minHeight: 44 },
            }}
          >
            {action}
          </Box>
        ) : null}
      </Box>
    </Paper>
  );
}
