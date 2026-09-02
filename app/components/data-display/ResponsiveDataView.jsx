"use client";

import { Box, useMediaQuery, useTheme } from "@mui/material";
import { Pagination, Skeleton, Table } from "antd";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import ModernTableFrame from "./ModernTableFrame";

/** Menampilkan dataset yang sama sebagai tabel modern pada layar besar dan kartu pada mobile. */
export default function ResponsiveDataView({
  data,
  columns,
  rowKey = "id",
  loading,
  error,
  onRetry,
  pagination,
  onPageChange,
  renderCard,
  emptyDescription,
  tableSx,
  mobileCardSx,
  scrollX = 900,
}) {
  const theme = useTheme();
  const mobile = useMediaQuery("(max-width:767px)");
  const mobileShellSx = { p: { xs: 2, sm: 2.5 } };

  if (error) {
    return (
      <Box sx={{ ...mobileShellSx, py: 2 }}>
        <ErrorState message={error} onRetry={onRetry} />
      </Box>
    );
  }

  if (mobile) {
    if (loading) {
      return (
        <Box sx={{ ...mobileShellSx, display: "grid", gap: 1.5 }} aria-label="Memuat data">
          {[1, 2, 3].map((item) => (
            <Box
              key={item}
              sx={{
                bgcolor: theme.ui.panelSubtleBg,
                border: "1px solid " + theme.ui.panelBorderSubtle,
                borderRadius: 2.5,
                p: 2,
              }}
            >
              <Skeleton active paragraph={{ rows: 2 }} />
            </Box>
          ))}
        </Box>
      );
    }
    if (!loading && data.length === 0)
      return (
        <Box sx={mobileShellSx}>
          <Box
            sx={{
              p: 3,
              bgcolor: theme.ui.panelSubtleBg,
              borderRadius: 2,
            }}
          >
            <EmptyState description={emptyDescription} />
          </Box>
        </Box>
      );
    return (
      <Box sx={{ ...mobileShellSx, display: "grid", gap: 2 }}>
        <Box sx={{ display: "grid", gap: 1.5 }}>
          {data.map((item) => (
            <Box
              key={item[rowKey]}
              sx={{
                bgcolor: theme.ui.panelBg,
                border: "1px solid " + theme.ui.panelBorderSubtle,
                borderRadius: 2.5,
                p: 2,
                boxShadow: "none",
                transition: "border-color 160ms ease, box-shadow 160ms ease",
                "&:hover": {
                  borderColor: theme.ui.panelBorder,
                  boxShadow: theme.ui.panelShadow,
                },
                ...mobileCardSx,
              }}
            >
              {renderCard(item)}
            </Box>
          ))}
        </Box>
        <Box sx={{ display: "flex", justifyContent: "center", overflowX: "auto", pb: 0.5 }}>
          <Pagination
            simple
            current={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            onChange={onPageChange}
          />
        </Box>
      </Box>
    );
  }

  return (
    <ModernTableFrame sx={tableSx}>
      <Table
        rowKey={rowKey}
        dataSource={data}
        columns={columns}
        loading={loading}
        size="middle"
        scroll={{ x: scrollX }}
        locale={{ emptyText: <EmptyState description={emptyDescription} /> }}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
          showTotal: (total) => total + " data",
          onChange: onPageChange,
        }}
      />
    </ModernTableFrame>
  );
}
