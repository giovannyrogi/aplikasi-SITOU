"use client";

import { Box, useMediaQuery, useTheme } from "@mui/material";
import { Pagination, Skeleton, Table } from "antd";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";

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
}) {
  const theme = useTheme();
  const mobile = useMediaQuery("(max-width:767px)");
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (mobile) {
    if (loading) {
      return (
        <Box sx={{ display: "grid", gap: 1.5 }} aria-label="Memuat data">
          {[1, 2, 3].map((item) => (
            <Box
              key={item}
              sx={{
                bgcolor: theme.palette.background.paper,
                border: `1px solid ${theme.ui.border}`,
                borderRadius: 2,
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
        <Box
          sx={{
            p: 3,
            bgcolor: theme.palette.background.paper,
            border: `1px solid ${theme.ui.border}`,
            borderRadius: 2,
          }}
        >
          <EmptyState />
        </Box>
      );
    return (
      <Box sx={{ display: "grid", gap: 2 }}>
        <Box sx={{ display: "grid", gap: 1.5 }}>
          {data.map((item) => (
            <Box
              key={item[rowKey]}
              sx={{
                bgcolor: theme.palette.background.paper,
                border: `1px solid ${theme.ui.border}`,
                borderRadius: 2,
                p: 2,
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
    <Table
      rowKey={rowKey}
      dataSource={data}
      columns={columns}
      loading={loading}
      scroll={{ x: 900 }}
      locale={{ emptyText: <EmptyState /> }}
      pagination={{
        current: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50],
        showTotal: (total) => `${total} data`,
        onChange: onPageChange,
      }}
    />
  );
}
