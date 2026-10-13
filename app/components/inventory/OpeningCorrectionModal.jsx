"use client";
import {useEffect,useState} from "react";
import {Button,DatePicker,Input,InputNumber} from "antd";
import {Box,Divider} from "@mui/material";
import dayjs from "dayjs";
import AppModal from "@/app/components/modals/AppModal";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import AppNotice from "@/app/components/data-display/AppNotice";
import FontStyle from "@/app/components/font-style/FontStyle";
import {readApiResponse} from "@/lib/api/clientError";
import InventoryQuantityChip from "./InventoryQuantityChip";
import {transactionPayload} from "@/lib/inventory/returnPolicy.mjs";
const amount=(value)=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:3}).format(Number(value));
export default function OpeningCorrectionModal({organizationId,warehouseId,itemId,pendingData,onClose,onApplied}) {
  const [operationId]=useState(()=>crypto.randomUUID());
  const [source,setSource]=useState(null),[correction,setCorrection]=useState(null),[preview,setPreview]=useState(null);
  const [error,setError]=useState(""),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),[fields,setFields]=useState({});
  const identity={organizationId:Number(organizationId),warehouseId:Number(warehouseId),itemId:Number(itemId)};
  useEffect(()=>{const controller=new AbortController();fetch(`/api/inventory/openings?organizationId=${organizationId}&warehouseId=${warehouseId}&itemId=${itemId}`,{signal:controller.signal,cache:"no-store"}).then(readApiResponse).then((body)=>{
    if(controller.signal.aborted)return;setSource(body.data);
    const saved=pendingData?.openingCorrections?.find((c)=>String(c.itemId)===String(itemId));
    setCorrection({...body.data.effective,reason:"",...saved,version:body.data.version,fingerprint:body.data.fingerprint});
  }).catch((e)=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[organizationId,warehouseId,itemId,pendingData]);
  const update=(patch)=>{setCorrection({...correction,...patch});setPreview(null);setFields({});setError("");};
  const request=async(action)=>readApiResponse(await fetch("/api/inventory/openings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...identity,action,operationId,correction:{occurredOn:correction.occurredOn,quantity:Number(correction.quantity),reason:correction.reason,version:correction.version,fingerprint:correction.fingerprint}})}));
  const inspect=async()=>{if(correction.quantity==null){setError("Isi jumlah stok sebelum transaksi pertama.");return;}setBusy(true);setError("");try{
    let result;
    if(!pendingData)result=(await request("preview")).data;
    if(pendingData){const corrections=[...(pendingData.openingCorrections||[]).filter((c)=>String(c.itemId)!==String(itemId)),{...correction,itemId:Number(itemId),quantity:Number(correction.quantity)}];
      const response=await readApiResponse(await fetch("/api/inventory/transactions/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(transactionPayload({...pendingData,openingCorrections:corrections,calculationVersions:undefined}))}));
      const line=response.data.lines.find((l)=>String(l.itemId)===String(itemId));result={before:source.current,after:line.currentAfter,history:line.correctionHistory||[]};}
    setPreview(result);
  }catch(e){setError(e.message);setFields(e.fieldErrors||{});}finally{setBusy(false);}};
  const apply=async()=>{setBusy(true);try{
    if(!pendingData)await request("correct");
    onApplied({...correction,itemId:Number(itemId),quantity:Number(correction.quantity)});
  }catch(e){
    if(e instanceof TypeError || e.code==="INVALID_RESPONSE") {
      try {const verified=await readApiResponse(await fetch(`/api/inventory/openings?organizationId=${organizationId}&warehouseId=${warehouseId}&itemId=${itemId}`,{cache:"no-store"}));if(verified?.data?.revisions.some((r)=>r.operationId===operationId)){onApplied({...correction,itemId:Number(itemId),quantity:Number(correction.quantity)});return;}}catch {}
      setError("Status penyimpanan belum dapat diverifikasi. Periksa revisi saldo awal sebelum mencoba kembali.");
    }else{setError(e.message);setFields(e.fieldErrors||{});}setConfirm(false);
  }finally{setBusy(false);}};
  const fieldError=(key)=>{const text=Object.entries(fields).find(([k])=>k.endsWith(key))?.[1];return text?<FontStyle role="alert" sx={{mt:1,color:"error.main"}}>{text}</FontStyle>:null;};
  return <><AppModal open disableClose={busy} onClose={onClose} title="Koreksi saldo awal" description={source?`${source.item} · ${source.warehouse}`:"Memuat saldo awal"} footer={<Box sx={{display:{xs:"grid",sm:"flex"},gap:1,gridTemplateColumns:"minmax(0,1fr)","& .ant-btn":{minHeight:44}}}><Button onClick={onClose} disabled={busy}>Batal</Button><Button onClick={inspect} disabled={!correction||busy} loading={busy}>Periksa perubahan</Button><Button type="primary" disabled={!preview||busy} onClick={()=>setConfirm(true)}>{pendingData?"Gunakan koreksi":"Simpan koreksi"}</Button></Box>}>
    <Box sx={{display:"grid",gap:3,minWidth:0}}>{error?<AppNotice tone="danger" description={error}/>:null}
      {!source?<AppNotice description="Memuat tanggal, jumlah, dan riwayat saldo awal..."/>:<>
      <AppNotice description={pendingData?"Koreksi baru disimpan bersama penerimaan saat Anda menekan Simpan transaksi. Isian penerimaan tetap dipertahankan.":"Koreksi mengubah perhitungan stok. Dokumen dan riwayat asal tetap disimpan."}/>
      <Box sx={{display:"flex",gap:1,flexWrap:"wrap"}}><InventoryQuantityChip label={`Saldo awal lama: ${amount(source.effective.quantity)} ${source.unit}`}/><InventoryQuantityChip label={`Tanggal lama: ${dayjs(source.effective.occurredOn).format("D MMM YYYY")}`}/></Box>
      {pendingData?<AppNotice description={`Penerimaan yang akan dimasukkan: ${dayjs(pendingData.occurredOn).format("D MMM YYYY")}. Jumlah saldo awal harus merupakan stok sebelum penerimaan ini.`}/>:null}
      <Box sx={{display:"grid",gridTemplateColumns:{xs:"minmax(0,1fr)",sm:"repeat(2,minmax(0,1fr))"},gap:2}}>
        <Box><FontStyle sx={{mb:1}}>Tanggal saldo awal yang benar</FontStyle><DatePicker aria-label="Tanggal saldo awal yang benar" format="D MMM YYYY" value={correction?.occurredOn?dayjs(correction.occurredOn):null} onChange={(v)=>update({occurredOn:v?.format("YYYY-MM-DD")||""})} style={{width:"100%"}}/>{fieldError("occurredOn")}</Box>
        <Box><FontStyle sx={{mb:1}}>Stok sebelum transaksi pertama ({source.unit})</FontStyle><InputNumber aria-label="Stok sebelum transaksi pertama" min={0} max={999999999999} precision={source.allowsFractional?undefined:0} value={correction?Number(correction.quantity):null} onChange={(v)=>update({quantity:v})} style={{width:"100%"}}/>{fieldError("quantity")}</Box>
      </Box><Box><FontStyle sx={{mb:1}}>Alasan koreksi</FontStyle><Input.TextArea aria-label="Alasan koreksi" rows={3} value={correction?.reason||""} onChange={(e)=>update({reason:e.target.value})}/><FontStyle fontSize={12} sx={{mt:1}}>Jelaskan kesalahan dan dasar perbaikannya, minimal 10 karakter.</FontStyle>{fieldError("reason")}</Box>
      <Divider/><FontStyle fontWeight={600}>Riwayat yang terdampak</FontStyle>
      {preview?<Box sx={{display:"flex",gap:1,flexWrap:"wrap"}}><InventoryQuantityChip label={`Stok sebelum: ${amount(preview.before)} ${source.unit}`}/><InventoryQuantityChip label={`Stok setelah: ${amount(preview.after)} ${source.unit}`} tone="success"/></Box>:null}
      {(preview?.history||source.history).map((row,index)=><Box key={index} sx={{pb:1,borderBottom:1,borderColor:"divider"}}><FontStyle>{dayjs(row.occurredOn).format("D MMM YYYY")} · {row.kind==="stocktake"?"Stok opname":row.kind==="opening"?"Saldo awal":"Perubahan stok"}</FontStyle><FontStyle fontSize={12}>Efek stok: {amount(row.effectiveDelta)} {source.unit} · Saldo: {amount(row.balance)} {source.unit}{row.originalDelta && row.originalDelta!==row.effectiveDelta?` · Efek asal: ${amount(row.originalDelta)} ${source.unit}`:""}</FontStyle></Box>)}
    </>}</Box></AppModal><ConfirmDialog open={confirm} onClose={()=>setConfirm(false)} onConfirm={apply} title={pendingData?"Gunakan koreksi ini?":"Simpan koreksi saldo awal?"} message={pendingData?"Koreksi disiapkan pada draft dan diterapkan bersama Simpan transaksi.":"Tanggal dan jumlah baru akan digunakan untuk menghitung ulang riwayat stok. Alasan dan perubahan disimpan dalam audit."} fullWidthMobile loading={busy}/></>;
}
