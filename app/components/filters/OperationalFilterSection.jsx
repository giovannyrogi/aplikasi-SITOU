"use client";

import { useId } from "react";
import { Button, Input } from "antd";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import AppIcon from "@/app/components/icons/AppIcon";
import { Box, Divider, Paper, useTheme } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";

/** Menampilkan filter operasional yang selalu terlihat dalam grid responsif. */
export default function OperationalFilterSection({
  title = "Filter data",
  description,
  items = [],
  onReset,
  onRefresh,
  search,
  onSearchChange,
  searchLabel = "Cari data",
  searchPlaceholder = "Nama atau kode",
  status,
  onStatusChange,
  statusLabel = "Status",
  wideColumns = 4,
}) {
  const theme = useTheme();
  const sectionId = useId();
  const reset =
    onReset ||
    (onSearchChange || onStatusChange
      ? () => {
          onSearchChange?.("");
          onStatusChange?.("all");
        }
      : undefined);
  const fields = [
    ...(onSearchChange
      ? [
          {
            key: "search",
            label: searchLabel,
            control: (
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder={searchPlaceholder}
                aria-label={searchLabel}
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            ),
          },
        ]
      : []),
    ...(onStatusChange
      ? [
          {
            key: "status",
            label: statusLabel,
            control: (
              <AsyncSelect
                aria-label={statusLabel}
                value={status}
                onChange={onStatusChange}
                options={[
                  { value: "all", label: "Semua status" },
                  { value: "active", label: "Aktif" },
                  { value: "inactive", label: "Nonaktif" },
                ]}
              />
            ),
          },
        ]
      : []),
    ...items.filter((item) => item.control),
  ];

  return (
    <Paper
      component="section"
      aria-labelledby={`${sectionId}-title`}
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
            <AppIcon
              icon="solar:filter-bold-duotone"
              aria-hidden="true"
              width={20}
              color={theme.palette.primary.main}
            />
            <FontStyle
              id={`${sectionId}-title`}
              component="h2"
              fontSize={{ xs: 15, sm: 16 }}
              fontWeight={700}
            >
              {title}
            </FontStyle>
          </Box>
          {description ? (
            <FontStyle explanation fontSize={11.5} sx={{ mt: 0.5, color: theme.ui.mutedText }}>
              {description}
            </FontStyle>
          ) : null}
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, maxWidth: "100%", minWidth: 0 }}>
          {onRefresh ? (
            <Button
              icon={<ReloadOutlined aria-hidden="true" />}
              onClick={onRefresh}
              style={{ minHeight: 44 }}
            >
              Muat ulang
            </Button>
          ) : null}
          {reset ? (
            <Button
              icon={<AppIcon icon="solar:restart-linear" aria-hidden="true" width={18} />}
              onClick={reset}
              style={{ minHeight: 44 }}
            >
              Atur ulang
            </Button>
          ) : null}
        </Box>
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
            md: "repeat(3, minmax(0, 1fr))",
            lg: `repeat(${Math.min(4, Math.max(1, wideColumns))}, minmax(0, 1fr))`,
          },
          gap: 2,
          "& .ant-picker, & .ant-select": { width: "100%", minHeight: 44 },
          "& .ant-input-affix-wrapper": { width: "100%", minHeight: 44 },
        }}
      >
        {fields.map((item) => (
          <Box key={item.key} sx={{ minWidth: 0, gridColumn: item.gridColumn }}>
            <FontStyle fontSize={11.5} fontWeight={600} sx={{ mb: 1 }}>
              {item.label}
            </FontStyle>
            {item.control}
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
