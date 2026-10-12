"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Skeleton } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { Box, useTheme } from "@mui/material";
import AppIcon from "@/app/components/icons/AppIcon";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import EmptyState from "@/app/components/data-display/EmptyState";
import ErrorState from "@/app/components/data-display/ErrorState";

const formatMinimum = (value) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(Number(value));

function ItemMedia({ item, organizationId, onPreview }) {
  const theme = useTheme();
  const [broken, setBroken] = useState(false);
  const photoUrl =
    item.photo_file_id && organizationId
      ? `/api/uploads/${encodeURIComponent(item.photo_file_id)}?organizationId=${encodeURIComponent(organizationId)}`
      : null;
  const hasPhoto = Boolean(photoUrl && !broken);
  return (
    <Box
      sx={{
        width: { xs: 88, sm: 112 },
        height: { xs: 88, sm: 112 },
        flexShrink: 0,
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: theme.ui.panelSubtleBg,
        border: `1px solid ${theme.ui.panelBorderSubtle}`,
        boxShadow: "0 5px 12px rgba(20, 32, 56, 0.07)",
      }}
    >
      {hasPhoto ? (
        <Box
          component="button"
          type="button"
          aria-label={`Perbesar foto barang ${item.name}`}
          onClick={() => onPreview(item)}
          sx={{
            display: "block",
            width: "100%",
            height: "100%",
            p: 0,
            border: 0,
            cursor: "zoom-in",
            bgcolor: "transparent",
            "&:focus-visible": {
              outline: `3px solid ${theme.palette.primary.main}`,
              outlineOffset: -3,
            },
          }}
        >
          <Box
            component="img"
            src={photoUrl}
            alt={`Foto ${item.name}`}
            loading="lazy"
            onError={() => setBroken(true)}
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </Box>
      ) : (
        <Box
          role="img"
          aria-label={`Foto ${item.name} belum tersedia`}
          sx={{
            height: "100%",
            display: "grid",
            alignContent: "center",
            justifyItems: "center",
            gap: 0.5,
            color: theme.ui.mutedText,
          }}
        >
          <AppIcon icon="solar:gallery-wide-bold-duotone" width={27} />
          <FontStyle fontSize={10.5} sx={{ textAlign: "center" }}>
            Tanpa foto
          </FontStyle>
        </Box>
      )}
    </Box>
  );
}

function ItemCard({ item, organizationId, actions, onPreview, onLimitsPreview }) {
  const theme = useTheme();
  const limits = item.warehouse_limits || [];
  return (
    <Box
      component="article"
      data-inventory-item-card
      data-item-id={item.id}
      sx={{
        minWidth: 0,
        p: { xs: 1.5, sm: 2 },
        border: `1px solid ${theme.ui.panelBorderSubtle}`,
        borderRadius: 2.5,
        bgcolor: theme.ui.panelBg,
        boxShadow: "0 5px 16px rgba(20, 32, 56, 0.055)",
        display: "grid",
        alignContent: "start",
        gap: 2,
        transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
        "&:hover": {
          transform: "translateY(-3px)",
          borderColor: theme.ui.panelBorder,
          boxShadow: "0 12px 24px rgba(20, 32, 56, 0.11)",
        },
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
          "&:hover": { transform: "none" },
        },
      }}
    >
      <Box sx={{ display: "flex", gap: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
        <ItemMedia item={item} organizationId={organizationId} onPreview={onPreview} />
        <Box sx={{ display: "grid", alignContent: "start", gap: 0.75, minWidth: 0, flex: 1 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 0.5,
              minWidth: 0,
            }}
          >
            <FontStyle
              component="h3"
              fontSize={{ xs: 14, sm: 15 }}
              fontWeight={700}
              sx={{ minWidth: 0, overflowWrap: "anywhere", lineHeight: 1.4 }}
            >
              {item.name}
            </FontStyle>
            {actions(item)}
          </Box>
          <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText, overflowWrap: "anywhere" }}>
            {item.code}
          </FontStyle>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "flex-start" }}>
            <CompactInfoChip status={item.is_active ? "active" : "inactive"} />
          </Box>
        </Box>
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 1.5,
          pt: 1.5,
          borderTop: `1px solid ${theme.ui.panelBorderSubtle}`,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <FontStyle fontSize={11} sx={{ color: theme.ui.mutedText, mb: 0.5 }}>
            Kategori
          </FontStyle>
          <FontStyle fontSize={12.5} fontWeight={600} sx={{ overflowWrap: "anywhere" }}>
            {item.category_name}
          </FontStyle>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <FontStyle fontSize={11} sx={{ color: theme.ui.mutedText, mb: 0.5 }}>
            Satuan dasar
          </FontStyle>
          <FontStyle fontSize={12.5} fontWeight={600} sx={{ overflowWrap: "anywhere" }}>
            {item.unit_name}
          </FontStyle>
        </Box>
      </Box>
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
    </Box>
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
