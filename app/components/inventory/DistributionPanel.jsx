"use client";
import InventoryReportCardContent from "./InventoryReportCardContent";
import ResponsiveRangePicker from "@/app/components/forms/ResponsiveRangePicker";
import {
  DISTRIBUTION_QUANTITY_LABELS,
  DISTRIBUTION_REPORT_DESCRIPTION,
} from "@/lib/inventory/distributionLabels.mjs";
import InventoryRecipientIdentity from "./InventoryRecipientIdentity";
import ActorIdentity from "@/app/components/data-display/ActorIdentity";
import { inventoryActorPhotoUrl } from "@/lib/identity/actorPresentation.mjs";
import { useEffect, useState } from "react";
import { Button, Input, Tooltip } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { Box } from "@mui/material";
import dayjs from "dayjs";
import PageHeader from "@/app/components/layout/PageHeader";
import OperationalFilterSection from "@/app/components/filters/OperationalFilterSection";
import DataPanel from "@/app/components/data-display/DataPanel";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import DataPagination from "@/app/components/data-display/DataPagination";
import AppNotice from "@/app/components/data-display/AppNotice";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import AppIcon from "@/app/components/icons/AppIcon";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import Notification from "@/app/components/Notifications/Notification";
import useAppNotification from "@/app/hooks/useAppNotification";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { readApiResponse, normalizeRequestError } from "@/lib/api/clientError";
import InventoryItemPhoto from "./InventoryItemPhoto";
import TransactionDetailModal from "./TransactionDetailModal";
const initial = {
  from: "",
  to: "",
  warehouseId: "",
  itemId: "",
  locationId: "",
  unitId: "",
  recipientId: "",
  search: "",
  status: "all",
};
const amount = (v) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(Number(v));
/** Abort/filter keys prevent older requests overwriting newer report or organization selections. */
export default function DistributionPanel({
  organizationId,
  organizationFilter,
  initialWarehouseId,
}) {
  const [filters, setFilters] = useState(() => ({
      ...initial,
      warehouseId: initialWarehouseId || "",
    })),
    [search, setSearch] = useState(""),
    [options, setOptions] = useState(null),
    [optionsError, setOptionsError] = useState(""),
    [reload, setReload] = useState(0);
  const [pageSize, setPageSize] = useState(20),
    [page, setPage] = useState({ key: "", tokens: [null], index: 0 });
  const [state, setState] = useState({ key: "", data: null, error: "" }),
    [detail, setDetail] = useState(null),
    [preview, setPreview] = useState(null);
  const { notification, showNotification, closeNotification } = useAppNotification();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  useEffect(() => {
    const timer = setTimeout(() => setSearch(filters.search.trim()), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);
  useEffect(() => {
    if (!organizationId) return;
    const controller = new AbortController();
    fetch(`/api/inventory/distribution?organizationId=${organizationId}&options=1`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(readApiResponse)
      .then((body) => {
        if (!controller.signal.aborted) {
          setOptions(body.data);
          setOptionsError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setOptionsError(normalizeRequestError(error).message);
      });
    return () => controller.abort();
  }, [organizationId, reload]);
  const resolved = {
    warehouseId: filters.warehouseId,
    itemId: filters.itemId,
    locationId: filters.locationId,
    unitId: filters.unitId,
    recipientId: filters.recipientId,
    status: filters.status,
    organizationId,
    search,
    from: filters.from || options?.from,
    to: filters.to || options?.to,
    pageSize,
  };
  const signature = JSON.stringify(resolved),
    current = page.key === signature ? page : { key: signature, tokens: [null], index: 0 },
    cursor = current.tokens[current.index];
  const requestKey = `${signature}:${cursor || ""}:${reload}`;
  const invalid = resolved.from && resolved.to && resolved.from > resolved.to;
  useEffect(() => {
    if (!organizationId || !options || invalid) return;
    const controller = new AbortController(),
      values = JSON.parse(signature);
    const query = new URLSearchParams(
      Object.entries(values).filter(([, v]) => v !== "" && v != null),
    );
    if (cursor) query.set("cursor", cursor);
    fetch(`/api/inventory/distribution?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(readApiResponse)
      .then((body) => {
        if (!controller.signal.aborted) setState({ key: requestKey, data: body.data, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ key: requestKey, data: null, error: normalizeRequestError(error).message });
      });
    return () => controller.abort();
  }, [organizationId, options, signature, cursor, requestKey, invalid]);
  const loading = !!organizationId && !invalid && !optionsError && state.key !== requestKey,
    data = state.key === requestKey ? state.data : null;
  const change = (key, value) => setFilters((old) => ({ ...old, [key]: value || "" }));
  const select = (key, choices, placeholder) => (
    <AsyncSelect
      aria-label={key === "itemId" ? "Nama barang" : placeholder}
      allowClear={key !== "status"}
      value={filters[key] || undefined}
      onChange={(v) => change(key, v)}
      options={choices}
      placeholder={placeholder}
      style={{ width: "100%", minHeight: 44 }}
    />
  );
  const openDetail = async (row) => {
    try {
      const body = await runWithLoadingBackdrop(
        () =>
          fetch(
            `/api/inventory/transactions/${row.transaction_id}?organizationId=${organizationId}`,
            { cache: "no-store" },
          ).then(readApiResponse),
        { message: "Membuka rincian penyaluran..." },
      );
      setDetail(body.data);
    } catch (error) {
      showNotification(normalizeRequestError(error).message, "error");
    }
  };
  const exportExcel = async () => {
    try {
      const values = { ...resolved };
      delete values.pageSize;
      const query = new URLSearchParams(
        Object.entries(values).filter(([, v]) => v !== "" && v != null),
      );
      query.set("export", "xlsx");
      const response = await fetch(`/api/inventory/distribution?${query}`, { cache: "no-store" });
      if (!response.ok) {
        await readApiResponse(response);
        return;
      }
      const url = URL.createObjectURL(await response.blob()),
        link = document.createElement("a");
      link.href = url;
      link.download = `sitou-distribusi-${(data?.organization.code || String(organizationId)).replace(/[^a-zA-Z0-9_-]/g, "_")}-${resolved.from}-${resolved.to}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showNotification("Laporan distribusi berhasil diunduh.");
    } catch (error) {
      showNotification(normalizeRequestError(error).message, "error");
    }
  };
  const identity = (row) => (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", minWidth: 0 }}>
      <InventoryItemPhoto
        item={{ name: row.item_name, photo_file_id: row.photo_file_id }}
        organizationId={organizationId}
        onPreview={setPreview}
      />
      <Box sx={{ minWidth: 0 }}>
        <FontStyle fontSize={14} fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
          {row.item_name}
        </FontStyle>
        <FontStyle fontSize={12} sx={{ color: "text.secondary" }}>
          {row.item_code} · {row.unit_name}
        </FontStyle>
      </Box>
    </Box>
  );
  const action = (row, mobile = false) =>
    row.canReadTransaction ? (
      <Tooltip title="Lihat detail penyaluran">
        <Button
          aria-label={`Lihat detail penyaluran ${row.item_name}`}
          icon={<AppIcon icon="solar:eye-linear" width={18} />}
          onClick={() => openDetail(row)}
          style={{ minWidth: 44, minHeight: 44, width: mobile ? "100%" : undefined }}
        >
          {mobile ? "Lihat rincian penyaluran" : null}
        </Button>
      </Tooltip>
    ) : null;
  const qty = (row, key) => `${amount(row[key])} ${row.unit_name}`;
  const columns = [
    {
      key: "date",
      title: "Tanggal penyaluran",
      dataIndex: "occurred_on",
      render: (value) => dayjs(value).format("D MMM YYYY"),
      width: 135,
    },
    {
      key: "status",
      title: "Status penyaluran",
      width: 155,
      render: (_, row) => (
        <CompactInfoChip
          label={row.cancelled_on ? "Dibatalkan" : "Berlaku"}
          tone={row.cancelled_on ? "warning" : "success"}
        />
      ),
    },
    { key: "item", title: "Nama barang", render: (_, r) => identity(r), width: 245 },
    { key: "warehouse", title: "Gudang asal", dataIndex: "warehouse_name", width: 185 },
    {
      key: "destination",
      title: "Tujuan penyaluran",
      render: (_, r) => (
        <Box>
          <FontStyle>{r.location_name || "Tidak tersedia"}</FontStyle>
          <FontStyle fontSize={12}>{r.destination_unit_name || "Tidak tersedia"}</FontStyle>
        </Box>
      ),
      width: 230,
    },
    {
      key: "recipient",
      title: "Pegawai penerima",
      width: 225,
      render: (_, row) => (
        <Box>
          <InventoryRecipientIdentity
            recipient={row}
            organizationId={organizationId}
            transactionId={row.transaction_id}
            view="distribution"
          />
          {row.reference_no ? (
            <FontStyle fontSize={12}>Nomor memo: {row.reference_no}</FontStyle>
          ) : null}
        </Box>
      ),
    },
    ...["distributed_quantity", "returned_quantity", "net_quantity"].map((key, i) => ({
      key,
      title: DISTRIBUTION_QUANTITY_LABELS[i],
      align: "right",
      render: (_, r) => qty(r, key),
      width: 160,
    })),
    {
      key: "actor",
      title: "Disimpan oleh",
      width: 200,
      render: (_, row) => (
        <ActorIdentity
          position={row.actor_position_name}
          name={row.actor_name}
          photoUrl={inventoryActorPhotoUrl(
            row.actor_photo_file_id,
            organizationId,
            row.transaction_id,
            "distribution",
          )}
        />
      ),
    },
    {
      key: "action",
      title: "Aksi",
      render: (_, r) => action(r),
      width: 80,
    },
  ];
  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
      <PageHeader
        title="Distribusi Barang"
        description="Lihat penyaluran barang dari gudang, tujuan, dan pegawai penerimanya."
      />
      {!organizationId ? (
        <AppNotice
          title="Pilih organisasi"
          description="Pilih organisasi untuk melihat distribusi barang."
        />
      ) : null}
      <OperationalFilterSection
        title="Filter distribusi"
        onReset={() => setFilters(initial)}
        items={[
          ...(organizationFilter
            ? [{ key: "org", label: "Organisasi", control: organizationFilter }]
            : []),
          {
            key: "search",
            label: "Cari data",
            control: (
              <Input
                allowClear
                maxLength={100}
                prefix={<SearchOutlined />}
                aria-label="Cari data distribusi"
                value={filters.search}
                onChange={(e) => change("search", e.target.value)}
                placeholder="Cari data distribusi"
                title="Cari nama atau kode barang, nama penerima, dan nomor memo"
              />
            ),
          },
          {
            key: "dateRange",
            label: "Periode penyaluran",
            control: (
              <ResponsiveRangePicker
                aria-label="Rentang tanggal penyaluran"
                format="DD MMM YYYY"
                allowClear
                value={
                  resolved.from && resolved.to ? [dayjs(resolved.from), dayjs(resolved.to)] : null
                }
                placeholder={["Tanggal awal", "Tanggal akhir"]}
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
            label: "Gudang asal",
            control: select("warehouseId", options?.warehouses || [], "Semua gudang"),
          },
          {
            key: "item",
            label: "Nama barang",
            control: select("itemId", options?.items || [], "Semua barang"),
          },
          {
            key: "location",
            label: "Lokasi tujuan",
            control: select("locationId", options?.locations || [], "Semua lokasi tujuan"),
          },
          {
            key: "unit",
            label: "Divisi & Unit tujuan",
            control: select("unitId", options?.units || [], "Semua Divisi & Unit tujuan"),
          },
          {
            key: "recipient",
            label: "Pegawai penerima",
            control: select("recipientId", options?.recipients || [], "Semua pegawai penerima"),
          },
          {
            key: "status",
            label: "Status penyaluran",
            control: select(
              "status",
              [
                { value: "all", label: "Semua status" },
                { value: "effective", label: "Berlaku" },
                { value: "cancelled", label: "Dibatalkan" },
              ],
              "Status penyaluran",
            ),
          },
        ]}
      />
      {optionsError ? (
        <AppNotice
          tone="danger"
          title="Pilihan filter belum dapat dimuat"
          description={optionsError}
          action={<Button onClick={() => setReload((n) => n + 1)}>Muat ulang</Button>}
        />
      ) : null}
      {invalid ? (
        <AppNotice
          tone="danger"
          title="Rentang tanggal tidak valid"
          description="Tanggal akhir harus sama dengan atau setelah tanggal awal."
        />
      ) : null}
      {organizationId && !invalid ? (
        <>
          <DataPanel
            title="Rincian penyaluran"
            description={DISTRIBUTION_REPORT_DESCRIPTION}
            exportConfig={{
              enabled: !!data,
              formats: ["excel"],
              onExcel: exportExcel,
              disabled: loading,
            }}
          >
            <ResponsiveDataView
              data={data?.data || []}
              columns={columns}
              loading={loading}
              error={optionsError || (state.key === requestKey ? state.error : "")}
              onRetry={() => setReload((n) => n + 1)}
              scrollX={2100}
              emptyDescription="Tidak ada data penyaluran yang sesuai dengan pencarian dan filter."
              renderCard={(row) => (
                <InventoryReportCardContent
                  identity={identity(row)}
                  status={
                    <CompactInfoChip
                      label={row.cancelled_on ? "Dibatalkan" : "Berlaku"}
                      tone={row.cancelled_on ? "warning" : "success"}
                    />
                  }
                  facts={[
                    {
                      label: "Tanggal penyaluran",
                      value: row.occurred_on ? dayjs(row.occurred_on).format("D MMM YYYY") : null,
                    },
                    { label: "Gudang asal", value: row.warehouse_name },
                    { label: "Lokasi tujuan", value: row.location_name, fullWidth: true },
                    {
                      label: "Divisi & Unit tujuan",
                      value: row.destination_unit_name,
                      fullWidth: true,
                    },
                    ...(row.reference_no
                      ? [{ label: "Nomor memo", value: row.reference_no, fullWidth: true }]
                      : []),
                  ]}
                  people={
                    <>
                      <Box>
                        <FontStyle fontSize={12} sx={{ mb: 1, color: "text.secondary" }}>
                          Pegawai penerima
                        </FontStyle>
                        <InventoryRecipientIdentity
                          recipient={row}
                          organizationId={organizationId}
                          transactionId={row.transaction_id}
                          view="distribution"
                        />
                      </Box>
                      <Box>
                        <FontStyle fontSize={12} sx={{ mb: 1, color: "text.secondary" }}>
                          Disimpan oleh
                        </FontStyle>
                        <ActorIdentity
                          position={row.actor_position_name}
                          name={row.actor_name || "Tidak tersedia"}
                          photoUrl={inventoryActorPhotoUrl(
                            row.actor_photo_file_id,
                            organizationId,
                            row.transaction_id,
                            "distribution",
                          )}
                        />
                      </Box>
                    </>
                  }
                  quantities={["distributed_quantity", "returned_quantity", "net_quantity"].map(
                    (key, index) => ({
                      label: DISTRIBUTION_QUANTITY_LABELS[index],
                      value: qty(row, key),
                      emphasis: key === "net_quantity",
                    }),
                  )}
                  action={action(row, true)}
                />
              )}
            />
            <Box sx={{ p: 2 }}>
              <DataPagination
                total={data?.total}
                displayedCount={data?.data?.length || 0}
                loading={loading}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                cursor={{ page: current.index + 1, next: data?.nextCursor }}
                onPrevious={() => setPage({ ...current, index: current.index - 1 })}
                onNext={() =>
                  setPage({
                    ...current,
                    index: current.index + 1,
                    tokens: [...current.tokens.slice(0, current.index + 1), data.nextCursor],
                  })
                }
              />
            </Box>
          </DataPanel>
        </>
      ) : null}
      {detail ? (
        <TransactionDetailModal
          detail={detail}
          organizationId={organizationId}
          periodEnd={resolved.to}
          onClose={() => setDetail(null)}
        />
      ) : null}
      <ImagePreviewModal
        open={!!preview}
        imageUrl={preview?.url}
        title={preview?.name || "Foto barang"}
        onClose={() => setPreview(null)}
      />
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
