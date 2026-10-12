"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, DatePicker, Input, Skeleton, Tooltip } from "antd";
import { Box, useTheme } from "@mui/material";
import dayjs from "dayjs";
import PageHeader from "@/app/components/layout/PageHeader";
import OperationalFilterSection from "@/app/components/filters/OperationalFilterSection";
import DataPanel from "@/app/components/data-display/DataPanel";
import DataPagination from "@/app/components/data-display/DataPagination";
import AppNotice from "@/app/components/data-display/AppNotice";
import AppModal from "@/app/components/modals/AppModal";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import AppIcon from "@/app/components/icons/AppIcon";
import Notification from "@/app/components/Notifications/Notification";
import useAppNotification from "@/app/hooks/useAppNotification";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { readApiResponse } from "@/lib/api/clientError";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import TransactionWizard from "./TransactionWizard";
import { transactionPresentations as presentations, transactionTone } from "./transactionPresentations";

const initialFilters = { kind: "all", status: "all", warehouseId: "", from: "", to: "", search: "" };
const formatQty = (value) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(Number(value));
const dateText = (value) => value ? dayjs(value).format("D MMM YYYY") : "Belum dipilih";

function KindMark({ kind, theme, compact = false }) {
  const entry = presentations[kind] || presentations.receipt;
  const tone = transactionTone(theme, entry.tone);
  const size = compact ? 28 : 40;
  return <Box aria-hidden="true" sx={{ width: size, height: size, flex: `0 0 ${size}px`, display: "grid", placeItems: "center", borderRadius: compact ? 1.25 : 2, color: tone.main, bgcolor: tone.background, border: `1px solid ${tone.border}` }}>
    <AppIcon icon={entry.icon} width={compact ? 16 : 21}/>
  </Box>;
}

function TransactionAttachments({ files, organizationId, theme, onPreview }) {
  const labels = {
    purchase_proof: "Bukti pembelian",
    request_document: "Dokumen permintaan",
    handover_photo: "Foto serah terima",
  };
  const images = files.filter((file) => file.mimeType?.startsWith("image/"));
  const documents = files.filter((file) => !file.mimeType?.startsWith("image/"));
  const urlFor = (file) => `/api/uploads/${file.id}?organizationId=${encodeURIComponent(organizationId)}`;
  return <Box sx={{ display: "grid", gap: 2.5 }}>
    <FontStyle fontSize={14} fontWeight={700}>Lampiran</FontStyle>
    {images.length ? <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" }, gap: 2.5 }}>
      {images.map((file) => { const label = labels[file.purpose] || "Gambar transaksi"; const url = urlFor(file); return <Box key={file.id} sx={{ minWidth: 0 }}>
        <FontStyle fontSize={12.5} fontWeight={700} sx={{ mb: 1 }}>{label}</FontStyle>
        <Box component="button" type="button" onClick={() => onPreview({ url, name: label })} aria-label={`Perbesar ${label.toLowerCase()}`} sx={{ display: "block", width: "100%", aspectRatio: "4 / 3", maxHeight: 260, p: 0, overflow: "hidden", cursor: "zoom-in", bgcolor: theme.ui.panelSubtleBg, border: `1px solid ${theme.ui.panelBorder}`, borderRadius: 2, "&:hover": { borderColor: theme.palette.primary.main }, "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 3 } }}>
          <Box component="img" src={url} alt={label} sx={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}/>
        </Box>
        <FontStyle fontSize={11.5} sx={{ mt: 1, color: "text.secondary", overflowWrap: "anywhere" }}>{file.name} · Klik gambar untuk memperbesar</FontStyle>
      </Box>; })}
    </Box> : null}
    {documents.length ? <Box sx={{ display: "grid", gap: 1.5 }}>
      {documents.map((file) => <Box key={file.id} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap", p: 2, border: `1px solid ${theme.ui.panelBorder}`, borderRadius: 2, bgcolor: theme.ui.panelSubtleBg }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0, flex: "1 1 200px" }}><Box aria-hidden="true" sx={{ width: 48, height: 48, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 1.5, color: theme.status.info.main, bgcolor: theme.status.info.background }}><AppIcon icon="solar:document-text-bold-duotone" width={25}/></Box><Box sx={{ minWidth: 0 }}><FontStyle fontSize={12.5} fontWeight={700}>{labels[file.purpose] || "Dokumen transaksi"}</FontStyle><FontStyle fontSize={11.5} sx={{ color: "text.secondary", overflowWrap: "anywhere" }}>{file.name} · PDF privat</FontStyle></Box></Box>
        <Button href={urlFor(file)} target="_blank" rel="noopener noreferrer" icon={<AppIcon icon="solar:eye-linear" width={17}/>} aria-label={`Buka ${file.name}`} style={{ minHeight: 44 }}>Buka PDF</Button>
      </Box>)}
    </Box> : null}
  </Box>;
}

export default function TransactionPanel({ organizationId, organizationFilter, initialDraftId }) {
  const theme = useTheme();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const [filters, setFilters] = useState(initialFilters);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(null);
  const [pageSize, setPageSize] = useState(20);
  const [cursor, setCursor] = useState({ page: 1, cursors: [null], next: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [preview, setPreview] = useState(null);
  const [cancel, setCancel] = useState(null);
  const [wizard, setWizard] = useState(() => initialDraftId && /^[0-9a-f-]{36}$/i.test(initialDraftId) ? { draftId: initialDraftId, key: initialDraftId } : null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const requestSerial = useRef(0);
  const queryBase = `organizationId=${encodeURIComponent(organizationId || "")}`;

  useEffect(() => { const timer = setTimeout(() => setSearch(filters.search.trim()), 350); return () => clearTimeout(timer); }, [filters.search]);

  const load = useCallback(async (page = 1, cursors = [null]) => {
    if (!organizationId) return;
    const serial = ++requestSerial.current;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ organizationId, kind: filters.kind, status: filters.status, search, pageSize: String(pageSize) });
      if (filters.warehouseId) params.set("warehouseId", filters.warehouseId);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (cursors[page - 1]) params.set("cursor", cursors[page - 1]);
      const body = await readApiResponse(await fetch(`/api/inventory/transactions?${params}`, { cache: "no-store" }));
      if (serial !== requestSerial.current) return;
      setRows(body.data.data || []);
      setTotal(body.data.total);
      setCursor({ page, cursors, next: body.data.nextCursor || null });
    } catch (cause) { if (serial === requestSerial.current) setError(cause.message); }
    finally { if (serial === requestSerial.current) setLoading(false); }
  }, [organizationId, filters.kind, filters.status, filters.warehouseId, filters.from, filters.to, search, pageSize]);

  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    void fetch(`/api/inventory/transactions?${queryBase}&options=1`, { cache: "no-store" }).then(readApiResponse)
      .then((body) => { if (active) setOptions(body.data); })
      .catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [organizationId, queryBase]);
  const refresh = async () => { await load(); };
  const openWizard = async () => {
    try {
      const body = await runWithLoadingBackdrop(
        () => fetch(`/api/inventory/transactions/drafts?${queryBase}`, { cache: "no-store" }).then(readApiResponse),
        { message: "Memeriksa draft transaksi..." },
      );
      const draftId = body.data?.id || null;
      setWizard({ draftId, key: draftId || crypto.randomUUID() });
    } catch (cause) { showNotification(cause.message, "error"); }
  };
  const openDetail = async (id) => {
    try {
      const body = await runWithLoadingBackdrop(
        () => fetch(`/api/inventory/transactions/${id}?${queryBase}`, { cache: "no-store" }).then(readApiResponse),
        { message: "Membuka detail transaksi..." },
      );
      setDetail(body.data);
    } catch (cause) { showNotification(cause.message, "error"); }
  };
  const doCancel = async () => {
    if (!cancel) return;
    setBusy(true);
    try {
      await runWithLoadingBackdrop(async () => {
        await readApiResponse(await fetch(`/api/inventory/transactions/${cancel.id}/cancel`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: Number(organizationId), reason, reversalId: crypto.randomUUID() }),
        }));
        await load();
      }, { message: "Mencatat pembatalan..." });
      setCancel(null); setDetail(null); setReason("");
      showNotification("Pembatalan dicatat dan stok diperbarui.");
    } catch (cause) { showNotification(cause.message, "error"); }
    finally { setBusy(false); }
  };

  const filterItems = [
    { key: "search", label: "Cari transaksi", control: <Input.Search placeholder="Barang, referensi, gudang, atau petugas" value={filters.search} onChange={(event) => setFilters((old) => ({ ...old, search: event.target.value }))}/> },
    { key: "warehouse", label: "Pilih gudang", control: <AsyncSelect value={filters.warehouseId || "all"} onChange={(value) => setFilters((old) => ({ ...old, warehouseId: value === "all" ? "" : value }))} options={[{ value: "all", label: "Semua gudang" }, ...(options?.warehouses || []).map((w) => ({ value: w.id, label: w.name }))]}/> },
    { key: "kind", label: "Jenis transaksi", control: <AsyncSelect value={filters.kind} onChange={(value) => setFilters((old) => ({ ...old, kind: value }))} options={[{ value: "all", label: "Semua jenis" }, ...Object.entries(presentations).map(([value, entry]) => ({ value, label: entry.label }))]}/> },
    { key: "status", label: "Status", control: <AsyncSelect value={filters.status} onChange={(value) => setFilters((old) => ({ ...old, status: value }))} options={[{ value: "all", label: "Semua status" }, { value: "active", label: "Tercatat" }, { value: "cancelled", label: "Dibatalkan" }]}/> },
    { key: "from", label: "Dari tanggal transaksi", control: <DatePicker value={filters.from ? dayjs(filters.from) : null} onChange={(value) => setFilters((old) => ({ ...old, from: value?.format("YYYY-MM-DD") || "" }))} format="DD MMM YYYY" placeholder="Pilih tanggal"/> },
    { key: "to", label: "Sampai tanggal transaksi", control: <DatePicker value={filters.to ? dayjs(filters.to) : null} onChange={(value) => setFilters((old) => ({ ...old, to: value?.format("YYYY-MM-DD") || "" }))} format="DD MMM YYYY" placeholder="Pilih tanggal"/> },
  ];

  return <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
    <PageHeader title="Transaksi Barang" description="Catat perubahan stok gudang dan telusuri setiap transaksi." metadata={organizationFilter} action={options?.canCreate ? <Button type="primary" icon={<AppIcon icon="solar:add-circle-bold" width={18}/>} onClick={openWizard}>Catat transaksi</Button> : null}/>
    {!organizationId ? <AppNotice title="Pilih organisasi" description="Pilih organisasi terlebih dahulu untuk melihat transaksi barang."/> : <>
      <OperationalFilterSection title="Cari transaksi" description="Cari barang atau referensi, lalu saring menurut gudang, jenis, status, dan tanggal transaksi." items={filterItems} onReset={() => setFilters(initialFilters)}/>
      <DataPanel title="Riwayat transaksi" description="Transaksi yang terakhir dicatat ditampilkan lebih dulu. Tanggal transaksi menunjukkan kapan perubahan stok terjadi." contentSx={{ p: { xs: 2, sm: 3 } }}>
        {error ? <AppNotice tone="danger" title="Transaksi belum dapat dimuat" description={error}/> : null}
        {loading ? <Box sx={{ display: "grid", gap: 1.5 }}>{[0, 1, 2].map((key) => <Skeleton key={key} active paragraph={{ rows: 2 }}/>)}</Box> : null}
        {!loading && !error && !rows.length ? <AppNotice title="Belum ada transaksi" description={filters.search ? "Tidak ada transaksi yang cocok. Ubah kata pencarian atau filter." : "Transaksi yang berhasil dicatat akan muncul di sini. Buka Catat transaksi untuk melanjutkan draft terakhir."}/> : null}
        {!loading && !error && rows.length ? <Box role="list" aria-label="Riwayat transaksi barang" sx={{ borderTop: `1px solid ${theme.ui.border}` }}>
          <Box aria-hidden="true" sx={{ display: { xs: "none", lg: "grid" }, gridTemplateColumns: "145px minmax(130px,1.1fr) minmax(90px,.8fr) minmax(150px,1.3fr) minmax(90px,.8fr) 100px 44px", gap: 1.5, px: 1.5, py: 1.25, bgcolor: theme.ui.tableHeaderBg || "action.hover", borderBottom: `1px solid ${theme.ui.border}` }}>{["Tanggal transaksi", "Transaksi", "Gudang", "Barang", "Dicatat oleh", "Status", "Aksi"].map((name) => <FontStyle key={name} fontSize={11.5} fontWeight={700} sx={{ whiteSpace:"nowrap",textAlign: name === "Aksi" ? "center" : "left" }}>{name}</FontStyle>)}</Box>
          {rows.map((row) => <Box role="listitem" key={row.id} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr) auto", lg: "145px minmax(130px,1.1fr) minmax(90px,.8fr) minmax(150px,1.3fr) minmax(90px,.8fr) 100px 44px" }, gridTemplateAreas: { xs: '"date status" "kind kind" "warehouse warehouse" "items items" "actor action"', lg: '"date kind warehouse items actor status action"' }, columnGap: { xs: 1.5, lg: 1.5 }, rowGap: { xs: .75, lg: 0 }, alignItems: "center", px: 1.5, py: { xs: 1.5, lg: .75 }, borderBottom: `1px solid ${theme.ui.border}`, minWidth: 0, "&:hover": { bgcolor: "action.hover" } }}>
            <FontStyle sx={{gridArea:"date"}} fontSize={12} fontWeight={650}>{dateText(row.occurred_on)}</FontStyle>
            <Box sx={{ gridArea:"kind", display: "flex", gap: 1, alignItems: "center", minWidth: 0 }}><KindMark kind={row.kind} theme={theme} compact/><Box sx={{ minWidth: 0 }}><FontStyle fontSize={12.5} fontWeight={700}>{presentations[row.kind]?.label}</FontStyle>{row.reference_no ? <FontStyle title={`Referensi ${row.reference_no}`} fontSize={11} sx={{ color: "text.secondary", overflow:{lg:"hidden"},textOverflow:{lg:"ellipsis"},whiteSpace:{lg:"nowrap"},overflowWrap:{xs:"anywhere",lg:"normal"} }}>Ref. {row.reference_no}</FontStyle> : null}</Box></Box>
            <Box sx={{gridArea:"status",justifySelf:{xs:"end",lg:"start"}}}><CompactInfoChip label={row.cancelled ? "Dibatalkan" : "Tercatat"} tone={row.cancelled ? "warning" : "success"}/></Box>
            <FontStyle sx={{gridArea:"warehouse",minWidth:0,overflowWrap:"anywhere"}} fontSize={12}><Box component="span" sx={{ display: { lg: "none" }, fontWeight: 700 }}>Gudang: </Box>{row.warehouse_name}</FontStyle>
            <FontStyle sx={{gridArea:"items",minWidth:0,overflowWrap:"anywhere"}} fontSize={12}><Box component="span" sx={{ display: { lg: "none" }, fontWeight: 700 }}>Barang: </Box>{row.lines.length ? `${row.lines[0].name} ${formatQty(row.lines[0].quantity)} ${row.lines[0].unit}${row.lines.length > 1 ? ` · +${row.lines.length - 1} barang` : ""}` : "Tidak ada rincian"}</FontStyle>
            <FontStyle title={row.actor_name} sx={{gridArea:"actor",color:"text.secondary",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:{xs:"normal",lg:"nowrap"},overflowWrap:{xs:"anywhere",lg:"normal"}}} fontSize={11.5}><Box component="span" sx={{ display: { lg: "none" }, fontWeight: 700 }}>Petugas: </Box>{row.actor_name}</FontStyle>
            <Box sx={{gridArea:"action",justifySelf:{xs:"end",lg:"center"}}}><Tooltip title="Lihat detail transaksi"><Button icon={<AppIcon icon="solar:eye-linear" width={18}/>} aria-label={`Lihat detail ${presentations[row.kind]?.label || "transaksi"} tanggal ${dateText(row.occurred_on)}`} onClick={() => openDetail(row.id)} style={{ width: 44, height: 44, padding: 0 }}/></Tooltip></Box>
          </Box>)}
        </Box> : null}
        {!error ? <DataPagination cursor={cursor} total={total} pageSize={pageSize} loading={loading} onPrevious={() => load(cursor.page - 1, cursor.cursors.slice(0, -1))} onNext={() => load(cursor.page + 1, [...cursor.cursors, cursor.next])} onPageSizeChange={setPageSize}/> : null}
      </DataPanel>
    </>}

    {wizard ? <TransactionWizard key={wizard.key} organizationId={organizationId} draftId={wizard.draftId} onClose={() => setWizard(null)} onSaved={() => { setWizard(null); showNotification("Transaksi tercatat dan stok diperbarui."); void refresh(); }}/> : null}
    <AppModal open={!!detail} onClose={() => setDetail(null)} title={detail ? presentations[detail.kind]?.label : "Detail transaksi"} description="Rincian barang dan perubahan stok yang dicatat." icon={presentations[detail?.kind]?.icon || presentations.receipt.icon} size="lg" footer={<Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end", width: "100%", flexWrap: "wrap" }}>{detail?.status === "posted" && !detail.cancelled && !["opening", "reversal"].includes(detail.kind) && options?.canCreate ? <Button danger onClick={() => setCancel(detail)}>Batalkan transaksi</Button> : null}<Button onClick={() => setDetail(null)}>Tutup</Button></Box>}>
      {detail ? <Box sx={{ display: "grid", gap: 3, pb: 3 }}>
        <AppNotice tone={detail.cancelled ? "warning" : detail.kind === "reversal" ? "info" : "success"} title={detail.cancelled ? "Transaksi telah dibatalkan" : detail.kind === "reversal" ? "Pembatalan telah dicatat" : "Transaksi berhasil dicatat"} description={detail.cancelled ? "Riwayat asal tetap tersimpan. Perubahan stok pembalik dicatat sebagai transaksi terpisah." : detail.kind === "reversal" ? "Pencatatan ini membalik perubahan stok dari transaksi sebelumnya tanpa menghapus riwayatnya." : "Perubahan stok telah dicatat di gudang dan dapat ditelusuri kembali."}/>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}><KindMark kind={detail.kind} theme={theme}/><Box><FontStyle fontSize={17} fontWeight={700}>{presentations[detail.kind]?.label}</FontStyle><CompactInfoChip label={detail.cancelled ? "Dibatalkan" : "Tercatat"} tone={detail.cancelled ? "warning" : "success"}/></Box></Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, borderTop: `1px solid ${theme.ui.border}`, borderBottom: `1px solid ${theme.ui.border}`, py: 2 }}>
          {[["Tanggal transaksi", dateText(detail.occurred_on)], ["Gudang", detail.warehouse_name], ["Dicatat oleh", detail.actor_name], ["Waktu pencatatan", detail.recorded_at ? dayjs(detail.recorded_at).format("D MMM YYYY, HH.mm") : "—"], ...(detail.reference_no ? [["Nomor referensi", detail.reference_no]] : [])].map(([label, value]) => <Box key={label}><FontStyle fontSize={11.5} sx={{ color: "text.secondary" }}>{label}</FontStyle><FontStyle fontSize={13.5} fontWeight={600}>{value}</FontStyle></Box>)}
        </Box>
        <Box sx={{ display: "grid", gap: 1.5 }}><FontStyle fontSize={14} fontWeight={700}>Rincian barang</FontStyle>{detail.lines.map((line) => <Box key={line.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, p: 2, border: `1px solid ${theme.ui.border}`, borderRadius: 2 }}><FontStyle fontSize={13} fontWeight={600}>{line.name}</FontStyle><Box sx={{ textAlign: "right" }}><FontStyle fontSize={13} fontWeight={700}>{formatQty(line.quantity)} {line.unit}</FontStyle><FontStyle fontSize={12} sx={{ color: Number(line.delta) < 0 ? theme.status.danger.main : theme.status.success.main }}>{Number(line.delta) > 0 ? "+" : ""}{formatQty(line.delta)} {line.unit} pada stok</FontStyle></Box></Box>)}</Box>
        {detail.notes ? <AppNotice tone={detail.kind === "reversal" ? "warning" : "info"} title={detail.kind === "reversal" ? "Alasan pembatalan" : "Catatan transaksi"} description={detail.notes}/> : null}
        {detail.files?.length ? <TransactionAttachments files={detail.files} organizationId={organizationId} theme={theme} onPreview={setPreview}/> : null}
      </Box> : null}
    </AppModal>
    <ImagePreviewModal open={!!preview} onClose={() => setPreview(null)} imageUrl={preview?.url} title={preview?.name || "Pratinjau gambar"} alt={`Pratinjau ${preview?.name || "lampiran"}`}/>
    <ConfirmDialog open={!!cancel} title="Batalkan transaksi barang?" message="Pembatalan tidak menghapus riwayat. Sistem akan membuat transaksi pembalik dan memastikan stok tidak menjadi negatif." danger confirmText="Catat pembatalan" loading={busy} onClose={() => { setCancel(null); setReason(""); }} onConfirm={doCancel}><Input.TextArea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} placeholder="Jelaskan alasan pembatalan (minimal 10 karakter)" aria-label="Alasan pembatalan" status={reason && reason.trim().length < 10 ? "error" : undefined}/></ConfirmDialog>
    <Notification {...notification} onClose={closeNotification}/>
  </Box>;
}
