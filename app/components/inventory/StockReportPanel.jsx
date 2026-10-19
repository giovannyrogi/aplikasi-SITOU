"use client";
import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import { Button, DatePicker, Input, Tooltip } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import PageHeader from "@/app/components/layout/PageHeader";
import OperationalFilterSection from "@/app/components/filters/OperationalFilterSection";
import DataPanel from "@/app/components/data-display/DataPanel";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import DataPagination from "@/app/components/data-display/DataPagination";
import TableExportMenu from "@/app/components/data-display/TableExportMenu";
import InventoryItemPhoto from "./InventoryItemPhoto";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import AppModal from "@/app/components/modals/AppModal";
import AppNotice from "@/app/components/data-display/AppNotice";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import AppIcon from "@/app/components/icons/AppIcon";
import Notification from "@/app/components/Notifications/Notification";
import useAppNotification from "@/app/hooks/useAppNotification";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { readApiResponse } from "@/lib/api/clientError";
import { STOCK_REPORT_HELP, STOCK_REPORT_QUANTITIES } from "@/lib/inventory/stockReportPolicy.mjs";
import TransactionDetailModal from "./TransactionDetailModal";
import { transactionPresentations } from "./transactionPresentations";
const amount = (v) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(Number(v));
const initial = { search: "", from: "", to: "", warehouseId: "", categoryId: "", itemId: "" };
const queryFor = (params) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null));
/** Request dibatalkan saat ditutup atau filter berubah. */
function useReport(params, reload = 0, enabled = true) {
  const signature = JSON.stringify(params);
  const [page, setPage] = useState({ signature: "", tokens: [null], index: 0 });
  const current = page.signature === signature ? page : { signature, tokens: [null], index: 0 };
  const cursor = current.tokens[current.index];
  const key = `${signature}:${cursor || ""}:${reload}`;
  const [state, setState] = useState({ key: "", data: null, error: "" });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const query = queryFor(JSON.parse(signature));
    if (cursor) query.set("cursor", cursor);
    fetch(`/api/inventory/stock-report?${query}`, { cache: "no-store", signal: controller.signal })
      .then(readApiResponse)
      .then((body) => {
        if (!controller.signal.aborted) setState({ key, data: body.data, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ key, data: null, error: error.message });
      });
    return () => controller.abort();
  }, [signature, cursor, key, enabled]);
  return {
    data: state.key === key ? state.data : null,
    error: state.key === key ? state.error : "",
    loading: enabled && state.key !== key,
    cursor: { page: current.index + 1, next: state.key === key ? state.data?.nextCursor : null },
    previous: () => setPage({ ...current, index: current.index - 1 }),
    next: () =>
      setPage({
        ...current,
        index: current.index + 1,
        tokens: [...current.tokens.slice(0, current.index + 1), state.data.nextCursor],
      }),
  };
}
function Pagination({ result, pageSize, onSize }) {
  return (
    <DataPagination
      cursor={result.cursor}
      onPrevious={result.previous}
      onNext={result.next}
      loading={result.loading}
      total={result.data?.total}
      displayedCount={result.data?.data?.length || 0}
      pageSize={pageSize}
      onPageSizeChange={onSize}
    />
  );
}
function StockReportDetail({ row, params, onClose }) {
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const [size, setSize] = useState(20),
    [retry, setRetry] = useState(0),
    [transaction, setTransaction] = useState(null),
    [busy, setBusy] = useState(false),
    [detailError, setDetailError] = useState("");
  const controller = useRef(null),
    body = useRef(null),
    savedScroll = useRef(0),
    savedFocus = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!transaction && body.current) {
      body.current.parentElement.scrollTop = savedScroll.current;
      body.current.querySelector(`[data-transaction-id="${savedFocus.current}"]`)?.focus();
    }
  }, [transaction]);
  const result = useReport(
    {
      ...params,
      pageSize: size,
      warehouseId: row.warehouse_id,
      itemId: row.item_id,
      search: "",
      categoryId: undefined,
      action: "history",
    },
    retry,
    !transaction,
  );
  const open = async (entry) => {
    if (busy) return;
    savedFocus.current = entry.transaction_id;
    savedScroll.current = body.current?.parentElement.scrollTop || 0;
    setBusy(true);
    setDetailError("");
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(
            `/api/inventory/transactions/${entry.transaction_id}?organizationId=${params.organizationId}`,
            { cache: "no-store", signal: abort.signal },
          );
          const responseBody = await readApiResponse(response);
          if (!abort.signal.aborted) setTransaction(responseBody.data);
        },
        { message: "Membuka detail transaksi..." },
      );
    } catch (error) {
      if (!abort.signal.aborted) setDetailError(error.message);
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  };
  const action = (entry) =>
    entry.transaction_id ? (
      <Tooltip title="Lihat detail transaksi">
        <Button
          aria-label="Lihat detail transaksi"
          data-transaction-id={entry.transaction_id}
          disabled={busy}
          icon={<AppIcon icon="solar:eye-linear" width={18} />}
          onClick={() => open(entry)}
          style={{ minHeight: 44, minWidth: 44 }}
        />
      </Tooltip>
    ) : null;
  const columns = [
    {
      key: "date",
      title: "Tanggal",
      render: (_, r) => dayjs(r.occurred_on).format("D MMM YYYY"),
      width: 130,
    },
    {
      key: "kind",
      title: "Transaksi",
      render: (_, r) => (
        <Box>
          <FontStyle fontWeight={600}>{transactionPresentations[r.kind]?.label}</FontStyle>
          {r.reference_no ? <FontStyle fontSize={12}>{r.reference_no}</FontStyle> : null}
        </Box>
      ),
      width: 210,
    },
    ...[
      ["in", "Masuk"],
      ["out", "Keluar"],
      ["balance", "Stok"],
    ].map(([key, title]) => ({
      key,
      title,
      align: "right",
      render: (_, r) =>
        amount(
          key === "balance"
            ? r.balance
            : key === "in"
              ? Math.max(0, Number(r.delta))
              : Math.max(0, -Number(r.delta)),
        ),
    })),
    { key: "action", title: "Aksi", align: "center", render: (_, r) => action(r), width: 80 },
  ];
  return (
    <>
      <AppModal
        open={!transaction}
        onClose={onClose}
        title={`Kartu Stok · ${row.name}`}
        description={`${row.warehouse_name} · ${row.unit_name} · ${dayjs(params.from).format("D MMM YYYY")}–${dayjs(params.to).format("D MMM YYYY")}`}
        icon="inventory:stock-card"
        size="xl"
        contentResetKey={`${result.cursor.page}:${size}`}
        pagination={<Pagination result={result} pageSize={size} onSize={setSize} />}
        footer={
          <Button onClick={onClose} style={{ minHeight: 44 }}>
            Tutup
          </Button>
        }
      >
        <Box ref={body} sx={{ display: "grid", gap: 3, minWidth: 0 }}>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            {STOCK_REPORT_QUANTITIES.map(([key, label]) => (
              <CompactInfoChip
                key={key}
                label={`${label}: ${amount((result.data?.item || row)[key])} ${row.unit_name}`}
                tone={key === "closing_balance" ? "info" : "neutral"}
              />
            ))}
          </Box>
          <FontStyle fontSize={12} sx={{ color: "text.secondary" }}>
            Pergerakan mengikuti tanggal transaksi. Status dokumen yang dibuka mengikuti kondisi
            terkini.
          </FontStyle>
          {detailError ? <AppNotice tone="danger" description={detailError} /> : null}
          <ResponsiveDataView
            data={result.data?.data || []}
            columns={
              result.data?.data?.some((entry) => entry.transaction_id)
                ? columns
                : columns.filter((column) => column.key !== "action")
            }
            rowOffset={(result.cursor.page - 1) * size}
            loading={result.loading}
            error={result.error}
            onRetry={() => setRetry((v) => v + 1)}
            scrollX={780}
            emptyDescription="Tidak ada pergerakan stok pada periode ini."
            renderCard={(entry) => (
              <Box sx={{ display: "grid", gap: 1.5 }}>
                <FontStyle fontWeight={600}>
                  {transactionPresentations[entry.kind]?.label}
                </FontStyle>
                <FontStyle fontSize={12}>{dayjs(entry.occurred_on).format("D MMM YYYY")}</FontStyle>
                <FontStyle>
                  Masuk: {amount(Math.max(0, Number(entry.delta)))} · Keluar:{" "}
                  {amount(Math.max(0, -Number(entry.delta)))}
                </FontStyle>
                <CompactInfoChip
                  label={`Stok: ${amount(entry.balance)} ${row.unit_name}`}
                  tone="info"
                />
                {action(entry)}
              </Box>
            )}
          />
        </Box>
      </AppModal>
      {transaction ? (
        <TransactionDetailModal
          detail={transaction}
          periodEnd={params.to}
          organizationId={params.organizationId}
          onClose={() => setTransaction(null)}
        />
      ) : null}
    </>
  );
}
export default function StockReportPanel({ organizationId, organizationFilter }) {
  const [filters, setFilters] = useState(initial),
    [search, setSearch] = useState(""),
    [options, setOptions] = useState(null),
    [optionsError, setOptionsError] = useState(""),
    [retry, setRetry] = useState(0),
    [size, setSize] = useState(20),
    [detail, setDetail] = useState(null),
    [exporting, setExporting] = useState(false),
    [preview, setPreview] = useState(null);
  const exportController = useRef(null);
  useEffect(() => () => exportController.current?.abort(), []);
  const { notification, showNotification, closeNotification } = useAppNotification();
  useEffect(() => {
    const timer = setTimeout(() => setSearch(filters.search.trim()), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);
  useEffect(() => {
    if (!organizationId) return;
    const abort = new AbortController();
    fetch(`/api/inventory/stock-report?organizationId=${organizationId}&options=1`, {
      signal: abort.signal,
      cache: "no-store",
    })
      .then(readApiResponse)
      .then((body) => {
        if (!abort.signal.aborted) {
          setOptions(body.data);
          setOptionsError("");
        }
      })
      .catch((error) => {
        if (!abort.signal.aborted) setOptionsError(error.message);
      });
    return () => abort.abort();
  }, [organizationId, retry]);
  const params = {
    ...filters,
    search,
    organizationId,
    from: filters.from || options?.from,
    to: filters.to || options?.to,
    pageSize: size,
  };
  const result = useReport(params, retry, !!organizationId && !!options);
  const change = (key, value) => setFilters((old) => ({ ...old, [key]: value || "" }));
  const select = (key, choices, placeholder) => (
    <AsyncSelect
      aria-label={
        key === "itemId" ? "Nama barang" : key === "categoryId" ? "Kategori barang" : "Gudang"
      }
      allowClear
      value={filters[key] || undefined}
      options={choices || []}
      placeholder={placeholder}
      onChange={(v) => change(key, v)}
      style={{ width: "100%", minHeight: 44 }}
    />
  );
  const exportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    const abort = new AbortController();
    exportController.current = abort;
    try {
      const query = queryFor({ ...params, pageSize: undefined, export: "xlsx" });
      const response = await fetch(`/api/inventory/stock-report?${query}`, {
        cache: "no-store",
        signal: abort.signal,
      });
      if (!response.ok) {
        await readApiResponse(response);
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `sitou-stok-${params.from}-${params.to}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showNotification("Rekap stok berhasil diunduh.");
    } catch (error) {
      if (!abort.signal.aborted) showNotification(error.message, "error");
    } finally {
      if (!abort.signal.aborted) setExporting(false);
    }
  };
  const identity = (row) => (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", minWidth: 0 }}>
      <InventoryItemPhoto item={row} organizationId={organizationId} onPreview={setPreview} />
      <Box sx={{ minWidth: 0 }}>
        <FontStyle fontWeight={600} sx={{ overflowWrap: "anywhere" }}>
          {row.name}
        </FontStyle>
        <FontStyle fontSize={12} sx={{ color: "text.secondary" }}>
          {row.code} · {row.unit_name}
        </FontStyle>
      </Box>
    </Box>
  );
  const action = (row) => (
    <Tooltip title="Lihat rincian stok">
      <Button
        aria-label={`Lihat rincian stok ${row.name}`}
        icon={<AppIcon icon="inventory:stock-card" width={18} />}
        onClick={() => setDetail(row)}
        style={{ minWidth: 44, minHeight: 44 }}
      />
    </Tooltip>
  );
  const columns = [
    { key: "item", title: "Nama barang", render: (_, r) => identity(r), width: 230 },
    ...(!filters.warehouseId
      ? [{ key: "warehouse", title: "Gudang", dataIndex: "warehouse_name", width: 180 }]
      : []),
    { key: "unit", title: "Satuan", dataIndex: "unit_name", width: 90 },
    ...STOCK_REPORT_QUANTITIES.map(([key, title]) => ({
      key,
      title,
      align: "right",
      width: 125,
      render: (_, r) => (
        <FontStyle fontWeight={key === "closing_balance" ? 700 : 400}>{amount(r[key])}</FontStyle>
      ),
    })),
    { key: "action", title: "Aksi", align: "center", render: (_, r) => action(r), width: 80 },
  ];
  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
      <PageHeader
        title="Rekap Stok"
        description="Lihat stok awal, barang masuk, barang keluar, dan stok akhir pada periode yang dipilih."
      />
      {!organizationId ? (
        <AppNotice
          title="Pilih organisasi"
          description="Pilih organisasi untuk melihat rekap stok."
        />
      ) : null}
      <OperationalFilterSection
        title="Filter rekap stok"
        onReset={() => {
          setFilters(initial);
          setSearch("");
        }}
        items={[
          ...(organizationFilter
            ? [{ key: "organization", label: "Organisasi", control: organizationFilter }]
            : []),
          {
            key: "search",
            label: "Cari barang",
            control: (
              <Input
                aria-label="Cari barang"
                prefix={<SearchOutlined />}
                allowClear
                maxLength={100}
                placeholder="Cari nama atau kode barang"
                value={filters.search}
                onChange={(e) => change("search", e.target.value)}
                style={{ minHeight: 44 }}
              />
            ),
          },
          {
            key: "period",
            label: "Periode laporan",
            control: (
              <DatePicker.RangePicker
                aria-label="Periode laporan"
                value={params.from && params.to ? [dayjs(params.from), dayjs(params.to)] : null}
                format="D MMM YYYY"
                onChange={(dates) =>
                  setFilters((old) => ({
                    ...old,
                    from: dates?.[0]?.format("YYYY-MM-DD") || "",
                    to: dates?.[1]?.format("YYYY-MM-DD") || "",
                  }))
                }
                style={{ width: "100%", minHeight: 44 }}
              />
            ),
          },
          {
            key: "warehouse",
            label: "Gudang",
            control: select("warehouseId", options?.warehouses, "Semua gudang berizin"),
          },
          {
            key: "category",
            label: "Kategori barang",
            control: select("categoryId", options?.categories, "Semua kategori"),
          },
          {
            key: "item",
            label: "Nama barang",
            control: select("itemId", options?.items, "Semua barang"),
          },
        ]}
      />
      {optionsError ? (
        <AppNotice
          tone="danger"
          description={optionsError}
          action={<Button onClick={() => setRetry((v) => v + 1)}>Coba lagi</Button>}
        />
      ) : null}
      {organizationId ? (
        <DataPanel
          title="Rincian stok barang"
          description={STOCK_REPORT_HELP}
          action={
            <TableExportMenu
              enabled
              onExcel={exportExcel}
              loading={exporting}
              disabled={!result.data || result.loading || !result.data.total}
              formats={["excel"]}
            />
          }
        >
          <ResponsiveDataView
            data={result.data?.data || []}
            columns={columns}
            rowOffset={(result.cursor.page - 1) * size}
            loading={result.loading || (!options && !optionsError)}
            error={result.error}
            onRetry={() => setRetry((v) => v + 1)}
            scrollX={filters.warehouseId ? 1100 : 1280}
            emptyDescription="Tidak ada riwayat stok sesuai periode dan filter yang dipilih."
            renderCard={(row) => (
              <Box sx={{ display: "grid", gap: 2, minWidth: 0 }}>
                {identity(row)}
                <FontStyle fontSize={12}>
                  {row.warehouse_name} · {row.unit_name}
                </FontStyle>
                <Box sx={{ display: "grid", gap: 1 }}>
                  {STOCK_REPORT_QUANTITIES.map(([key, label]) => (
                    <Box
                      key={key}
                      sx={{ display: "flex", gap: 2, justifyContent: "space-between" }}
                    >
                      <FontStyle fontSize={12}>{label}</FontStyle>
                      <FontStyle fontWeight={key === "closing_balance" ? 700 : 500}>
                        {amount(row[key])} {row.unit_name}
                      </FontStyle>
                    </Box>
                  ))}
                </Box>
                {action(row)}
              </Box>
            )}
          />
          <Box sx={{ p: 2 }}>
            <Pagination result={result} pageSize={size} onSize={setSize} />
          </Box>
        </DataPanel>
      ) : null}
      {detail ? (
        <StockReportDetail row={detail} params={params} onClose={() => setDetail(null)} />
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
