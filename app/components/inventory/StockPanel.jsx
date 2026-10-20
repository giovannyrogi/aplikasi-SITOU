"use client";
import InventoryMobileCardContent, { InventoryCardAction } from "./InventoryMobileCardContent";
import ActorIdentity from "@/app/components/data-display/ActorIdentity";
import { inventoryActorPhotoUrl } from "@/lib/identity/actorPresentation.mjs";
import { useEffect, useState } from "react";
import { Button, Input, InputNumber, Tooltip } from "antd";
import { Box, Divider, useTheme } from "@mui/material";
import dayjs from "dayjs";
import PageHeader from "@/app/components/layout/PageHeader";
import ResponsiveRangePicker from "@/app/components/forms/ResponsiveRangePicker";
import { KindMark } from "./TransactionPresentationParts";
import OperationalFilterSection from "@/app/components/filters/OperationalFilterSection";
import DataPanel from "@/app/components/data-display/DataPanel";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import DataPagination from "@/app/components/data-display/DataPagination";
import AppModal from "@/app/components/modals/AppModal";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import AppNotice from "@/app/components/data-display/AppNotice";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import AppIcon from "@/app/components/icons/AppIcon";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import Notification from "@/app/components/Notifications/Notification";
import useAppNotification from "@/app/hooks/useAppNotification";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { readApiResponse } from "@/lib/api/clientError";
import { stockConditions } from "@/lib/inventory/stockPolicy.mjs";
import { transactionPresentations } from "./transactionPresentations";
import InventoryItemPhoto from "./InventoryItemPhoto";
import TransactionDetailModal from "./TransactionDetailModal";
import OpeningCorrectionModal from "./OpeningCorrectionModal";

const quantity = (value) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(Number(value));
const initialFilters = {
  search: "",
  warehouseId: "",
  categoryId: "",
  condition: "recorded",
  status: "active",
};

/** Request dibatalkan saat filter berubah; cursor terikat seluruh filter dan scope backend. */
function useStockData(params, reloadKey = 0) {
  const signature = JSON.stringify(params);
  const [page, setPage] = useState({ signature, cursors: [null], index: 0 });
  const current = page.signature === signature ? page : { signature, cursors: [null], index: 0 };
  const token = current.cursors[current.index];
  const requestKey = `${signature}:${token || ""}:${reloadKey}`;
  const [state, setState] = useState({ data: null, error: "", key: null });
  useEffect(() => {
    const filters = JSON.parse(signature);
    if (!filters.organizationId) return;
    const controller = new AbortController();
    const query = new URLSearchParams(
      Object.entries(filters).filter(([, value]) => value !== "" && value != null),
    );
    if (token) query.set("cursor", token);
    fetch(`/api/inventory/stock?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(readApiResponse)
      .then((body) => {
        if (!controller.signal.aborted) setState({ data: body.data, error: "", key: requestKey });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ data: null, error: error.message, key: requestKey });
      });
    return () => controller.abort();
  }, [signature, token, reloadKey, requestKey]);
  return {
    ...state,
    loading: state.key !== requestKey,
    error: state.key === requestKey ? state.error : "",
    cursor: { page: current.index + 1, next: state.data?.nextCursor },
    previous: () => setPage({ ...current, index: current.index - 1 }),
    next: () =>
      setPage({
        ...current,
        index: current.index + 1,
        cursors: [...current.cursors.slice(0, current.index + 1), state.data.nextCursor],
      }),
  };
}

function CursorFooter({ result, pageSize, onSize }) {
  return (
    <Box sx={{ px: 2, pb: 2 }}>
      <DataPagination
        cursor={result.cursor}
        onPrevious={result.previous}
        onNext={result.next}
        loading={result.loading}
        total={result.data?.total}
        displayedCount={result.data?.rows?.length ?? result.data?.data?.length ?? 0}
        pageSize={pageSize}
        onPageSizeChange={onSize}
      />
    </Box>
  );
}

function StockHistoryModal({ row, organizationId, onClose }) {
  const [dates, setDates] = useState({ from: "", to: "" });
  const [pageSize, setPageSize] = useState(20);
  const [retry, setRetry] = useState(0);
  const invalid = dates.from && dates.to && dates.from > dates.to;
  const result = useStockData(
    {
      organizationId,
      action: "history",
      warehouseId: row.warehouse_id,
      itemId: row.item_id,
      ...dates,
      pageSize,
    },
    retry,
  );
  const columns = [
    {
      key: "date",
      title: "Tanggal",
      render: (_, entry) => dayjs(entry.occurred_on).format("D MMM YYYY"),
      width: 135,
    },
    {
      key: "kind",
      title: "Transaksi",
      render: (_, entry) => (
        <Box>
          <FontStyle fontWeight={600}>{transactionPresentations[entry.kind]?.label}</FontStyle>
          <FontStyle fontSize={12}>
            {entry.reference_no || "Tanpa nomor referensi"}
            {entry.delta !== entry.original_delta || entry.occurred_on !== entry.original_date
              ? ` · Dihitung ulang; efek asal ${quantity(entry.original_delta)} ${row.unit_name}, tanggal asal ${dayjs(entry.original_date).format("D MMM YYYY")}`
              : ""}
          </FontStyle>
        </Box>
      ),
    },
    {
      key: "in",
      title: "Masuk",
      align: "right",
      render: (_, entry) => (Number(entry.delta) > 0 ? quantity(entry.delta) : "—"),
    },
    {
      key: "out",
      title: "Keluar",
      align: "right",
      render: (_, entry) => (Number(entry.delta) < 0 ? quantity(-Number(entry.delta)) : "—"),
    },
    {
      key: "balance",
      title: "Stok",
      align: "right",
      render: (_, entry) => <FontStyle fontWeight={700}>{quantity(entry.balance)}</FontStyle>,
    },
    {
      key: "actor",
      title: "Disimpan oleh",
      width: 200,
      render: (_, entry) => (
        <ActorIdentity
          position={entry.actor_position_name}
          name={entry.actor_name}
          photoUrl={inventoryActorPhotoUrl(
            entry.actor_photo_file_id,
            organizationId,
            entry.transaction_id,
            "stock",
          )}
        />
      ),
    },
    ...(result.data?.canReadTransaction
      ? [
          {
            key: "action",
            title: "Aksi",
            align: "center",
            render: (_, entry) => <TransactionLink entry={entry} organizationId={organizationId} />,
            width: 90,
          },
        ]
      : []),
  ];
  // Reload key tersendiri hanya untuk kegagalan request; filter tidak mengubah ledger.
  const history = result.data;
  return (
    <AppModal
      open
      onClose={onClose}
      title={`Kartu Stok · ${row.name}`}
      description={`${row.warehouse_name} · ${row.unit_name}`}
      icon="solar:clipboard-list-bold-duotone"
      size="xl"
      pagination={<CursorFooter result={result} pageSize={pageSize} onSize={setPageSize} />}
      contentResetKey={`${result.cursor.page}:${pageSize}`}
      footer={
        <Button onClick={onClose} style={{ minHeight: 44 }}>
          Tutup
        </Button>
      }
    >
      <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
        <AppNotice
          title={row.has_history ? "Riwayat perubahan stok" : "Belum ada transaksi"}
          description={
            row.has_history
              ? "Riwayat menampilkan perubahan stok sesuai tanggal transaksi, termasuk pembatalannya."
              : "Belum ada transaksi stok. Gunakan Barang Masuk untuk penerimaan pertama, atau Stok awal untuk barang yang sudah ada di gudang."
          }
        />
        <Box>
          <FontStyle fontSize={12} sx={{ mb: 1 }}>
            Periode pergerakan
          </FontStyle>
          <ResponsiveRangePicker
            value={
              dates.from || dates.to
                ? [dates.from ? dayjs(dates.from) : null, dates.to ? dayjs(dates.to) : null]
                : null
            }
            onChange={(values) =>
              setDates({
                from: values?.[0]?.format("YYYY-MM-DD") || "",
                to: values?.[1]?.format("YYYY-MM-DD") || "",
              })
            }
            style={{ width: "100%", minHeight: 44 }}
          />
        </Box>
        {invalid ? (
          <AppNotice
            tone="danger"
            title="Rentang tanggal tidak valid"
            description="Tanggal akhir tidak boleh sebelum tanggal awal."
          />
        ) : (
          <>
            {history && row.has_history ? (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                <CompactInfoChip
                  label={`Stok sebelum periode: ${quantity(history.opening_balance)} ${row.unit_name}`}
                  tone="neutral"
                />
                <CompactInfoChip
                  label={`Stok akhir periode: ${quantity(history.closing_balance)} ${row.unit_name}`}
                  tone="info"
                />
              </Box>
            ) : null}
            <DataPanel
              title="Pergerakan barang"
              description="Masuk, keluar, dan stok setelah setiap transaksi."
            >
              <ResponsiveDataView
                key={retry}
                data={history?.rows || []}
                columns={columns}
                loading={result.loading}
                error={result.error}
                onRetry={() => setRetry(retry + 1)}
                scrollX={800}
                emptyDescription="Tidak ada pergerakan stok pada periode ini."
                rowOffset={(result.cursor.page - 1) * pageSize}
                renderCard={(entry) => (
                  <InventoryMobileCardContent
                    identity={
                      <Box
                        sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, minWidth: 0 }}
                      >
                        <KindMark kind={entry.kind} />
                        <FontStyle component="h3" fontSize={14} fontWeight={700}>
                          {transactionPresentations[entry.kind]?.label}
                        </FontStyle>
                      </Box>
                    }
                    facts={[
                      {
                        label: "Tanggal transaksi",
                        value: dayjs(entry.occurred_on).format("D MMM YYYY"),
                        fullWidth: true,
                      },
                      ...(entry.reference_no
                        ? [{ label: "Nomor referensi", value: entry.reference_no, fullWidth: true }]
                        : []),
                    ]}
                    quantities={[
                      {
                        label: "Masuk",
                        value: `${Number(entry.delta) > 0 ? quantity(entry.delta) : "0"} ${row.unit_name}`,
                      },
                      {
                        label: "Keluar",
                        value: `${Number(entry.delta) < 0 ? quantity(-Number(entry.delta)) : "0"} ${row.unit_name}`,
                      },
                      {
                        label: "Stok setelah transaksi",
                        value: `${quantity(entry.balance)} ${row.unit_name}`,
                        emphasis: true,
                      },
                    ]}
                    people={
                      <Box>
                        <FontStyle fontSize={12} sx={{ mb: 1, color: "text.secondary" }}>
                          Disimpan oleh
                        </FontStyle>
                        <ActorIdentity
                          position={entry.actor_position_name}
                          name={entry.actor_name}
                          photoUrl={inventoryActorPhotoUrl(
                            entry.actor_photo_file_id,
                            organizationId,
                            entry.transaction_id,
                            "stock",
                          )}
                        />
                      </Box>
                    }
                    action={
                      history?.canReadTransaction ? (
                        <TransactionLink entry={entry} organizationId={organizationId} fullWidth />
                      ) : null
                    }
                  >
                    {entry.delta !== entry.original_delta ||
                    entry.occurred_on !== entry.original_date ? (
                      <FontStyle fontSize={12} sx={{ color: "text.secondary" }}>
                        Dihitung ulang. Perubahan semula: {quantity(entry.original_delta)}{" "}
                        {row.unit_name}, tanggal {dayjs(entry.original_date).format("D MMM YYYY")}.
                      </FontStyle>
                    ) : null}
                  </InventoryMobileCardContent>
                )}
              />
            </DataPanel>
          </>
        )}
      </Box>
    </AppModal>
  );
}

/** Membuka detail berizin di atas Kartu Stok tanpa mengubah halaman atau filter. */
function TransactionLink({ entry, organizationId, fullWidth = false }) {
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const { notification, showNotification, closeNotification } = useAppNotification();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const open = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const body = await runWithLoadingBackdrop(
        () =>
          fetch(
            `/api/inventory/transactions/${entry.transaction_id}?organizationId=${organizationId}`,
            { cache: "no-store" },
          ).then(readApiResponse),
        { message: "Membuka detail transaksi..." },
      );
      setDetail(body.data);
    } catch (error) {
      showNotification(error.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {fullWidth ? (
        <InventoryCardAction
          label="Lihat detail transaksi"
          icon="solar:eye-linear"
          loading={busy}
          onClick={open}
        />
      ) : (
        <Tooltip title="Lihat detail transaksi">
          <Button
            aria-label="Lihat detail transaksi"
            loading={busy}
            onClick={open}
            icon={<AppIcon icon="solar:eye-linear" width={18} />}
            style={{ minHeight: 44, minWidth: 44 }}
          />
        </Tooltip>
      )}
      {detail ? (
        <TransactionDetailModal
          detail={detail}
          organizationId={organizationId}
          onClose={() => setDetail(null)}
        />
      ) : null}
      <Notification {...notification} onClose={closeNotification} />
    </>
  );
}

function MinimumModal({ row, organizationId, onClose, onSaved }) {
  const [value, setValue] = useState(Number(row.minimum_stock));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  useEffect(() => {
    if (value === Number(row.minimum_stock)) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [value, row.minimum_stock]);
  const close = () => (value !== Number(row.minimum_stock) ? setDiscard(true) : onClose());
  const save = async () => {
    if (busy) return;
    if (value == null) {
      setError("Isi batas minimum.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await runWithLoadingBackdrop(
        async () =>
          readApiResponse(
            await fetch(`/api/inventory/catalog/items/${row.item_id}/warehouses`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                organizationId: Number(organizationId),
                warehouseId: Number(row.warehouse_id),
                minimumStock: value,
                isActive: row.link_active,
                version: row.version,
              }),
            }),
          ),
        { message: "Menyimpan batas minimum..." },
      );
      onSaved();
    } catch (cause) {
      setError(cause.fieldErrors?.minimumStock || cause.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AppModal
        open
        onClose={close}
        disableClose={busy}
        title="Atur batas minimum"
        description={`${row.name} · ${row.warehouse_name}`}
        icon="solar:bell-bing-bold-duotone"
        footer={
          <>
            <Button onClick={close} disabled={busy}>
              Batal
            </Button>
            <Button type="primary" loading={busy} onClick={save}>
              Simpan minimum
            </Button>
          </>
        }
      >
        <Box sx={{ display: "grid", gap: 3 }}>
          <AppNotice description="Batas minimum memberi peringatan saat stok lebih rendah. Mengubah batas ini tidak mengubah stok." />
          <Box>
            <FontStyle sx={{ mb: 1 }}>Batas minimum ({row.unit_name})</FontStyle>
            <InputNumber
              aria-label="Batas minimum"
              autoFocus
              min={0}
              max={999999999999}
              precision={row.allows_fractional ? undefined : 0}
              value={value}
              onChange={setValue}
              status={error ? "error" : undefined}
              style={{ width: "100%", minHeight: 44 }}
            />
            {error ? (
              <FontStyle role="alert" fontSize={12} sx={{ color: "error.main", mt: 1 }}>
                {error}
              </FontStyle>
            ) : null}
          </Box>
        </Box>
      </AppModal>
      <ConfirmDialog
        open={discard}
        title="Buang perubahan minimum?"
        message="Perubahan batas minimum belum disimpan."
        danger
        confirmText="Buang perubahan"
        onClose={() => setDiscard(false)}
        onConfirm={onClose}
      />
    </>
  );
}

export default function StockPanel({
  organizationId,
  organizationFilter,
  initialCondition,
  initialWarehouseId,
}) {
  const theme = useTheme();
  const [filters, setFilters] = useState(() => ({
    ...initialFilters,
    condition: [
      "recorded",
      "all",
      "attention",
      "low",
      "empty",
      "sufficient",
      "unrecorded",
    ].includes(initialCondition)
      ? initialCondition
      : initialFilters.condition,
    warehouseId: initialWarehouseId || "",
  }));
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [reload, setReload] = useState(0);
  const [detail, setDetail] = useState(null);
  const [opening, setOpening] = useState(null);
  const [minimum, setMinimum] = useState(null);
  const [preview, setPreview] = useState(null);
  const { notification, showNotification, closeNotification } = useAppNotification();
  useEffect(() => {
    const timer = setTimeout(() => setSearch(filters.search.trim()), 350);
    return () => clearTimeout(timer);
  }, [filters.search]);
  const result = useStockData({ organizationId, ...filters, search, pageSize }, reload);
  const snapshot = result.data;
  const identity = (row) => (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", minWidth: 0 }}>
      <InventoryItemPhoto item={row} organizationId={organizationId} onPreview={setPreview} />
      <Box sx={{ minWidth: 0 }}>
        <FontStyle fontWeight={600} sx={{ overflowWrap: "anywhere" }}>
          {row.name}
        </FontStyle>
        <FontStyle fontSize={12} sx={{ color: "text.secondary" }}>
          {row.code}
        </FontStyle>
      </Box>
    </Box>
  );
  const condition = (row) => (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
      <CompactInfoChip {...stockConditions[row.condition]} />
      {!row.is_active ? <CompactInfoChip label="Nonaktif" tone="neutral" /> : null}
    </Box>
  );
  const actions = (row) => (
    <Box sx={{ display: "flex", gap: 1, justifyContent: "center", flexWrap: "wrap" }}>
      <Tooltip title="Kartu Stok">
        <Button
          icon={<AppIcon icon="inventory:stock-card" width={18} />}
          aria-label={`Kartu Stok ${row.name}`}
          onClick={() => setDetail(row)}
          style={{ minHeight: 44, minWidth: 44, color: theme.status.info.main }}
        />
      </Tooltip>
      {row.canManageMinimum ? (
        <Tooltip title="Atur minimum">
          <Button
            icon={<AppIcon icon="inventory:minimum" width={18} />}
            aria-label={`Atur minimum ${row.name}`}
            onClick={() => setMinimum(row)}
            style={{ minHeight: 44, minWidth: 44, color: theme.palette.secondary.main }}
          />
        </Tooltip>
      ) : null}
      {row.canCorrectOpening ? (
        <Tooltip title="Koreksi stok awal">
          <Button
            icon={<AppIcon icon="inventory:opening-correction" width={18} />}
            aria-label={`Koreksi stok awal ${row.name}`}
            onClick={() => setOpening(row)}
            style={{ minHeight: 44, minWidth: 44, color: theme.status.warning.main }}
          />
        </Tooltip>
      ) : null}
    </Box>
  );
  const columns = [
    { key: "item", title: "Barang", render: (_, row) => identity(row), width: 270 },
    { key: "warehouse", title: "Gudang", dataIndex: "warehouse_name", width: 220 },
    {
      key: "quantity",
      title: "Stok tersedia",
      align: "right",
      render: (_, row) => (
        <FontStyle fontWeight={700}>
          {quantity(row.quantity)}
          {row.has_history ? ` ${row.unit_name}` : ""}
        </FontStyle>
      ),
      width: 150,
    },
    {
      key: "minimum",
      title: "Batas minimum",
      align: "right",
      render: (_, row) => `${quantity(row.minimum_stock)} ${row.unit_name}`,
      width: 145,
    },
    { key: "condition", title: "Kondisi stok", render: (_, row) => condition(row), width: 170 },
    {
      key: "actions",
      title: "Aksi",
      align: "center",
      render: (_, row) => actions(row),
      width: 180,
    },
  ];
  const select = (key, options, placeholder) => (
    <AsyncSelect
      aria-label={placeholder}
      allowClear={!["condition", "status"].includes(key)}
      value={filters[key] || undefined}
      onChange={(value) => setFilters({ ...filters, [key]: value || "" })}
      options={options}
      placeholder={placeholder}
      style={{ width: "100%", minHeight: 44 }}
    />
  );
  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
      <PageHeader
        title="Stok Barang"
        description="Pantau persediaan dan riwayat setiap barang di gudang."
      />
      {!organizationId ? (
        <AppNotice
          title="Pilih organisasi"
          description="Pilih organisasi untuk melihat stok barang."
        />
      ) : null}
      <OperationalFilterSection
        title="Cari persediaan"
        onReset={() => setFilters(initialFilters)}
        items={[
          ...(organizationFilter
            ? [{ key: "organization", label: "Organisasi", control: organizationFilter }]
            : []),
          {
            key: "search",
            label: "Nama atau kode barang",
            control: (
              <Input
                aria-label="Cari stok barang"
                placeholder="Cari nama atau kode barang"
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                style={{ minHeight: 44 }}
              />
            ),
          },
          {
            key: "warehouse",
            label: "Gudang",
            control: select(
              "warehouseId",
              (snapshot?.warehouses || []).map((row) => ({
                value: row.id,
                label: `${row.name} · ${row.location_name}${row.is_active ? "" : " · Nonaktif"}`,
              })),
              "Semua gudang berizin",
            ),
          },
          {
            key: "category",
            label: "Kategori",
            control: select(
              "categoryId",
              (snapshot?.categories || []).map((row) => ({ value: row.id, label: row.name })),
              "Semua kategori",
            ),
          },
          {
            key: "condition",
            label: "Tampilkan stok",
            control: select(
              "condition",
              [
                { value: "recorded", label: "Sudah ada transaksi" },
                { value: "all", label: "Semua barang" },
                { value: "attention", label: "Stok menipis dan habis" },
                ...Object.entries(stockConditions).map(([value, entry]) => ({
                  value,
                  label: entry.label,
                })),
              ],
              "Tampilkan stok",
            ),
          },
          {
            key: "status",
            label: "Status barang–gudang",
            control: select(
              "status",
              [
                { value: "active", label: "Aktif" },
                { value: "inactive", label: "Nonaktif" },
                { value: "all", label: "Semua status" },
              ],
              "Status barang–gudang",
            ),
          },
        ]}
      />
      {organizationId ? (
        <DataPanel
          title="Persediaan per gudang"
          description="Gunakan filter Tampilkan stok untuk melihat barang yang belum memiliki transaksi."
        >
          <ResponsiveDataView
            data={snapshot?.data || []}
            columns={columns}
            loading={result.loading}
            error={result.error}
            onRetry={() => setReload(reload + 1)}
            scrollX={1200}
            emptyDescription="Tidak ada barang sesuai filter. Pilih Semua barang untuk melihat persediaan yang belum memiliki transaksi."
            renderCard={(row) => (
              <InventoryMobileCardContent
                identity={identity(row)}
                status={condition(row)}
                facts={[{ label: "Gudang", value: row.warehouse_name, fullWidth: true }]}
                quantityLabel="Persediaan barang"
                quantities={[
                  {
                    label: "Batas minimum",
                    value: `${quantity(row.minimum_stock)} ${row.unit_name}`,
                  },
                  {
                    label: "Stok tersedia",
                    value: row.has_history
                      ? `${quantity(row.quantity)} ${row.unit_name}`
                      : "Belum ada transaksi",
                    emphasis: true,
                  },
                ]}
                action={
                  <Box sx={{ display: "grid", gap: 1.5 }}>
                    <InventoryCardAction
                      label="Lihat kartu stok"
                      ariaLabel={`Lihat kartu stok ${row.name}`}
                      icon="inventory:stock-card"
                      onClick={() => setDetail(row)}
                    />
                    {row.canManageMinimum ? (
                      <InventoryCardAction
                        label="Atur batas minimum"
                        ariaLabel={`Atur batas minimum ${row.name}`}
                        icon="inventory:minimum"
                        onClick={() => setMinimum(row)}
                      />
                    ) : null}
                    {row.canCorrectOpening ? (
                      <InventoryCardAction
                        label="Koreksi stok awal"
                        ariaLabel={`Koreksi stok awal ${row.name}`}
                        icon="inventory:opening-correction"
                        onClick={() => setOpening(row)}
                      />
                    ) : null}
                  </Box>
                }
              />
            )}
          />
          <CursorFooter result={result} pageSize={pageSize} onSize={setPageSize} />
        </DataPanel>
      ) : null}
      {detail ? (
        <StockHistoryModal
          row={detail}
          organizationId={organizationId}
          onClose={() => setDetail(null)}
        />
      ) : null}
      {opening ? (
        <OpeningCorrectionModal
          organizationId={organizationId}
          warehouseId={opening.warehouse_id}
          itemId={opening.item_id}
          onClose={() => setOpening(null)}
          onApplied={() => {
            setOpening(null);
            setReload(reload + 1);
            showNotification("Koreksi stok awal berhasil disimpan.");
          }}
        />
      ) : null}
      {minimum ? (
        <MinimumModal
          row={minimum}
          organizationId={organizationId}
          onClose={() => setMinimum(null)}
          onSaved={() => {
            setMinimum(null);
            setReload(reload + 1);
            showNotification("Batas minimum berhasil disimpan.");
          }}
        />
      ) : null}

      <ImagePreviewModal
        open={!!preview}
        imageUrl={preview?.url}
        title={preview?.name || "Foto barang"}
        alt={`Foto ${preview?.name || "barang"}`}
        onClose={() => setPreview(null)}
      />
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
