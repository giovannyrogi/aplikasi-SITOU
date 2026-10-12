"use client";

import { Box, useMediaQuery, useTheme } from "@mui/material";
import { Skeleton } from "antd";
import Table from "./NumberedTable";
import { rowNumberOffset } from "./rowNumbers.mjs";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import ModernTableFrame from "./ModernTableFrame";
import DataPagination from "./DataPagination";

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
  rowOffset,
}) {
  const theme = useTheme();
  const mobile = useMediaQuery("(max-width:767px)");
  const mobileShellSx = {
    p: { xs: 2, sm: 2.5 },
    minWidth: 0,
    maxWidth: "100%",
    gridTemplateColumns: "minmax(0, 1fr)",
  };
  const offset = rowNumberOffset(pagination, rowOffset);

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
        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", minWidth: 0, gap: 1.5 }}>
          {data.map((item, index) => (
            <Box
              key={item[rowKey]}
              data-responsive-card
              sx={{
                minWidth: 0,
                maxWidth: "100%",
                overflowWrap: "anywhere",
                "& .MuiBox-root": { minWidth: 0 },
                "& .MuiChip-root": { height: "auto", minHeight: 24 },
                "& .MuiChip-label": {
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
                  lineHeight: 1.4,
                  py: 0.5,
                },
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
              <Box sx={{ color: "text.secondary", fontSize: 12, mb: 1 }}>
                No {offset + index + 1}
              </Box>
              {renderCard(item)}
            </Box>
          ))}
        </Box>
        <DataPagination pagination={pagination} onPageChange={onPageChange}/>
      </Box>
    );
  }

  return (
    <ModernTableFrame sx={tableSx}>
      <Table
        rowOffset={offset}
        rowKey={rowKey}
        dataSource={data}
        columns={columns}
        loading={loading}
        size="middle"
        scroll={{ x: scrollX }}
        locale={{ emptyText: <EmptyState description={emptyDescription} /> }}
        pagination={false}
      />
      {pagination ? <Box sx={{px:{xs:2,sm:2.5,lg:3},pb:2,borderTop:"1px solid",borderColor:theme.ui.panelBorderSubtle}}><DataPagination pagination={pagination} onPageChange={onPageChange} loading={loading}/></Box> : null}
    </ModernTableFrame>
  );
}
