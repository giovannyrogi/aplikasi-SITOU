"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import RecentInventoryTransactions from "./RecentInventoryTransactions";
import { Box, Skeleton, useTheme, IconButton, Tooltip } from "@mui/material";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import DataPanel from "@/app/components/data-display/DataPanel";
import EmptyState from "@/app/components/data-display/EmptyState";
import ErrorState from "@/app/components/data-display/ErrorState";
import FontStyle from "@/app/components/font-style/FontStyle";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import HorizontalCarousel from "@/app/components/data-display/HorizontalCarousel";
import StockAttentionCard from "./StockAttentionCard";
import { transactionPresentations } from "@/app/components/inventory/transactionPresentations";
import DashboardMetric from "./DashboardMetric";
import DashboardChart from "./DashboardChart";
import HorizontalBarChart from "./HorizontalBarChart";
import AppIcon from "@/app/components/icons/AppIcon";
import AreaTrendChart from "./AreaTrendChart";
import StackedBarChart from "./StackedBarChart";
import useDashboardData from "./useDashboardData";

const qty = (value) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(Number(value));
/** Warna dan ikon yang sama pada ringkasan, grafik, dan riwayat. */
function KindIcon({ kind }) {
  const theme = useTheme();
  const tone =
    {
      receipt: theme.status.success,
      issue: theme.status.warning,
      return: theme.status.info,
      stocktake: { main: theme.palette.secondary.main, background: theme.palette.action.selected },
    }[kind] || theme.status.info;
  return (
    <Box
      sx={{
        width: 44,
        height: 44,
        flexShrink: 0,
        borderRadius: 2,
        display: "grid",
        placeItems: "center",
        color: tone.main,
        bgcolor: tone.background,
      }}
    >
      <AppIcon
        icon={transactionPresentations[kind]?.icon || "navigation:inventory-transactions"}
        width={24}
      />
    </Box>
  );
}
export default function InventoryDashboard({ onForbidden }) {
  const user = useAuthenticatedUser(),
    theme = useTheme(),
    query = useSearchParams();
  const [selectedOrg, setSelectedOrg] = useState(query.get("organizationId") || "");
  const organizationId =
    user.role_code === "superadmin" ? selectedOrg : String(user.organization_id);
  const [warehouseId, setWarehouseId] = useState("");
  const [trendPeriod, setTrendPeriod] = useState("year");
  const [preview, setPreview] = useState(null);
  const params = new URLSearchParams({ organizationId, trendPeriod });
  if (warehouseId) params.set("warehouseId", warehouseId);
  const { data, error, loading, retry } = useDashboardData(
    organizationId ? `/api/dashboard/inventory?${params}` : null,
  );
  useEffect(() => {
    if (error?.status === 403) onForbidden();
  }, [error, onForbidden]);
  const navigate = (path, extra = {}) => {
    const value = new URLSearchParams({
      organizationId,
      ...(warehouseId ? { warehouseId } : {}),
      ...extra,
    });
    return `${path}?${value}`;
  };
  const errorPanel = (key) =>
    data?.errors[key] ? (
      <DataPanel
        title={
          { stock: "Kondisi stok", transactions: "Transaksi", distribution: "Penyaluran" }[key]
        }
      >
        <ErrorState
          message={`${data.errors[key].message} ID referensi: ${data.errors[key].requestId}`}
          onRetry={retry}
        />
      </DataPanel>
    ) : null;
  const stock = data?.stock,
    transactions = data?.transactions,
    distribution = data?.distribution;
  const stockChart = stock
    ? {
        categories: ["Cukup", "Di bawah minimum", "Habis"],
        series: [
          { name: "Cukup", data: [stock.sufficient, 0, 0] },
          { name: "Di bawah minimum", data: [0, stock.low, 0] },
          { name: "Habis", data: [0, 0, stock.empty] },
        ],
      }
    : null;
  const metrics = [
    ...(stock
      ? [
          {
            label: "Stok di bawah minimum",
            value: stock.low,
            tone: "warning",
            description: "Di bawah batas minimum.",
            icon: "navigation:inventory-stock",
          },
          {
            label: "Stok habis",
            value: stock.empty,
            tone: "danger",
            description: "Stok tersedia nol.",
            icon: "navigation:inventory-stock",
          },
        ]
      : []),
    ...(transactions
      ? [
          {
            label: "Transaksi bulan ini",
            value: transactions.total,
            tone: "info",
            description: "Tidak termasuk transaksi dibatalkan.",
            icon: "navigation:inventory-transactions",
          },
        ]
      : []),
    ...(distribution
      ? [
          {
            label: "Penyaluran bulan ini",
            value: distribution.total,
            tone: "info",
            description: "Transaksi penyaluran bulan ini.",
            icon: "navigation:inventory-reports",
          },
        ]
      : []),
  ];
  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
      {user.role_code === "superadmin" ? (
        <Box sx={{ width: { xs: "100%", sm: 280 }, justifySelf: "end" }}>
          <OrganizationSelect
            value={selectedOrg || undefined}
            onChange={(id) => {
              setSelectedOrg(id || "");
              setWarehouseId("");
            }}
            style={{ width: "100%", minHeight: 44 }}
          />
        </Box>
      ) : null}
      {!organizationId ? (
        <EmptyState description="Pilih organisasi untuk melihat Inventaris." />
      ) : error ? (
        <ErrorState message={error.message} onRetry={retry} />
      ) : (
        <>
          <Box sx={{ maxWidth: 360, width: "100%", minWidth: 0 }}>
            <FontStyle fontSize={12} fontWeight={600} sx={{ mb: 1 }}>
              Gudang
            </FontStyle>
            <AsyncSelect
              aria-label="Gudang Dashboard"
              value={warehouseId || undefined}
              allowClear
              loading={loading}
              options={(data?.warehouses || []).map((entry) => ({
                value: entry.id,
                label: entry.name,
              }))}
              onChange={(id) => setWarehouseId(id || "")}
              placeholder="Semua gudang berizin"
              style={{ width: "100%", minHeight: 44 }}
            />
          </Box>
          {loading ? (
            <Box sx={{ display: "grid", gap: 3 }}>
              <Skeleton variant="rounded" height={132} />
              <Skeleton variant="rounded" height={320} />
            </Box>
          ) : data ? (
            <>
              {metrics.length ? (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "minmax(0,1fr)",
                      sm: "repeat(2,minmax(0,1fr))",
                      lg: `repeat(${metrics.length},minmax(0,1fr))`,
                    },
                    gap: 3,
                  }}
                >
                  {metrics.map((metric) => (
                    <DashboardMetric refined key={metric.label} metric={metric} />
                  ))}
                </Box>
              ) : null}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "minmax(0,1fr)",
                    lg: stock && transactions ? "minmax(0,2fr) minmax(0,1fr)" : "minmax(0,1fr)",
                  },
                  gap: 3,
                }}
              >
                {stock ? (
                  <DataPanel
                    title="Stok perlu diisi kembali"
                    description="Barang di bawah batas minimum atau sudah habis."
                    contentSx={{ p: { xs: 2, sm: 3 } }}
                    action={
                      <Tooltip title="Lihat semua stok yang perlu diisi kembali">
                        <IconButton
                          component={Link}
                          href={navigate("/inventory/stock", { condition: "attention" })}
                          aria-label="Lihat semua stok yang perlu diisi kembali"
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 1,
                            color: "primary.main",
                            border: "1px solid",
                            borderColor: "divider",
                            "&:focus-visible": {
                              outline: "2px solid",
                              outlineColor: "primary.main",
                              outlineOffset: 2,
                            },
                          }}
                        >
                          <AppIcon icon="action:view-all" width={20} />
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    {!stock.attention.length ? (
                      <EmptyState description="Stok aman. Tidak ada barang di bawah minimum atau habis." />
                    ) : (
                      <HorizontalCarousel
                        items={stock.attention}
                        getKey={(row) => `${row.warehouse_id}:${row.item_id}`}
                        label="Barang yang perlu diisi kembali"
                        paused={Boolean(preview)}
                        renderItem={(row, { isClone }) => (
                          <StockAttentionCard
                            item={row}
                            organizationId={organizationId}
                            onPreview={setPreview}
                            isClone={isClone}
                          />
                        )}
                      />
                    )}
                  </DataPanel>
                ) : (
                  errorPanel("stock")
                )}
                {transactions ? (
                  <DataPanel
                    title="Transaksi bulan ini"
                    description="Jumlah transaksi per jenis."
                    contentSx={{ px: 3, py: 1 }}
                  >
                    {transactions.counts.map((entry) => (
                      <Box
                        key={entry.kind}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          minWidth: 0,
                          py: 2,
                          borderBottom: "1px solid",
                          borderColor: "divider",
                          "&:last-child": { borderBottom: 0 },
                        }}
                      >
                        <KindIcon kind={entry.kind} />
                        <FontStyle fontSize={13} sx={{ flex: 1 }}>
                          {entry.label}
                        </FontStyle>
                        <FontStyle fontSize={22} fontWeight={600}>
                          {qty(entry.value)}
                        </FontStyle>
                      </Box>
                    ))}
                  </DataPanel>
                ) : (
                  errorPanel("transactions")
                )}
              </Box>
              {transactions ? (
                <>
                  <DashboardChart
                    title="Aktivitas transaksi"
                    description="Jumlah transaksi  /  tidak termasuk pembatalan"
                    icon="navigation:inventory-transactions"
                    action={
                      <AsyncSelect
                        aria-label="Periode aktivitas"
                        value={trendPeriod}
                        onChange={setTrendPeriod}
                        style={{ width: 160, minHeight: 44 }}
                        options={[
                          { value: "year", label: "Tahun ini" },
                          { value: "month", label: "Bulan ini" },
                          { value: "week", label: "Minggu ini" },
                        ]}
                      />
                    }
                    empty={
                      !transactions.chart.series.some((entry) =>
                        entry.data.some((value) => value > 0),
                      )
                    }
                  >
                    <AreaTrendChart
                      integer
                      height={360}
                      data={transactions.chart}
                      colors={[
                        theme.status.success.main,
                        theme.status.warning.main,
                        theme.status.info.main,
                        theme.palette.secondary.main,
                      ]}
                    />
                  </DashboardChart>
                </>
              ) : (
                errorPanel("transactions")
              )}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "minmax(0,1fr)",
                    lg: stock && distribution ? "repeat(2,minmax(0,1fr))" : "minmax(0,1fr)",
                  },
                  gap: 3,
                }}
              >
                {stock ? (
                  <DashboardChart
                    title="Kondisi stok"
                    description="Jumlah barang–gudang yang sudah memiliki transaksi."
                    icon="solar:chart-2-bold-duotone"
                    empty={!stock.low && !stock.empty && !stock.sufficient}
                  >
                    <StackedBarChart
                      integer
                      horizontal
                      data={stockChart}
                      colors={[
                        theme.status.success.main,
                        theme.status.warning.main,
                        theme.status.danger.main,
                      ]}
                    />
                  </DashboardChart>
                ) : null}
                {distribution ? (
                  <DashboardChart
                    title="Tujuan penyaluran terbanyak"
                    description="Jumlah transaksi penyaluran bulan ini."
                    icon="solar:chart-2-bold-duotone"
                    empty={!distribution.total}
                  >
                    <HorizontalBarChart
                      integer
                      data={{
                        categories: distribution.destinations.map((entry) => entry.name),
                        series: [
                          {
                            name: "Transaksi",
                            data: distribution.destinations.map((entry) => entry.count),
                          },
                        ],
                      }}
                    />
                  </DashboardChart>
                ) : (
                  errorPanel("distribution")
                )}
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1fr)" },
                  gap: 3,
                }}
              >
                {transactions ? (
                  <DataPanel
                    title="Transaksi terbaru"
                    description="Riwayat transaksi gudang terbaru."
                    contentSx={{ p: { xs: 2, sm: 3 } }}
                  >
                    <RecentInventoryTransactions
                      key={organizationId}
                      transactions={transactions.recent}
                      organizationId={organizationId}
                    />
                  </DataPanel>
                ) : null}
              </Box>
              {data.unavailable.length ? (
                <FontStyle fontSize={12} sx={{ color: "text.secondary" }}>
                  Beberapa bagian tidak tersedia pada gudang ini.
                </FontStyle>
              ) : null}
            </>
          ) : null}
        </>
      )}
      <ImagePreviewModal
        open={!!preview}
        imageUrl={preview?.url}
        alt={preview?.name}
        title="Foto barang"
        onClose={() => setPreview(null)}
      />
    </Box>
  );
}
