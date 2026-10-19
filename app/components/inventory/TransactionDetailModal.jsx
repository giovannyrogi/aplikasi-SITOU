"use client";
import InventoryRecipientIdentity from "./InventoryRecipientIdentity";
import ActorIdentity from "@/app/components/data-display/ActorIdentity";
import { inventoryActorPhotoUrl } from "@/lib/identity/actorPresentation.mjs";
import {useState} from "react";
import {Button} from "antd";
import {Box,useTheme} from "@mui/material";
import dayjs from "dayjs";
import AppModal from "@/app/components/modals/AppModal";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import AppNotice from "@/app/components/data-display/AppNotice";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import InventoryItemPhoto from "./InventoryItemPhoto";
import InventoryQuantityChip from "./InventoryQuantityChip";
import {KindMark,TransactionAttachments} from "./TransactionPresentationParts";
import {transactionPresentations as presentations} from "./transactionPresentations";
import {transactionReferenceLabel} from "@/lib/inventory/transactionFieldPolicy.mjs";
const formatQty=(value)=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:3}).format(Number(value));
const dateText=(value)=>dayjs(value).format("D MMM YYYY");
/** Modal transaksi bersama; laporan memberi konteks periode dan tidak menyediakan aksi mutasi. */
export default function TransactionDetailModal({detail,organizationId,onClose,onCancel,periodEnd}) {
  const theme=useTheme(),[preview,setPreview]=useState(null);
  return <>
    <AppModal open={!!detail} onClose={onClose} title={detail ? presentations[detail.kind]?.label : "Detail transaksi"} description="Rincian barang dan perubahan stok yang disimpan." icon={presentations[detail?.kind]?.icon || presentations.receipt.icon} size="lg" footer={<Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end", width: "100%", flexWrap: "wrap" }}>{detail?.status === "posted" && !detail.cancelled && !["opening", "reversal"].includes(detail.kind) && onCancel ? <Button danger onClick={() => onCancel(detail)}>Batalkan transaksi</Button> : null}<Button onClick={onClose}>Tutup</Button></Box>}>
      {detail ? <Box sx={{ display: "grid", gap: 3, pb: 3 }}>{periodEnd?<AppNotice title="Tanggal akhir laporan" description={`Angka laporan dihitung sampai ${dateText(periodEnd)}. Rincian ini menampilkan dokumen asal dan status transaksi terkini.`}/>:null}
        <AppNotice tone={detail.cancelled ? "warning" : detail.kind === "reversal" ? "info" : "success"} title={detail.cancelled ? "Transaksi telah dibatalkan" : detail.kind === "reversal" ? "Pembatalan telah disimpan" : "Transaksi berhasil disimpan"} description={detail.cancelled ? "Stok sudah dikembalikan. Alasan dan waktu pembatalan dapat dilihat di bawah." : detail.kind === "reversal" ? "Stok dikembalikan sesuai transaksi asal. Riwayat transaksi tetap tersimpan." : "Perubahan stok telah disimpan di gudang dan dapat ditelusuri kembali."}/>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}><KindMark kind={detail.kind}/><Box><FontStyle fontSize={17} fontWeight={700}>{presentations[detail.kind]?.label}</FontStyle><CompactInfoChip label={detail.cancelled ? "Dibatalkan" : "Tersimpan"} tone={detail.cancelled ? "warning" : "success"}/></Box></Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" }, gap: 2, borderTop: `1px solid ${theme.ui.border}`, borderBottom: `1px solid ${theme.ui.border}`, py: 2 }}>
          {[["Tanggal transaksi", dateText(detail.occurred_on)], ["Gudang", detail.warehouse_name], ["Disimpan oleh", detail.actor_name], ["Waktu penyimpanan", detail.recorded_at ? dayjs(detail.recorded_at).format("D MMM YYYY, HH.mm") : "—"], ...(detail.kind === "issue" ? [["Lokasi tujuan",detail.destination_location_name || "Tidak tersedia"],["Divisi & Unit tujuan",detail.destination_unit_name || "Tidak tersedia"],["Pegawai penerima",detail.recipient_name || "Tidak tersedia"]] : []), ...(detail.reference_no ? [[transactionReferenceLabel(detail.kind), detail.reference_no]] : [])].map(([label, value]) => <Box key={label} sx={{minWidth:0}}><FontStyle fontSize={11.5} sx={{ color: "text.secondary" }}>{label}</FontStyle>{label==="Disimpan oleh"?<ActorIdentity position={detail.actor_position_name} name={detail.actor_name} photoUrl={inventoryActorPhotoUrl(detail.actor_photo_file_id,organizationId,detail.id)}/>:label==="Pegawai penerima"?<InventoryRecipientIdentity recipient={detail} organizationId={organizationId} transactionId={detail.id}/>:<FontStyle fontSize={13.5} fontWeight={600} sx={{overflowWrap:"anywhere"}}>{value}</FontStyle>}</Box>)}
        </Box>
        {detail.cancelled ? <Box component="section" aria-label="Informasi pembatalan" sx={{display:"grid",gap:1.5,p:2,bgcolor:theme.status.warning.background,border:`1px solid ${theme.status.warning.border}`,borderRadius:2}}>
          <FontStyle component="h3" fontSize={14} fontWeight={700}>Pembatalan</FontStyle>
          <Box sx={{display:"grid",gridTemplateColumns:{xs:"minmax(0,1fr)",sm:"repeat(2,minmax(0,1fr))"},gap:2}}>
            <Box><FontStyle fontSize={11.5} sx={{color:"text.secondary"}}>Dibatalkan oleh</FontStyle><ActorIdentity position={detail.cancelled_by_position_name} name={detail.cancelled_by_name || "Tidak tersedia"} photoUrl={inventoryActorPhotoUrl(detail.cancelled_by_photo_file_id,organizationId,detail.id,"transaction","cancelled")}/></Box>
            <Box><FontStyle fontSize={11.5} sx={{color:"text.secondary"}}>Waktu pembatalan</FontStyle><FontStyle fontSize={13} fontWeight={600}>{detail.cancelled_at ? dayjs(detail.cancelled_at).format("D MMM YYYY, HH.mm") : "Tidak tersedia"}</FontStyle></Box>
          </Box>
          <Box><FontStyle fontSize={11.5} sx={{color:"text.secondary"}}>Alasan</FontStyle><FontStyle explanation fontSize={13} sx={{overflowWrap:"anywhere"}}>{detail.cancellation_reason || "Tidak tersedia"}</FontStyle></Box>
        </Box> : null}
        {detail.notes?.trim() ? <AppNotice tone={detail.kind === "reversal" ? "warning" : "info"} title={detail.kind === "reversal" ? "Alasan pembatalan" : "Catatan transaksi"} description={detail.notes}/> : null}
        <Box sx={{ display: "grid", gap: 1.5 }}><FontStyle fontSize={14} fontWeight={700}>Rincian barang</FontStyle>{detail.lines.map((line) => <Box key={line.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap:"wrap", gap: 2, p: 2, border: `1px solid ${theme.ui.border}`, borderRadius: 2 }}><Box sx={{display:"flex",alignItems:"center",gap:1.5,minWidth:0}}><InventoryItemPhoto item={line} organizationId={organizationId} onPreview={setPreview}/><FontStyle fontSize={13} fontWeight={600} sx={{overflowWrap:"anywhere"}}>{line.name}</FontStyle></Box><Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, textAlign: "right", flexShrink: 0 }}><InventoryQuantityChip label={`${detail.kind==="issue"?"Jumlah keluar":detail.kind==="receipt"?"Jumlah masuk":detail.kind==="opening"?"Stok awal":detail.kind==="stocktake"?"Hasil hitung":"Jumlah"}: ${formatQty(line.quantity)} ${line.unit}`} tone={detail.kind==="issue"?"warning":"info"}/><FontStyle fontSize={12} sx={{ color: Number(line.delta) < 0 ? theme.status.danger.main : theme.status.success.main }}>{Number(line.delta) > 0 ? "+" : ""}{formatQty(line.delta)} {line.unit} pada stok</FontStyle></Box></Box>)}</Box>
        {detail.files?.length ? <TransactionAttachments files={detail.files} organizationId={organizationId} theme={theme} onPreview={setPreview}/> : null}
      </Box> : null}
    </AppModal>
    <ImagePreviewModal open={!!preview} onClose={()=>setPreview(null)} imageUrl={preview?.url} title={preview?.name||"Pratinjau gambar"} alt={`Pratinjau ${preview?.name||"lampiran"}`}/>
  </>;
}
