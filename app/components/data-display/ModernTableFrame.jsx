"use client";

import { Box, useTheme } from "@mui/material";

/** Menyatukan styling tabel Ant Design agar seluruh modul memakai surface SITOU yang sama. */
export default function ModernTableFrame({ children, sx, outlined = false }) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        minWidth: 0,
        overflow: "hidden",
        border: outlined ? "1px solid " + theme.ui.panelBorder : "none",
        borderRadius: outlined ? 2 : 0,
        "& .ant-table-wrapper .ant-table": {
          overflow: "hidden",
          border: "none",
          borderRadius: 0,
          background: theme.ui.panelBg,
        },
        "& .ant-table-wrapper .ant-table-container": {
          borderRadius: 0,
        },
        "& .ant-table-wrapper .ant-table-thead > tr > th": {
          px: { xs: 2, sm: 2.5, lg: 3 },
          py: 1.6,
          bgcolor: theme.ui.tableHeaderBg,
          color: theme.ui.tableHeaderText,
          borderBottom: "1px solid " + theme.ui.panelBorder,
          fontSize: 12.5,
          fontWeight: 700,
          letterSpacing: "0.015em",
          lineHeight: 1.4,
          whiteSpace: "nowrap",
        },
        "& .ant-table-wrapper .ant-table-tbody > tr > td": {
          px: { xs: 2, sm: 2.5, lg: 3 },
          py: 1.6,
          bgcolor: theme.ui.panelBg,
          borderColor: theme.ui.panelBorderSubtle,
          fontSize: 12.5,
          lineHeight: 1.5,
          verticalAlign: "middle",
          transition: "background-color 160ms ease, box-shadow 160ms ease",
        },
        "& .ant-table-wrapper .ant-table-tbody > tr:nth-of-type(even) > td": {
          bgcolor: theme.ui.panelBg,
        },
        "& .ant-table-wrapper .ant-table-tbody > tr:hover > td": {
          bgcolor: theme.ui.tableRowHover + " !important",
        },
        "& .ant-table-wrapper .ant-table-tbody > tr:hover > td:first-of-type": {
          boxShadow: "inset 3px 0 " + theme.palette.primary.main,
        },
        "& .ant-table-wrapper .ant-table-cell-fix-left, & .ant-table-wrapper .ant-table-cell-fix-right":
          {
            bgcolor: theme.ui.panelBg,
          },
        "& .ant-table-wrapper .ant-table-thead .ant-table-cell-fix-left, & .ant-table-wrapper .ant-table-thead .ant-table-cell-fix-right":
          {
            bgcolor: theme.ui.tableHeaderBg,
          },
        "& .ant-table-wrapper .ant-table-tbody > tr:hover > .ant-table-cell-fix-left, & .ant-table-wrapper .ant-table-tbody > tr:hover > .ant-table-cell-fix-right":
          {
            bgcolor: theme.ui.tableRowHover + " !important",
          },
        "& .ant-table-wrapper .ant-pagination": {
          minHeight: 64,
          mt: 0,
          mb: 0,
          px: { xs: 2, sm: 2.5, lg: 3 },
          py: 2,
          borderTop: "1px solid " + theme.ui.panelBorderSubtle,
          alignItems: "center",
        },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
