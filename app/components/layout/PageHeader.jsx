"use client";

import { Box, Paper, useTheme } from "@mui/material";
import AppBreadcrumbs from "../navigation/AppBreadcrumbs";
import FontStyle from "../font-style/FontStyle";

/** Menyatukan konteks navigasi, judul, ringkasan, dan aksi utama setiap halaman. */
export default function PageHeader({ title, description, action, breadcrumbs, menuList }) {
  const theme = useTheme();

  return (
    <Paper
      component="header"
      elevation={0}
      sx={{
        position: "relative",
        overflow: "hidden",
        p: { xs: 2, sm: 2.5, lg: 3 },
        bgcolor: theme.ui.panelBg,
        border: `1px solid ${theme.ui.panelBorder}`,
        borderRadius: 2,
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
        <Box sx={{ minWidth: 0 }}>
          <FontStyle component="h1" fontSize={{ xs: 20, sm: 24 }} fontWeight={700}>
            {title}
          </FontStyle>
          {description ? (
            <FontStyle
              fontSize={12.5}
              sx={{ mt: 0.75, maxWidth: 760, color: theme.ui.mutedText, lineHeight: 1.65 }}
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
