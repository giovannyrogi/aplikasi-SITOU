"use client";

import { Button, Input, Select } from "antd";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Box } from "@mui/material";

export default function DataToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  onRefresh,
  filters,
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 1.5,
        p: { xs: 2, sm: 2.5 },
        bgcolor: "#fff",
        border: "1px solid #D8DEE8",
        borderRadius: 2,
      }}
    >
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Cari data..."
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        style={{ width: "min(100%, 320px)" }}
        aria-label="Cari data"
      />
      <Select
        value={status}
        onChange={onStatusChange}
        style={{ minWidth: 150 }}
        options={[
          { value: "all", label: "Semua status" },
          { value: "active", label: "Aktif" },
          { value: "inactive", label: "Nonaktif" },
        ]}
        aria-label="Filter status"
      />
      {filters}
      <Box sx={{ ml: { xs: 0, sm: "auto" } }}>
        <Button icon={<ReloadOutlined />} onClick={onRefresh} aria-label="Muat ulang data">
          Muat ulang
        </Button>
      </Box>
    </Box>
  );
}
