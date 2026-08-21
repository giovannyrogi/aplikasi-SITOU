"use client";

import { Button, Input, Select } from "antd";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Box, useTheme } from "@mui/material";

/** Menyediakan pencarian, filter, dan refresh yang konsisten untuk daftar data. */
export default function DataToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  onRefresh,
  filters,
  embedded = false,
}) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: { xs: "stretch", sm: "center" },
        flexDirection: { xs: "column", sm: "row" },
        flexWrap: "wrap",
        gap: 1.5,
        p: embedded ? 0 : { xs: 2, sm: 2.5 },
        bgcolor: embedded ? "transparent" : theme.ui.panelBg,
        border: embedded ? "none" : `1px solid ${theme.ui.panelBorder}`,
        borderRadius: 2,
        "& .ant-input-affix-wrapper": { minHeight: 44 },
        "& .ant-select": { minHeight: 44 },
      }}
    >
      <Box sx={{ width: { xs: "100%", sm: 300, lg: 320 }, flexShrink: 0 }}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Cari data..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          style={{ width: "100%" }}
          aria-label="Cari data"
        />
      </Box>
      <Box sx={{ width: { xs: "100%", sm: 168 }, flexShrink: 0 }}>
        <Select
          value={status}
          onChange={onStatusChange}
          style={{ width: "100%" }}
          options={[
            { value: "all", label: "Semua status" },
            { value: "active", label: "Aktif" },
            { value: "inactive", label: "Nonaktif" },
          ]}
          aria-label="Filter status"
        />
      </Box>
      {filters ? (
        <Box
          sx={{
            width: { xs: "100%", sm: "auto" },
            display: "flex",
            flexWrap: "wrap",
            gap: 1.5,
            "& .ant-select": { width: { xs: "100% !important", sm: "220px !important" } },
          }}
        >
          {filters}
        </Box>
      ) : null}
      <Box sx={{ ml: { xs: 0, sm: "auto" }, alignSelf: { xs: "flex-end", sm: "center" } }}>
        <Button
          icon={<ReloadOutlined />}
          onClick={onRefresh}
          aria-label="Muat ulang data"
          style={{ minHeight: 44 }}
        >
          Muat ulang
        </Button>
      </Box>
    </Box>
  );
}
