"use client";

import { useEffect, useRef } from "react";
import { Button, Skeleton } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { Box, useTheme } from "@mui/material";
import AppIcon from "@/app/components/icons/AppIcon";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import EmptyState from "@/app/components/data-display/EmptyState";
import ErrorState from "@/app/components/data-display/ErrorState";
import InventoryItemCard from "./InventoryItemCard";

const formatMinimum = (value) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(Number(value));

function ItemCard({ item, organizationId, actions, onPreview, onLimitsPreview }) {
  const theme = useTheme();
  const limits = item.warehouse_limits || [];
  return (
    <InventoryItemCard
      item={item}
      organizationId={organizationId}
      onPreview={onPreview}
      action={actions(item)}
      meta={<CompactInfoChip status={item.is_active ? "active" : "inactive"} />}
      showAttributes
      interactive
      data-inventory-item-card
      data-item-id={item.id}
    >
      <Box
        sx={{
          minWidth: 0,
          bgcolor: theme.ui.panelSubtleBg,
          border: `1px solid ${theme.ui.panelBorderSubtle}`,
          borderRadius: 2,
          p: 1.5,
          alignSelf: "stretch",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
          <AppIcon icon="inventory:warehouse" width={15} color={theme.palette.primary.main} />
          <FontStyle fontSize={11.5} fontWeight={700}>
            Batas minimum per gudang
          </FontStyle>
        </Box>
        {limits.length ? (
          <Box sx={{ display: "grid", gap: 0.75 }}>
            {limits.slice(0, 2).map((limit) => (
              <Box
                key={limit.warehouse_id || limit.warehouse_name}
                sx={{ display: "flex", justifyContent: "space-between", gap: 1, minWidth: 0 }}
              >
                <FontStyle
                  fontSize={12}
                  sx={{
                    minWidth: 0,
                    overflowWrap: "anywhere",
                    color: limit.is_active ? "text.primary" : "text.secondary",
                  }}
                >
                  {limit.warehouse_name}
                  {!limit.is_active ? " (nonaktif)" : ""}
                </FontStyle>
                <FontStyle fontSize={12} fontWeight={700} sx={{ flexShrink: 0 }}>
                  {formatMinimum(limit.minimum_stock)} {item.unit_name}
                </FontStyle>
              </Box>
            ))}
            {limits.length > 2 ? (
              <Button
                type="link"
                size="small"
                onClick={() => onLimitsPreview(item)}
                style={{ justifySelf: "start", paddingInline: 0, minHeight: 40 }}
              >
                Lihat {limits.length - 2} gudang lainnya
              </Button>
            ) : null}
          </Box>
        ) : (
          <FontStyle fontSize={12} sx={{ color: theme.ui.mutedText }}>
            Belum didaftarkan di gudang yang dapat dilihat.
          </FontStyle>
        )}
      </Box>
    </InventoryItemCard>
  );
}

export default function InventoryItemGallery({
  data,
  loading,
  loadingMore,
  error,
  loadMoreError,
  onRetry,
  onRefresh,
  onLoadMore,
  pagination,
  organizationId,
  actions,
  onPreview,
  onLimitsPreview,
}) {
  const sentinel = useRef(null);
  const hasMore = data.length < pagination.total;
  useEffect(() => {
    const target = sentinel.current;
    if (!target || !hasMore || loading || loadingMore || loadMoreError || !onLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: "280px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [data.length, hasMore, loading, loadingMore, loadMoreError, onLoadMore]);
  if (error)
    return (
      <Box sx={{ p: 2 }}>
        <ErrorState message={error} onRetry={onRetry} />
      </Box>
    );
  if (loading)
    return (
      <Box
        sx={{
          p: { xs: 2, sm: 2.5 },
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
          gap: 2,
        }}
        aria-label="Memuat barang persediaan"
      >
        {[1, 2, 3, 4].map((index) => (
          <Box
            key={index}
            sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}
          >
            <Skeleton active avatar={{ size: 88, shape: "square" }} paragraph={{ rows: 3 }} />
          </Box>
        ))}
      </Box>
    );
  if (!data.length)
    return (
      <Box sx={{ p: 4 }}>
        <EmptyState
          description={
            organizationId
              ? "Tidak ada barang yang cocok dengan filter."
              : "Pilih organisasi pada filter untuk menampilkan barang."
          }
        />
      </Box>
    );
  return (
    <Box component="section" aria-label="Daftar barang persediaan" sx={{ display: "grid", gap: 2 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        <FontStyle fontSize={12.5} sx={{ color: "text.secondary" }} aria-live="polite">
          Menampilkan {data.length} dari {pagination.total} barang
        </FontStyle>
        <Button icon={<ReloadOutlined />} onClick={onRefresh} style={{ minHeight: 44 }}>
          Muat ulang
        </Button>
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(3, minmax(0, 1fr))",
          },
          gap: { xs: 1.5, sm: 2 },
        }}
      >
        {data.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            organizationId={organizationId}
            actions={actions}
            onPreview={onPreview}
            onLimitsPreview={onLimitsPreview}
          />
        ))}
      </Box>
      <Box
        ref={sentinel}
        sx={{ display: "flex", justifyContent: "center", minHeight: 44, alignItems: "center" }}
      >
        {loadMoreError ? (
          <Button onClick={onRetry} style={{ minHeight: 44 }}>
            Gagal memuat barang berikutnya. Coba lagi
          </Button>
        ) : hasMore ? (
          <Button loading={loadingMore} onClick={onLoadMore} style={{ minHeight: 44 }}>
            Muat barang berikutnya
          </Button>
        ) : (
          <FontStyle fontSize={12} sx={{ color: "text.secondary" }}>
            Semua barang sudah ditampilkan.
          </FontStyle>
        )}
      </Box>
    </Box>
  );
}
