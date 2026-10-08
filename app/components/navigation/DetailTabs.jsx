"use client";

import { Tabs } from "antd";
import { Box, Paper, useTheme } from "@mui/material";

/** Menyatukan navigasi dan konten detail dalam satu workspace responsif. */
export default function DetailTabs({
  items,
  activeKey,
  onChange,
  ariaLabel = "Navigasi detail",
  embedded = false,
}) {
  const theme = useTheme();
  const Root = embedded ? Box : Paper;

  return (
    <Root
      elevation={embedded ? undefined : 0}
      sx={{
        width: "100%",
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden",
        bgcolor: theme.ui.panelBg,
        border: embedded ? "none" : `1px solid ${theme.ui.panelBorder}`,
        borderRadius: "8px",
        boxShadow: embedded ? "none" : theme.ui.panelShadow,
        "& .ant-tabs": { width: "100%", minWidth: 0, maxWidth: "100%" },
        "& .ant-tabs-nav": {
          minHeight: 56,
          margin: 0,
          px: { xs: 1, sm: 2 },
          bgcolor: theme.ui.panelSubtleBg,
          borderBottom: `1px solid ${theme.ui.panelBorderSubtle}`,
        },
        "& .ant-tabs-nav::before": { border: 0 },
        "& .ant-tabs-nav-wrap": { overflowX: "auto", scrollbarWidth: "none" },
        "& .ant-tabs-nav-wrap::-webkit-scrollbar": { display: "none" },
        "& .ant-tabs-tab": {
          minHeight: 44,
          py: 1.25,
          px: { xs: 1, sm: 1.5 },
          fontWeight: 600,
        },
        "& .ant-tabs-tab + .ant-tabs-tab": { ml: { xs: 0.5, sm: 1 } },
        "& .ant-tabs-tab-btn": {
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          whiteSpace: "nowrap",
        },
        "& .ant-tabs-tab-active .ant-tabs-tab-btn": { color: theme.palette.primary.main },
        "& .ant-tabs-ink-bar": { height: 3, borderRadius: "3px 3px 0 0" },
        "& .ant-tabs-content-holder": { minWidth: 0, maxWidth: "100%" },
        "& .ant-tabs-tabpane": { minWidth: 0, maxWidth: "100%" },
        ...(embedded
          ? {
              [theme.breakpoints.down("sm")]: {
                "& .ant-tabs-nav-wrap": { overflow: "visible" },
                "& .ant-tabs-nav-list": {
                  display: "grid !important",
                  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                  width: "100% !important",
                  transform: "none !important",
                  gap: 0.5,
                  py: 1,
                },
                "& .ant-tabs-tab": { m: "0 !important", minWidth: 0, justifyContent: "center" },
                "& .ant-tabs-nav-operations,& .ant-tabs-ink-bar": { display: "none" },
                "& .ant-tabs-tab-active": { bgcolor: theme.ui.navItemActive, borderRadius: 1 },
              },
            }
          : {}),
      }}
    >
      <Tabs
        aria-label={ariaLabel}
        items={items}
        activeKey={activeKey}
        onChange={onChange}
        destroyOnHidden={false}
      />
    </Root>
  );
}
