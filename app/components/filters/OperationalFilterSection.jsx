"use client";

import { Button } from "antd";
import { Icon } from "@iconify/react";
import { Box, Divider, Paper, useTheme } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";

/** Menampilkan filter operasional yang selalu terlihat dalam grid responsif. */
export default function OperationalFilterSection({
  title = "Filter data",
  description,
  items = [],
  onReset,
  wideColumns = 5,
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
      <Box
        sx={{
          px: { xs: 2, sm: 2.5, lg: 3 },
          py: 2,
          display: "flex",
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          flexDirection: { xs: "column", sm: "row" },
          gap: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Icon icon="solar:filter-bold-duotone" width={20} color={theme.palette.primary.main} />
            <FontStyle component="h2" fontSize={{ xs: 15, sm: 16 }} fontWeight={700}>
              {title}
            </FontStyle>
          </Box>
          {description ? (
            <FontStyle fontSize={11.5} sx={{ mt: 0.5, color: theme.ui.mutedText }}>
              {description}
            </FontStyle>
          ) : null}
        </Box>
        {onReset ? (
          <Button
            icon={<Icon icon="solar:restart-linear" width={18} />}
            onClick={onReset}
            style={{ minHeight: 40 }}
          >
            Atur ulang
          </Button>
        ) : null}
      </Box>
      <Divider sx={{ borderColor: theme.ui.panelBorderSubtle }} />
      <Box
        sx={{
          px: { xs: 2, sm: 2.5, lg: 3 },
          py: 2.5,
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(3, minmax(0, 1fr))",
            xl: `repeat(${wideColumns}, minmax(0, 1fr))`,
          },
          gap: { xs: 1.5, lg: 2 },
          "& .ant-picker, & .ant-select": { width: "100%", minHeight: 44 },
        }}
      >
        {items.map((item) => (
          <Box key={item.key} sx={{ minWidth: 0, gridColumn: item.gridColumn }}>
            <FontStyle fontSize={11.5} fontWeight={600} sx={{ mb: 0.75 }}>
              {item.label}
            </FontStyle>
            {item.control}
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
