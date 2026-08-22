"use client";

import { Box, useMediaQuery, useTheme } from "@mui/material";
import { Pagination, Skeleton, Table } from "antd";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";

/** Menampilkan dataset yang sama sebagai tabel pada layar besar dan kartu pada mobile. */
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
}) {
  const theme = useTheme();
  const mobile = useMediaQuery("(max-width:767px)");

  if (error) {
    return (
      <Box sx={{ py: 2 }}>
        <ErrorState message={error} onRetry={onRetry} />
      </Box>
    );
  }

  if (mobile) {
    if (loading) {
      return (
        <Box sx={{ display: "grid", gap: 1.5 }} aria-label="Memuat data">
          {[1, 2, 3].map((item) => (
            <Box
              key={item}
              sx={{
                bgcolor: theme.ui.panelSubtleBg,
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
            bgcolor: theme.ui.panelSubtleBg,
            borderRadius: 1.5,
          }}
        >
          <EmptyState description={emptyDescription} />
        </Box>
      );
    return (
      <Box sx={{ display: "grid", gap: 2 }}>
        <Box sx={{ display: "grid", gap: 1.5 }}>
          {data.map((item) => (
            <Box
              key={item[rowKey]}
              sx={{
                bgcolor: theme.ui.panelBg,
                border: `1px solid ${theme.ui.panelBorderSubtle}`,
                borderRadius: 2,
                p: 2,
                boxShadow: "none",
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
    <Box
      sx={{
        minWidth: 0,
        "& .ant-table-wrapper .ant-table": {
          overflow: "hidden",
          border: `1px solid ${theme.ui.panelBorder}`,
          borderRadius: 2,
        },
        "& .ant-table-wrapper .ant-table-container": { borderRadius: 2 },
        "& .ant-table-wrapper .ant-table-thead > tr > th": {
          bgcolor: theme.ui.tableHeaderBg,
          color: theme.ui.tableHeaderText,
          fontWeight: 700,
          fontSize: 12,
          borderBottom: `1px solid ${theme.ui.panelBorder}`,
          py: 2,
        },
        "& .ant-table-wrapper .ant-table-tbody > tr > td": {
          borderColor: theme.ui.panelBorderSubtle,
          verticalAlign: "middle",
          py: 2,
          transition: "background-color 160ms ease, box-shadow 160ms ease",
        },
        "& .ant-table-wrapper .ant-table-tbody > tr:nth-of-type(even) > td": {
          bgcolor: theme.ui.panelSubtleBg,
        },
        "& .ant-table-wrapper .ant-table-tbody > tr:hover > td": {
          bgcolor: `${theme.ui.tableRowHover} !important`,
        },
        "& .ant-table-wrapper .ant-table-tbody > tr:hover > td:first-of-type": {
          boxShadow: `inset 3px 0 ${theme.palette.primary.main}`,
        },
        "& .ant-table-wrapper .ant-pagination": {
          mt: 2,
          mb: 0,
          pt: 2,
          borderTop: `1px solid ${theme.ui.panelBorderSubtle}`,
          alignItems: "center",
        },
      }}
    >
      <Table
        rowKey={rowKey}
        dataSource={data}
        columns={columns}
        loading={loading}
        size="middle"
        scroll={{ x: 900 }}
        locale={{ emptyText: <EmptyState description={emptyDescription} /> }}
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
    </Box>
  );
}
