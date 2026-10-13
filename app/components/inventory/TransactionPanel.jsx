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
import TransactionDetailModal from "./TransactionDetailModal";
import {KindMark} from "./TransactionPresentationParts";
import { transactionPresentations as presentations } from "./transactionPresentations";

const initialFilters = { kind: "all", status: "all", warehouseId: "", from: "", to: "", search: "" };
const formatQty = (value) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(Number(value));
const dateText = (value) => value ? dayjs(value).format("D MMM YYYY") : "Belum dipilih";

export default function TransactionPanel({ organizationId, organizationFilter, initialDraftId, initialTransactionId }) {
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
  const [cancel, setCancel] = useState(null);
  const [wizard, setWizard] = useState(() => initialDraftId && /^[0-9a-f-]{36}$/i.test(initialDraftId) ? { draftId: initialDraftId, key: initialDraftId } : null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const requestSerial = useRef(0);
  const queryBase = `organizationId=${encodeURIComponent(organizationId || "")}`;
  useEffect(()=>{
    if (!organizationId || !initialTransactionId || !/^[0-9a-f-]{36}$/i.test(initialTransactionId)) return;
    let active = true;
    void runWithLoadingBackdrop(()=>fetch(`/api/inventory/transactions/${initialTransactionId}?${queryBase}`,{cache:"no-store"}).then(readApiResponse),{message:"Membuka detail transaksi..."})
      .then((body)=>{if(active)setDetail(body.data);})
      .catch((cause)=>{if(active)showNotification(cause.message,"error");});
    return ()=>{active=false;};
  },[organizationId,initialTransactionId,queryBase,runWithLoadingBackdrop,showNotification]);

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
      showNotification("Pembatalan disimpan dan stok diperbarui.");
    } catch (cause) { showNotification(cause.message, "error"); }
    finally { setBusy(false); }
  };

  const filterItems = [
    { key: "search", label: "Cari transaksi", control: <Input.Search placeholder="Barang, referensi, gudang, atau petugas" value={filters.search} onChange={(event) => setFilters((old) => ({ ...old, search: event.target.value }))}/> },
    { key: "warehouse", label: "Pilih gudang", control: <AsyncSelect value={filters.warehouseId || "all"} onChange={(value) => setFilters((old) => ({ ...old, warehouseId: value === "all" ? "" : value }))} options={[{ value: "all", label: "Semua gudang" }, ...(options?.warehouses || []).map((w) => ({ value: w.id, label: w.name }))]}/> },
    { key: "kind", label: "Jenis transaksi", control: <AsyncSelect value={filters.kind} onChange={(value) => setFilters((old) => ({ ...old, kind: value }))} options={[{ value: "all", label: "Semua jenis" }, ...Object.entries(presentations).filter(([value])=>value!=="reversal").map(([value, entry]) => ({ value, label: entry.label }))]}/> },
    { key: "status", label: "Status", control: <AsyncSelect value={filters.status} onChange={(value) => setFilters((old) => ({ ...old, status: value }))} options={[{ value: "all", label: "Semua status" }, { value: "active", label: "Tersimpan" }, { value: "cancelled", label: "Dibatalkan" }]}/> },
    { key: "from", label: "Dari tanggal transaksi", control: <DatePicker value={filters.from ? dayjs(filters.from) : null} onChange={(value) => setFilters((old) => ({ ...old, from: value?.format("YYYY-MM-DD") || "" }))} format="DD MMM YYYY" placeholder="Pilih tanggal"/> },
    { key: "to", label: "Sampai tanggal transaksi", control: <DatePicker value={filters.to ? dayjs(filters.to) : null} onChange={(value) => setFilters((old) => ({ ...old, to: value?.format("YYYY-MM-DD") || "" }))} format="DD MMM YYYY" placeholder="Pilih tanggal"/> },
  ];

  return <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
    <PageHeader title="Transaksi Barang" description="Kelola perubahan stok gudang dan telusuri setiap transaksi." metadata={organizationFilter} action={options?.canCreate ? <Button type="primary" icon={<AppIcon icon="solar:add-circle-bold" width={18}/>} onClick={openWizard}>Tambah transaksi</Button> : null}/>
    {!organizationId ? <AppNotice title="Pilih organisasi" description="Pilih organisasi terlebih dahulu untuk melihat transaksi barang."/> : <>
      <OperationalFilterSection title="Cari transaksi" description="Cari barang atau referensi, lalu saring menurut gudang, jenis, status, dan tanggal transaksi." items={filterItems} onReset={() => setFilters(initialFilters)}/>
      <DataPanel title="Riwayat transaksi" description="Transaksi terbaru ditampilkan lebih dulu. Pembatalan tetap tercatat dalam detail transaksi asal." contentSx={{ p: { xs: 2, sm: 3 } }}>
        {error ? <AppNotice tone="danger" title="Transaksi belum dapat dimuat" description={error}/> : null}
        {loading ? <Box sx={{ display: "grid", gap: 1.5 }}>{[0, 1, 2].map((key) => <Skeleton key={key} active paragraph={{ rows: 2 }}/>)}</Box> : null}
        {!loading && !error && !rows.length ? <AppNotice title="Belum ada transaksi" description={filters.search ? "Tidak ada transaksi yang cocok. Ubah kata pencarian atau filter." : "Transaksi yang berhasil disimpan akan muncul di sini. Buka Tambah transaksi untuk melanjutkan draft terakhir."}/> : null}
        {!loading && !error && rows.length ? <Box tabIndex={0} aria-label="Riwayat transaksi; geser untuk melihat seluruh kolom" sx={{maxWidth:"100%",overflowX:"auto",scrollbarWidth:"none","&::-webkit-scrollbar":{display:"none"},"&:focus-visible":{outline:"2px solid",outlineColor:"primary.main",outlineOffset:2}}}><Box role="list" aria-label="Riwayat transaksi barang" sx={{ minWidth:{xs:0,lg:1360},borderTop: `1px solid ${theme.ui.border}` }}>
          <Box aria-hidden="true" sx={{ display: { xs: "none", lg: "grid" }, gridTemplateColumns: "145px 200px 165px minmax(250px,1fr) 135px 100px 120px 44px", gap: 1.5, px: 1.5, py: 1.25, bgcolor: theme.ui.tableHeaderBg || "action.hover", borderBottom: `1px solid ${theme.ui.border}` }}>{["Tanggal transaksi", "Transaksi", "Gudang", "Barang", "Perubahan stok", "Status", "Disimpan oleh", "Aksi"].map((name) => <FontStyle key={name} fontSize={11.5} fontWeight={700} sx={{ whiteSpace:"nowrap",textAlign: name === "Aksi" ? "center" : "left" }}>{name}</FontStyle>)}</Box>
          {rows.map((row) => {const firstLine=row.lines[0],delta=Number(firstLine?.delta||0),change=firstLine?`${delta>0?"+":""}${formatQty(delta)} ${firstLine.unit}`:"—";return <Box role="listitem" key={row.id} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr) auto", lg: "145px 200px 165px minmax(250px,1fr) 135px 100px 120px 44px" }, gridTemplateAreas: { xs: '"date status" "kind kind" "warehouse warehouse" "items items" "change change" "actor action"', lg: '"date kind warehouse items change status actor action"' }, columnGap: { xs: 1.5, lg: 1.5 }, rowGap: { xs: .75, lg: 0 }, alignItems: "center", px: 1.5, py: { xs: 1.5, lg: .75 }, borderBottom: `1px solid ${theme.ui.border}`, minWidth: 0, "&:hover": { bgcolor: "action.hover" } }}>
            <FontStyle sx={{gridArea:"date"}} fontSize={12} fontWeight={400}>{dateText(row.occurred_on)}</FontStyle>
            <Box sx={{ gridArea:"kind", display: "flex", gap: 1, alignItems: "center", minWidth: 0 }}><KindMark kind={row.kind} compact/><Box sx={{ minWidth: 0 }}><FontStyle fontSize={12.5} fontWeight={400} sx={{whiteSpace:{xs:"normal",lg:"nowrap"}}}>{presentations[row.kind]?.label}</FontStyle>{row.reference_no ? <FontStyle title={`Referensi ${row.reference_no}`} fontSize={11} sx={{ color: "text.secondary", overflow:{lg:"hidden"},textOverflow:{lg:"ellipsis"},whiteSpace:{lg:"nowrap"},overflowWrap:{xs:"anywhere",lg:"normal"} }}>Ref. {row.reference_no}</FontStyle> : null}</Box></Box>
            <Box sx={{gridArea:"status",justifySelf:{xs:"end",lg:"start"}}}><CompactInfoChip label={row.cancelled ? "Dibatalkan" : "Tersimpan"} tone={row.cancelled ? "warning" : "success"}/></Box>
            <FontStyle sx={{gridArea:"warehouse",minWidth:0,whiteSpace:{xs:"normal",lg:"nowrap"},overflow:{lg:"hidden"},textOverflow:{lg:"ellipsis"},overflowWrap:"anywhere"}} fontSize={12}><Box component="span" sx={{ display: { lg: "none" }, fontWeight: 700 }}>Gudang: </Box>{row.warehouse_name}</FontStyle>
            <FontStyle sx={{gridArea:"items",minWidth:0,whiteSpace:{xs:"normal",lg:"nowrap"},overflow:{lg:"hidden"},textOverflow:{lg:"ellipsis"},overflowWrap:"anywhere"}} fontSize={12}><Box component="span" sx={{ display: { lg: "none" }, fontWeight: 700 }}>Barang: </Box>{row.lines.length ? `${row.lines[0].name} ${formatQty(row.lines[0].quantity)} ${row.lines[0].unit}${row.lines.length > 1 ? ` · +${row.lines.length - 1} barang` : ""}` : "Tidak ada rincian"}</FontStyle>
            <Box sx={{gridArea:"change",minWidth:0}}><FontStyle fontSize={12} fontWeight={700} sx={{color:delta>0?theme.status.success.text:delta<0?theme.status.danger.text:"text.secondary",whiteSpace:"nowrap"}}><Box component="span" sx={{display:{lg:"none"},color:"text.primary"}}>Stok: </Box>{change}</FontStyle>{row.lines.length>1?<FontStyle fontSize={11} sx={{color:"text.secondary",whiteSpace:"nowrap"}}>+{row.lines.length-1} barang lain</FontStyle>:null}{row.cancelled?<FontStyle fontSize={11} sx={{color:"text.secondary",whiteSpace:"nowrap"}}>Stok sudah dikembalikan</FontStyle>:null}</Box>
            <FontStyle title={row.actor_name} sx={{gridArea:"actor",color:"text.secondary",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:{xs:"normal",lg:"nowrap"},overflowWrap:{xs:"anywhere",lg:"normal"}}} fontSize={11.5}><Box component="span" sx={{ display: { lg: "none" }, fontWeight: 700 }}>Petugas: </Box>{row.actor_name}</FontStyle>
            <Box sx={{gridArea:"action",justifySelf:{xs:"end",lg:"center"}}}><Tooltip title="Lihat detail transaksi"><Button icon={<AppIcon icon="solar:eye-linear" width={18}/>} aria-label={`Lihat detail ${presentations[row.kind]?.label || "transaksi"} tanggal ${dateText(row.occurred_on)}`} onClick={() => openDetail(row.id)} style={{ width: 44, height: 44, padding: 0 }}/></Tooltip></Box>
          </Box>;})}
        </Box></Box> : null}
        {!error ? <DataPagination cursor={cursor} total={total} pageSize={pageSize} loading={loading} onPrevious={() => load(cursor.page - 1, cursor.cursors.slice(0, -1))} onNext={() => load(cursor.page + 1, [...cursor.cursors, cursor.next])} onPageSizeChange={setPageSize}/> : null}
      </DataPanel>
    </>}

    {wizard ? <TransactionWizard key={wizard.key} organizationId={organizationId} draftId={wizard.draftId} onClose={() => setWizard(null)} onSaved={() => { setWizard(null); showNotification("Transaksi tersimpan dan stok diperbarui."); void refresh(); }}/> : null}
    {detail?<TransactionDetailModal detail={detail} organizationId={organizationId} onClose={()=>setDetail(null)} onCancel={options?.canCreate?setCancel:undefined}/>:null}
    <ConfirmDialog open={!!cancel} title="Batalkan transaksi barang?" message="Stok akan dikembalikan sesuai transaksi asal. Alasan dan riwayat pembatalan tetap tersimpan di detail transaksi." danger confirmText="Simpan pembatalan" loading={busy} onClose={() => { setCancel(null); setReason(""); }} onConfirm={doCancel}><Input.TextArea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} placeholder="Jelaskan alasan pembatalan (minimal 10 karakter)" aria-label="Alasan pembatalan" status={reason && reason.trim().length < 10 ? "error" : undefined}/></ConfirmDialog>
    <Notification {...notification} onClose={closeNotification}/>
  </Box>;
}
