"use client";
import {useState} from "react";
import {Box} from "@mui/material";
import {Button} from "antd";
import dayjs from "dayjs";
import AppModal from "@/app/components/modals/AppModal";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import FontStyle from "@/app/components/font-style/FontStyle";
import AppNotice from "@/app/components/data-display/AppNotice";
import InventoryItemPhoto from "./InventoryItemPhoto";
import InventoryQuantityChip from "./InventoryQuantityChip";

const amount=(value)=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:3}).format(Number(value));
export default function TransactionSourceDetailModal({source,organizationId,onClose}){
  const [preview,setPreview]=useState(null);
  return <><AppModal open onClose={onClose} title="Detail transaksi penyaluran" description={`${source.warehouse_name} · ${dayjs(source.occurred_on).format("D MMM YYYY")}`} icon="solar:inbox-out-bold-duotone" size="lg" footer={<Button onClick={onClose}>Tutup</Button>}>
    <Box sx={{display:"grid",gap:3,minWidth:0}}>
      <AppNotice description="Pengembalian hanya dapat menggunakan barang dari penyaluran ini. Jumlahnya tidak boleh melebihi sisa yang belum dikembalikan."/>
      <Box sx={{display:"grid",gridTemplateColumns:{xs:"minmax(0,1fr)",sm:"repeat(2,minmax(0,1fr))"},gap:2}}>
        {[["Tanggal penyaluran",dayjs(source.occurred_on).format("D MMM YYYY")],["Gudang asal",source.warehouse_name],["Lokasi tujuan",source.destination_location_name || "Tidak tersedia"],["Divisi & Unit tujuan",source.destination_unit_name || "Tidak tersedia"],["Pegawai penerima",source.recipient_name || "Tidak tersedia"],...(source.reference_no?[["Nomor memo/permintaan",source.reference_no]]:[]),["Disimpan oleh",source.actor_name]].map(([label,value])=><Box key={label}><FontStyle fontSize={12} sx={{color:"text.secondary"}}>{label}</FontStyle><FontStyle fontWeight={700} sx={{overflowWrap:"anywhere"}}>{value}</FontStyle></Box>)}
      </Box>
      <FontStyle fontWeight={700}>Barang yang disalurkan</FontStyle>
      {source.lines.map((line)=><Box key={line.itemId} sx={{display:"grid",gap:2,pb:2,borderBottom:"1px solid",borderColor:"divider",minWidth:0}}>
        <Box sx={{display:"flex",alignItems:"center",gap:1.5,minWidth:0}}><InventoryItemPhoto item={line} organizationId={organizationId} onPreview={setPreview}/><FontStyle fontWeight={700} sx={{overflowWrap:"anywhere"}}>{line.name}</FontStyle></Box>
        <Box sx={{display:"flex",gap:1.5,flexWrap:"wrap"}}><InventoryQuantityChip label={`Disalurkan: ${amount(line.quantity)} ${line.unit}`}/><InventoryQuantityChip label={`Sudah dikembalikan: ${amount(line.returnedQuantity)} ${line.unit}`} tone="neutral"/><InventoryQuantityChip label={`Masih dapat dikembalikan: ${amount(line.remainingQuantity)} ${line.unit}`} tone="success"/></Box>
      </Box>)}
      {source.notes?<FontStyle explanation>{source.notes}</FontStyle>:null}
    </Box>
  </AppModal><ImagePreviewModal open={!!preview} onClose={()=>setPreview(null)} imageUrl={preview?.url} title={preview?.name || "Foto barang"} alt={`Foto ${preview?.name || "barang"}`}/></>;
}
