"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, DatePicker, Input, InputNumber, Steps } from "antd";
import { Box, Paper, useMediaQuery, useTheme } from "@mui/material";
import dayjs from "dayjs";
import AppModal from "@/app/components/modals/AppModal";
import AppNotice from "@/app/components/data-display/AppNotice";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import FontStyle from "@/app/components/font-style/FontStyle";
import AppIcon from "@/app/components/icons/AppIcon";
import Notification from "@/app/components/Notifications/Notification";
import PrivateFileUpload from "@/app/components/forms/PrivateFileUpload";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import useAppNotification from "@/app/hooks/useAppNotification";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { readApiResponse } from "@/lib/api/clientError";
import { transactionKinds as kinds, transactionTone } from "./transactionPresentations";

const amount = (value) => new Intl.NumberFormat("id-ID",{maximumFractionDigits:3}).format(Number(value));
const empty = (organizationId,transactionId) => ({organizationId:Number(organizationId),transactionId,kind:"",warehouseId:null,occurredOn:"",referenceNo:"",notes:"",lateReason:"",destinationLocationId:null,destinationUnitId:null,recipientEmployeeId:null,sourceTransactionId:null,lines:[]});
function ItemVisual({item,organizationId}) {
  return <Box aria-hidden="true" sx={{width:44,height:44,flexShrink:0,borderRadius:1.5,display:"grid",placeItems:"center",overflow:"hidden",bgcolor:"action.hover",color:"text.secondary"}}>
    {item?.photo_file_id?<Box component="img" src={`/api/uploads/${item.photo_file_id}?organizationId=${organizationId}`} alt="" sx={{width:"100%",height:"100%",objectFit:"cover"}}/>:<AppIcon icon="solar:gallery-minimalistic-linear" width={22}/>}
  </Box>;
}

export default function TransactionWizard({organizationId,draftId,onClose,onSaved}) {
  const theme = useTheme();
  const mobile = useMediaQuery("(max-width:599px)");
  const {runWithLoadingBackdrop}=useLoadingBackdrop();
  const [step,setStep] = useState(0);
  const [data,setData] = useState(()=>empty(organizationId,draftId || crypto.randomUUID()));
  const [version,setVersion] = useState(null);
  const versionRef=useRef(null);
  const savedKindRef=useRef(null);
  const queueRef=useRef(Promise.resolve(true));
  const revisionRef=useRef(0);
  const [draftStatus,setDraftStatus]=useState(draftId?"loading":"new");
  const [draftUpdatedAt,setDraftUpdatedAt]=useState(null);
  const [discardOpen,setDiscardOpen]=useState(false);
  const [pendingKind,setPendingKind]=useState(null);
  const [selectedKind,setSelectedKind]=useState("");
  const [options,setOptions] = useState(null);
  const [itemSearch,setItemSearch] = useState("");
  const [debouncedItemSearch,setDebouncedItemSearch] = useState("");
  const [sources,setSources] = useState([]);
  const [sourceSearch,setSourceSearch] = useState("");
  const [debouncedSourceSearch,setDebouncedSourceSearch] = useState("");
  const [recipients,setRecipients] = useState([]);
  const [errors,setErrors] = useState({});
  const [busy,setBusy] = useState(false);
  const [files,setFiles] = useState({purchaseProof:null,requestDocument:null,handoverPhoto:null});
  const [dirty,setDirty] = useState(false);
  const {notification,showNotification,closeNotification} = useAppNotification();
  const queryBase = `organizationId=${encodeURIComponent(organizationId)}`;
  const includeItemIds = [...new Set([
    ...data.lines.map((line)=>line.itemId).filter(Boolean),
    ...(sources.find((row)=>row.id===data.sourceTransactionId)?.lines || []).map((line)=>line.itemId),
  ])].join(",");
  const update = (patch) => {setData((old)=>({...old,...patch}));revisionRef.current++;setDirty(true);setDraftStatus("dirty");setErrors((old)=>{const next={...old};for(const key of Object.keys(patch))delete next[key];return next;});};
  const loadOptions = useCallback(async (warehouseId,search,includeIds) => {
    try {
      const params = new URLSearchParams({organizationId});
      if (warehouseId) params.set("warehouseId",String(warehouseId));
      if (search) params.set("itemSearch",search);
      if (includeIds) params.set("includeItemIds",includeIds);
      const body = await readApiResponse(await fetch(`/api/inventory/transactions?${params}&options=1`,{cache:"no-store"}));
      setOptions(body.data);
    } catch(cause) {showNotification(cause.message,"error");}
  },[organizationId,showNotification]);
  useEffect(()=>{const timer=setTimeout(()=>setDebouncedItemSearch(itemSearch.trim()),300);return ()=>clearTimeout(timer);},[itemSearch]);
  useEffect(() => {const timer=setTimeout(()=>{void loadOptions(data.warehouseId,debouncedItemSearch,includeItemIds);},0);return ()=>clearTimeout(timer);},[data.warehouseId,debouncedItemSearch,includeItemIds,loadOptions]);
  useEffect(() => {
    if (!draftId) return;
    let active=true;
    void runWithLoadingBackdrop(()=>fetch(`/api/inventory/transactions/${draftId}?${queryBase}`,{cache:"no-store"}).then(readApiResponse),{message:"Memuat draft transaksi..."})
      .then((body)=>{if(!active)return;const {currentStep:ignoredStep,...payload}=body.data.draft_payload || {};void ignoredStep;setData({...empty(organizationId,draftId),...payload,organizationId:Number(organizationId),transactionId:draftId});setSelectedKind(payload.kind || body.data.kind || "");setStep(body.data.draft_step || 0);setVersion(body.data.version);versionRef.current=body.data.version;savedKindRef.current=body.data.kind;setDraftUpdatedAt(body.data.updated_at);setFiles(Object.fromEntries([["purchaseProof","purchase_proof"],["requestDocument","request_document"],["handoverPhoto","handover_photo"]].map(([key,purpose])=>[key,body.data.files.find((entry)=>entry.purpose===purpose)||null])));setDirty(false);setDraftStatus("saved");})
      .catch((cause)=>{if(active){setDraftStatus("error");showNotification(cause.message,"error");}});
    return ()=>{active=false;};
  },[draftId,organizationId,queryBase,showNotification,runWithLoadingBackdrop]);
  useEffect(() => {
    const timer=setTimeout(()=>setDebouncedSourceSearch(sourceSearch.trim()),300);
    return ()=>clearTimeout(timer);
  },[sourceSearch]);
  useEffect(() => {
    if (data.kind!=="return") return;
    let active=true;
    const params = new URLSearchParams({organizationId,kind:"issue",search:debouncedSourceSearch});
    if(data.warehouseId)params.set("warehouseId",String(data.warehouseId));
    void fetch(`/api/inventory/transactions?${params}`,{cache:"no-store"}).then(readApiResponse).then((body)=>{if(active)setSources(body.data.data.filter((row)=>!row.cancelled));}).catch((cause)=>{if(active)showNotification(cause.message,"error");});
    return ()=>{active=false;};
  },[data.kind,data.warehouseId,organizationId,debouncedSourceSearch,showNotification]);
  useEffect(()=>{
    if(data.kind!=="return"||!data.sourceTransactionId||sources.some((entry)=>entry.id===data.sourceTransactionId))return;
    let active=true;
    void fetch(`/api/inventory/transactions/${data.sourceTransactionId}?${queryBase}`,{cache:"no-store"}).then(readApiResponse)
      .then((body)=>{if(active)setSources((current)=>current.some((entry)=>entry.id===body.data.id)?current:[body.data,...current]);})
      .catch((cause)=>{if(active)showNotification(cause.message,"error");});
    return ()=>{active=false;};
  },[data.kind,data.sourceTransactionId,sources,queryBase,showNotification]);
  useEffect(() => {
    if(data.kind!=="issue"||!data.warehouseId||!data.destinationLocationId||!data.destinationUnitId||!data.occurredOn)return;
    let active=true;
    const params=new URLSearchParams({organizationId,recipients:"1",warehouseId:String(data.warehouseId),locationId:String(data.destinationLocationId),unitId:String(data.destinationUnitId),occurredOn:data.occurredOn});
    void fetch(`/api/inventory/transactions?${params}`,{cache:"no-store"}).then(readApiResponse).then((body)=>{if(active)setRecipients(body.data);}).catch((cause)=>{if(active)showNotification(cause.message,"error");});
    return ()=>{active=false;};
  },[data.kind,data.warehouseId,data.destinationLocationId,data.destinationUnitId,data.occurredOn,organizationId,showNotification]);
  useEffect(() => {
    const onBeforeUnload=(event)=>{if(!dirty)return;event.preventDefault();event.returnValue="";};
    window.addEventListener("beforeunload",onBeforeUnload);
    return ()=>window.removeEventListener("beforeunload",onBeforeUnload);
  },[dirty]);
  const warehouse = options?.warehouses.find((row)=>row.id===String(data.warehouseId));
  const source = sources.find((row)=>row.id===data.sourceTransactionId);
  const available = data.kind==="return" ? (source?.lines || []).map((line)=>options?.items.find((item)=>item.id===line.itemId)).filter(Boolean) : (options?.items || []).filter((item)=>data.kind==="opening"?!item.opening_date:!!item.opening_date);
  const selected = useMemo(()=>data.lines.map((line)=>({...line,item:options?.items.find((item)=>item.id===String(line.itemId))})),[data.lines,options]);
  const validate = (targetStep) => {
    const next={};
    if(!(targetStep===0?selectedKind:data.kind))next.kind="Pilih jenis transaksi.";
    if(targetStep>=1){
      if(!data.warehouseId)next.warehouseId="Pilih gudang.";
      if(!data.occurredOn)next.occurredOn="Pilih tanggal transaksi.";
      if(data.occurredOn&&dayjs().startOf("day").diff(dayjs(data.occurredOn),"day")>0&&data.lateReason.trim().length<10)next.lateReason="Jelaskan alasan pencatatan terlambat, minimal 10 karakter.";
      if(data.kind==="return"&&!data.sourceTransactionId)next.sourceTransactionId="Pilih transaksi barang keluar asal.";
      if(data.kind==="issue"){
      if(!data.destinationLocationId)next.destinationLocationId="Pilih lokasi tujuan.";
      if(!data.destinationUnitId)next.destinationUnitId="Pilih Divisi & Unit tujuan.";
      if(!data.recipientEmployeeId)next.recipientEmployeeId="Pilih pegawai penerima.";
      }
    }
    if(targetStep>=2){
      if(!data.lines.length)next.lines="Tambahkan sedikitnya satu barang.";
      for(const [index,line] of data.lines.entries()){
        if(!line.itemId)next[`lines.${index}.itemId`]="Pilih barang.";
        if(line.quantity===null||line.quantity===undefined||line.quantity===""||line.quantity<0||(!["opening","stocktake"].includes(data.kind)&&line.quantity===0))next[`lines.${index}.quantity`]="Isi jumlah yang valid.";
        const item=options?.items.find((entry)=>entry.id===String(line.itemId));
        if(item&&!item.allows_fractional&&Number(line.quantity)%1!==0)next[`lines.${index}.quantity`]="Satuan barang ini hanya menerima bilangan bulat.";
        if(data.kind==="issue"&&item&&Number(line.quantity)>Number(item.balance))next[`lines.${index}.quantity`]=`Stok di gudang ini hanya ${amount(item.balance)} ${item.unit_name}; kurangi jumlah yang dikeluarkan.`;
      }
    }
    setErrors(next);
    if(Object.keys(next).length){showNotification(Object.values(next)[0],"error");const first=document.querySelector(`[data-field="${Object.keys(next)[0]}"]`);first?.scrollIntoView({behavior:"smooth",block:"center"});first?.querySelector("input,button")?.focus();return false;}
    return true;
  };
  const saveDraft = useCallback((snapshot=data,currentStep=step) => {
    const revision=revisionRef.current;
    queueRef.current=queueRef.current.catch(()=>false).then(async()=>{
      setDraftStatus("saving");
      try {
        const body=await readApiResponse(await fetch("/api/inventory/transactions/drafts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...snapshot,currentStep,version:versionRef.current || undefined})}));
        versionRef.current=body.data.version;setVersion(body.data.version);setDraftUpdatedAt(body.data.updated_at);
        if(savedKindRef.current && savedKindRef.current!==snapshot.kind)setFiles({purchaseProof:null,requestDocument:null,handoverPhoto:null});
        savedKindRef.current=snapshot.kind;
        if(revision===revisionRef.current){setDirty(false);setDraftStatus("saved");}else setDraftStatus("dirty");
        return true;
      }catch(cause){setDraftStatus("error");showNotification(cause.message,"error");return false;}
    });
    return queueRef.current;
  },[data,step,showNotification]);
  const requestClose=async()=>{const saved=dirty?await saveDraft(data,step):await queueRef.current;if(saved!==false)onClose?.();};
  const applySelectedKind=async()=>{
    const snapshot={...empty(organizationId,data.transactionId),kind:selectedKind};
    setBusy(true);
    try {
      if(await saveDraft(snapshot,1)){
        setData(snapshot);setErrors({});setDirty(false);setStep(1);setPendingKind(null);
      }
    } finally {setBusy(false);}
  };
  const nextStep=async()=>{
    if(!validate(step))return;
    if(step===0&&selectedKind!==data.kind){
      const hasDetails=Boolean(data.warehouseId||data.occurredOn||data.referenceNo||data.notes||data.lateReason||data.destinationLocationId||data.destinationUnitId||data.recipientEmployeeId||data.sourceTransactionId||data.lines.length||Object.values(files).some(Boolean));
      if(data.kind&&hasDetails){setPendingKind(selectedKind);return;}
      await applySelectedKind();return;
    }
    const next=step+1;if(await saveDraft(data,next))setStep(next);
  };
  const previousStep=async()=>{const previous=Math.max(0,step-1);if(await saveDraft(data,previous)){setSelectedKind(data.kind);setStep(previous);}};
  const uploadDraftFile=async(key,purpose,value)=>{
    if(!value){setFiles((old)=>({...old,[key]:null}));return;}
    setFiles((old)=>({...old,[key]:value}));
  };
  const removeDraftFile=async(key,file)=>{
    try{await runWithLoadingBackdrop(async()=>{await readApiResponse(await fetch(`/api/inventory/transactions/${data.transactionId}/draft-files/${file.id}?${queryBase}`,{method:"DELETE"}));setFiles((old)=>({...old,[key]:null}));},{message:"Menghapus lampiran draft..."});}
    catch(cause){showNotification(cause.message,"error");}
  };
  const discardAndRestart=async()=>{
    if(!version)return;
    setBusy(true);
    try{
      await queueRef.current;
      await runWithLoadingBackdrop(()=>fetch(`/api/inventory/transactions/${data.transactionId}/draft?${queryBase}`,{method:"DELETE"}).then(readApiResponse),{message:"Membuang draft transaksi..."});
      const nextId=crypto.randomUUID();
      setData(empty(organizationId,nextId));setSelectedKind("");setStep(0);setVersion(null);versionRef.current=null;
      queueRef.current=Promise.resolve(true);revisionRef.current=0;savedKindRef.current=null;setFiles({purchaseProof:null,requestDocument:null,handoverPhoto:null});
      setDirty(false);setDraftUpdatedAt(null);setDraftStatus("new");setDiscardOpen(false);setErrors({});
      showNotification("Draft dibuang. Anda dapat mulai mencatat transaksi baru.");
    }catch(cause){showNotification(cause.message,"error");}
    finally{setBusy(false);}
  };
  const post = async () => {
    if(!validate(2))return;
    setBusy(true);
    try {
      if(!(await saveDraft(data,step)))return;
      await runWithLoadingBackdrop(()=>fetch("/api/inventory/transactions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...data,version:versionRef.current || undefined})}).then(readApiResponse),{message:"Mencatat transaksi dan memperbarui stok..."});
      setDirty(false);showNotification("Transaksi tercatat dan stok diperbarui.");onSaved?.();
    }catch(cause){setErrors(cause.fieldErrors || {});showNotification(cause.message,"error");if(cause.fieldErrors?.lines)setStep(2);}
    finally{setBusy(false);}
  };
  const setLine=(index,patch)=>{update({lines:data.lines.map((line,n)=>n===index?{...line,...patch}:line)});setErrors((old)=>{const next={...old};for(const key of Object.keys(patch))delete next[`lines.${index}.${key}`];return next;});};
  const chooseKind=(kind)=>{setSelectedKind(kind);setErrors((old)=>({...old,kind:undefined}));};
  const fieldError=(key)=><FontStyle fontSize={11.5} sx={{color:theme.status.danger.main,mt:.5}}>{errors[key]}</FontStyle>;
  const label=(text)=><FontStyle fontSize={12} fontWeight={600} sx={{mb:.75}}>{text}</FontStyle>;
  const field=(key,text,control)=><Box data-field={key} sx={{minWidth:0}}>{label(text)}{control}{errors[key]?fieldError(key):null}</Box>;
  return <>
    <AppModal open title={draftId&&draftStatus!=="new"?"Lanjutkan draft transaksi":"Catat transaksi barang"} description="Isi transaksi secara bertahap. Draft tidak mengubah stok." icon="solar:clipboard-list-bold-duotone" size="xl" onClose={requestClose} disableClose={draftStatus==="loading"||busy} contentSx={{pb:4}} footer={<Box sx={{display:{xs:"grid",sm:"flex"},gridTemplateColumns:"minmax(0,1fr)",gap:1.5,flexWrap:"wrap",justifyContent:"flex-end",alignItems:"center",width:"100%","& > .ant-btn":{width:{xs:"100%",sm:"auto"},minHeight:44}}}><Button onClick={requestClose} disabled={busy||draftStatus==="loading"}>Simpan draft & tutup</Button>{step?<Button onClick={previousStep} disabled={busy}>Kembali</Button>:null}{draftStatus==="error"?<Button onClick={()=>saveDraft(data,step)}>Coba simpan lagi</Button>:null}{step<3?<Button type="primary" onClick={nextStep} disabled={busy||draftStatus==="loading"}>Lanjut</Button>:<Button type="primary" loading={busy} onClick={post}>Catat transaksi</Button>}</Box>}>
    <Box sx={{display:"grid",gap:3,minWidth:0,pb:1}}>
    <Box sx={{width:"100%",maxWidth:{xs:300,sm:"none"},mx:"auto","& .ant-steps-item-title":{fontSize:{xs:"12px !important",sm:"14px !important"},whiteSpace:"normal",textAlign:"center"}}}><Steps current={step} size="small" responsive={false} titlePlacement={mobile?"vertical":"horizontal"} items={[{title:"Jenis"},{title:"Detail"},{title:"Barang"},{title:"Periksa"}]} /></Box>
    <AppNotice role="status" tone={{new:"info",loading:"neutral",dirty:"warning",saving:"info",saved:"success",error:"danger"}[draftStatus]} title={{new:"Draft belum disimpan",loading:"Memuat draft",dirty:"Perubahan belum disimpan",saving:"Menyimpan perubahan",saved:"Draft aman tersimpan",error:"Draft belum tersimpan"}[draftStatus]} description={<>{({new:"Pilih jenis transaksi, lalu tekan Lanjut untuk menyimpan draft.",loading:"SITOU sedang memulihkan isian terakhir Anda.",dirty:"Tekan Lanjut, Kembali, atau Simpan draft & tutup untuk menyimpan perubahan.",saving:"Mohon tunggu, isian terbaru sedang diamankan ke server.",saved:"Form dapat ditutup dan dilanjutkan kembali sebelum masa draft berakhir.",error:"Periksa koneksi lalu coba simpan draft kembali. Isian Anda tetap ada di form."})[draftStatus]}{draftUpdatedAt?<Box component="span" sx={{display:"block",mt:.75}}>Terakhir disimpan: {dayjs(draftUpdatedAt).format("D MMM YYYY, HH.mm")}</Box>:null}</>} sx={version?{"& > :last-child":{width:{xs:"100%",sm:"auto"}}}:undefined} action={version?<Button danger onClick={()=>setDiscardOpen(true)} disabled={busy||draftStatus==="saving"} style={{minHeight:44,width:mobile?"100%":undefined}}>Buang draft & mulai ulang</Button>:null}/>
    <Box sx={{display:"grid",gap:3,minWidth:0}}>
      {step===0?<Box sx={{display:"grid",gap:2.5}}>
        <Box data-field="kind"><FontStyle fontSize={12} fontWeight={600} sx={{mb:1}}>Silakan pilih jenis transaksi</FontStyle><Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"repeat(2,minmax(0,1fr))"},gap:1.5}}>{kinds.map((kind)=>{const tone=transactionTone(theme,kind.tone);return <Paper key={kind.value} component="button" type="button" onClick={()=>chooseKind(kind.value)} aria-pressed={selectedKind===kind.value} variant="outlined" sx={{display:"flex",textAlign:"left",gap:1.5,p:2,cursor:"pointer",borderRadius:2,borderColor:selectedKind===kind.value?tone.main:theme.ui.border,bgcolor:selectedKind===kind.value?tone.background:theme.ui.panelBg,"&:focus-visible":{outline:`2px solid ${tone.main}`}}}><Box aria-hidden="true" sx={{width:36,height:36,flex:"0 0 36px",display:"grid",placeItems:"center",borderRadius:1.5,color:tone.main,bgcolor:tone.background,border:`1px solid ${tone.border}`}}><AppIcon icon={kind.icon} width={21}/></Box><Box><FontStyle fontSize={14} fontWeight={700}>{kind.label}</FontStyle><FontStyle explanation fontSize={11.5} sx={{mt:.5}}>{kind.description}</FontStyle></Box></Paper>})}</Box>{errors.kind?fieldError("kind"):null}</Box>
      </Box>:null}
      {step===1?<Box sx={{display:"grid",gap:2.5}}>
        <AppNotice title={kinds.find((entry)=>entry.value===data.kind)?.label || "Detail transaksi"} description="Pilih gudang dan tanggal saat barang diterima, dikeluarkan, dikembalikan, atau dihitung. Tanggal ini menjadi tanggal transaksi pada riwayat." compact/>
        <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"1fr 1fr"},gap:2}}>
          {field("warehouseId","Gudang *",<AsyncSelect value={data.warehouseId ? String(data.warehouseId):undefined} onChange={(value)=>update({warehouseId:Number(value),sourceTransactionId:null,lines:[]})} options={(options?.warehouses || []).map((entry)=>({value:entry.id,label:entry.name}))} placeholder="Pilih gudang" style={{width:"100%",minHeight:44}} status={errors.warehouseId?"error":undefined}/>)}
          {field("occurredOn","Tanggal transaksi *",<DatePicker value={data.occurredOn?dayjs(data.occurredOn):null} onChange={(value)=>update({occurredOn:value?.format("YYYY-MM-DD") || ""})} disabledDate={(date)=>date.isAfter(dayjs(),"day")||date.isBefore(dayjs().subtract(30,"day"),"day")} format="DD MMM YYYY" placeholder="Pilih tanggal" style={{width:"100%",minHeight:44}} status={errors.occurredOn?"error":undefined}/>)}
        </Box>
        {data.occurredOn&&dayjs().startOf("day").diff(dayjs(data.occurredOn),"day")>0?field("lateReason","Alasan pencatatan terlambat *",<Input.TextArea rows={2} maxLength={500} value={data.lateReason} onChange={(event)=>update({lateReason:event.target.value})} placeholder="Mengapa baru dicatat sekarang?" status={errors.lateReason?"error":undefined}/>):null}
        {data.kind==="return"?field("sourceTransactionId","Barang keluar asal *",<AsyncSelect filterOption={false} onSearch={setSourceSearch} value={data.sourceTransactionId || undefined} onChange={(value)=>update({sourceTransactionId:value,lines:[]})} options={sources.map((row)=>({value:row.id,label:`${row.reference_no || row.id.slice(0,8)} · ${dayjs(row.occurred_on).format("D MMM YYYY")} · ${row.warehouse_name}`}))} placeholder="Cari nomor atau barang yang dikembalikan" style={{width:"100%",minHeight:44}}/>):null}
        {data.kind==="issue"?<><AppNotice title="Tujuan penyaluran" description="Satu lokasi, Divisi & Unit, dan pegawai penerima berlaku untuk semua barang dalam transaksi ini." compact/><Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"1fr 1fr"},gap:2}}>
          {field("destinationLocationId","Lokasi tujuan *",<AsyncSelect value={data.destinationLocationId?String(data.destinationLocationId):undefined} onChange={(value)=>update({destinationLocationId:Number(value),destinationUnitId:null,recipientEmployeeId:null})} options={(options?.locations || []).map((row)=>({value:row.id,label:row.name}))} placeholder="Pilih lokasi" style={{width:"100%",minHeight:44}}/>)}
          {field("destinationUnitId","Divisi & Unit tujuan *",<AsyncSelect value={data.destinationUnitId?String(data.destinationUnitId):undefined} onChange={(value)=>update({destinationUnitId:Number(value),recipientEmployeeId:null})} options={(options?.units || []).filter((row)=>row.location_id===String(data.destinationLocationId)).map((row)=>({value:row.id,label:row.name}))} placeholder="Pilih Divisi & Unit" disabled={!data.destinationLocationId} style={{width:"100%",minHeight:44}}/>)}
          {field("recipientEmployeeId","Pegawai penerima *",<AsyncSelect value={data.recipientEmployeeId?String(data.recipientEmployeeId):undefined} onChange={(value)=>update({recipientEmployeeId:Number(value)})} options={recipients.map((row)=>({value:row.id,label:`${row.full_name} · ${row.employee_no}`}))} placeholder="Pilih pegawai" disabled={!data.destinationUnitId||!data.occurredOn} style={{width:"100%",minHeight:44}}/>)}
        </Box></>:null}
        {field("referenceNo","Nomor referensi (opsional)",<Box><Input maxLength={100} value={data.referenceNo} onChange={(event)=>update({referenceNo:event.target.value})} placeholder="Contoh: BA-2026-001" style={{minHeight:44}}/><FontStyle explanation fontSize={12} sx={{mt:1,lineHeight:1.6}}>Isi nomor nota, surat permintaan, atau berita acara agar transaksi mudah dicari. Kosongkan jika tidak ada; nomor ini tidak dibuat otomatis.</FontStyle></Box>)}
        {field("notes","Catatan (opsional)",<Input.TextArea rows={2} maxLength={2000} value={data.notes} onChange={(event)=>update({notes:event.target.value})} placeholder="Keterangan tambahan untuk riwayat transaksi"/>)}
        {data.kind==="receipt"||data.kind==="issue"?<Box sx={{display:"grid",gap:3,mb:1}}><AppNotice title="Lampiran draft tersimpan privat" description="File yang dipilih dapat dibuka kembali bersama draft. Lampiran baru dapat dipilih setelah draft pertama tersimpan." compact/>
          {data.kind==="receipt"?<Box>{label("Bukti pembelian (gambar, opsional)")}<PrivateFileUpload value={files.purchaseProof} organizationId={organizationId} uploadUrl={`/api/inventory/transactions/${data.transactionId}/draft-files`} fields={{purpose:"purchase_proof"}} onChange={(value)=>uploadDraftFile("purchaseProof","purchase_proof",value)} onRemoveRequest={({file})=>removeDraftFile("purchaseProof",file)} disabled={!version} onError={(message)=>showNotification(message,"error")} backdropMessages={{upload:"Mengunggah bukti pembelian...",remove:"Menghapus bukti pembelian..."}} accept="image/jpeg,image/png,image/webp" maxSizeBytes={5*1024*1024} emptyTitle="Pilih gambar bukti pembelian" helpText="JPEG, PNG, atau WebP; maksimal 5 MB. File tetap privat."/></Box>:null}
          {data.kind==="issue"?<Box sx={{display:"grid",gap:4,minWidth:0}}><Box>{label("Dokumen permintaan (PDF, opsional)")}<PrivateFileUpload value={files.requestDocument} organizationId={organizationId} uploadUrl={`/api/inventory/transactions/${data.transactionId}/draft-files`} fields={{purpose:"request_document"}} onChange={(value)=>uploadDraftFile("requestDocument","request_document",value)} onRemoveRequest={({file})=>removeDraftFile("requestDocument",file)} disabled={!version} onError={(message)=>showNotification(message,"error")} backdropMessages={{upload:"Mengunggah dokumen permintaan...",remove:"Menghapus dokumen permintaan..."}} accept=".pdf,application/pdf" maxSizeBytes={10*1024*1024} emptyTitle="Pilih dokumen permintaan PDF" helpText="Maksimal 10 MB. File tetap privat."/></Box><Box sx={{mt:3,pt:1}}>{label("Foto serah terima (opsional)")}<PrivateFileUpload value={files.handoverPhoto} organizationId={organizationId} uploadUrl={`/api/inventory/transactions/${data.transactionId}/draft-files`} fields={{purpose:"handover_photo"}} onChange={(value)=>uploadDraftFile("handoverPhoto","handover_photo",value)} onRemoveRequest={({file})=>removeDraftFile("handoverPhoto",file)} disabled={!version} onError={(message)=>showNotification(message,"error")} backdropMessages={{upload:"Mengunggah foto serah terima...",remove:"Menghapus foto serah terima..."}} accept="image/jpeg,image/png,image/webp" maxSizeBytes={5*1024*1024} emptyTitle="Pilih foto serah terima" helpText="JPEG, PNG, atau WebP; maksimal 5 MB."/></Box></Box>:null}
        </Box>:null}
      </Box>:null}
      {step===2?<Box sx={{display:"grid",gap:2}}>
        <AppNotice title={data.kind==="opening"?"Catat hasil hitung awal":"Jumlah akan mengubah stok saat transaksi disimpan"} description={data.kind==="opening"?"Isi 0 jika barang sudah dihitung tetapi gudang kosong. Saldo awal tidak dapat diedit setelah dicatat.":"Periksa jumlah per barang. Draft tidak mengubah stok."}/>
        {!available.length?<AppNotice tone="warning" title="Belum ada barang yang dapat dipilih" description={data.kind==="opening"?"Daftarkan barang aktif di gudang melalui Data Master → Barang Persediaan.":"Catat saldo awal atau periksa pengaturan barang di gudang ini."}/>:null}
        {data.lines.map((line,index)=>{const item=options?.items.find((entry)=>entry.id===String(line.itemId));return <Paper key={index} variant="outlined" sx={{p:2,borderRadius:2,display:"grid",gridTemplateColumns:{xs:"1fr auto",sm:"minmax(0,1fr) 160px auto"},gap:1.5,alignItems:"start"}}>
          <Box data-field={`lines.${index}.itemId`} sx={{minWidth:0}}>{label(`Barang ${index+1}`)}<Box sx={{display:"flex",gap:1.25,alignItems:"center"}}><ItemVisual item={item} organizationId={organizationId}/><AsyncSelect filterOption={false} onSearch={setItemSearch} value={line.itemId?String(line.itemId):undefined} onChange={(value)=>{setLine(index,{itemId:Number(value),quantity:null});setItemSearch("");}} options={available.filter((entry)=>entry.id===String(line.itemId)||!data.lines.some((other)=>String(other.itemId)===entry.id)).map((entry)=>({value:entry.id,label:`${entry.name} · ${entry.unit_name}`}))} placeholder="Cari nama atau kode barang" style={{width:"100%",minWidth:0,minHeight:44}}/></Box>{item?<FontStyle fontSize={11.5} sx={{color:"text.secondary",mt:.75}}>{data.kind==="issue"?`Stok tersedia: ${amount(item.balance)} ${item.unit_name}`:data.kind==="stocktake"?`Stok tercatat: ${amount(item.balance)} ${item.unit_name}`:`Satuan: ${item.unit_name}`}</FontStyle>:null}{errors[`lines.${index}.itemId`]?fieldError(`lines.${index}.itemId`):null}</Box>
          <Box data-field={`lines.${index}.quantity`} sx={{gridColumn:{xs:"1",sm:"auto"}}}>{label(data.kind==="stocktake"?"Hasil hitung *":data.kind==="opening"?"Saldo awal *":"Jumlah *")}<InputNumber min={0} max={999999999999} precision={item?.allows_fractional?3:0} value={line.quantity} onChange={(value)=>setLine(index,{quantity:value})} style={{width:"100%",minHeight:44}} status={errors[`lines.${index}.quantity`]?"error":undefined}/>{errors[`lines.${index}.quantity`]?fieldError(`lines.${index}.quantity`):null}</Box>
          <Button danger type="text" icon={<AppIcon icon="solar:trash-bin-trash-linear" width={18}/>} aria-label={`Hapus barang ${index+1}`} onClick={()=>update({lines:data.lines.filter((_,n)=>n!==index)})} style={{minHeight:44,minWidth:44}}/>
        </Paper>})}
        {errors.lines?fieldError("lines"):null}
        <Button icon={<AppIcon icon="solar:add-circle-linear" width={18}/>} disabled={!available.length||data.lines.length>=100} onClick={()=>update({lines:[...data.lines,{itemId:null,quantity:null}]})} style={{minHeight:44,justifySelf:"start"}}>Tambah barang</Button>
      </Box>:null}
      {step===3?<Box sx={{display:"grid",gap:2}}>
        <AppNotice tone="warning" title="Periksa sebelum mencatat" description="Transaksi yang telah dicatat tidak dapat diedit atau dihapus. Jika ada kesalahan, buat pembatalan beralasan atau stok opname."/>
        <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"1fr 1fr"},gap:1.5}}>{[["Jenis",kinds.find((entry)=>entry.value===data.kind)?.label],["Gudang",warehouse?.name],["Tanggal transaksi",data.occurredOn?dayjs(data.occurredOn).format("D MMM YYYY"):"—"],["Barang",`${data.lines.length} jenis`],["Nomor referensi",data.referenceNo || "—"],["Penerima",recipients.find((entry)=>entry.id===String(data.recipientEmployeeId))?.full_name || "—"]].map(([name,value])=><Box key={name}><FontStyle fontSize={11.5} sx={{color:"text.secondary"}}>{name}</FontStyle><FontStyle fontSize={14} fontWeight={600}>{value}</FontStyle></Box>)}</Box>
        {data.occurredOn!==dayjs().format("YYYY-MM-DD")?<AppNotice tone="info" title="Transaksi dicatat untuk tanggal sebelumnya" description="Sistem akan menghitung ulang stok mulai dari tanggal transaksi. Jika ada tanggal yang membuat stok menjadi negatif, transaksi ditolak tanpa menghapus isian Anda." compact/>:null}
        <Box component="ul" sx={{m:0,p:0,listStyle:"none",display:"grid",gap:1}}>{selected.map((line,index)=>{const current=Number(line.item?.balance || 0);const qty=Number(line.quantity);const estimate=data.kind==="opening"||data.kind==="stocktake"?qty:data.kind==="issue"?current-qty:current+qty;return <Paper component="li" key={index} variant="outlined" sx={{p:1.5,borderRadius:2,display:"flex",flexWrap:"wrap",justifyContent:"space-between",alignItems:"center",gap:1.5}}><Box sx={{display:"flex",alignItems:"center",gap:1.25}}><ItemVisual item={line.item} organizationId={organizationId}/><FontStyle fontSize={13} fontWeight={600}>{line.item?.name || "Barang"}</FontStyle></Box><Box sx={{textAlign:"right"}}><FontStyle fontSize={13} fontWeight={600}>{amount(line.quantity)} {line.item?.unit_name}</FontStyle><FontStyle fontSize={11.5} sx={{color:"text.secondary"}}>{data.occurredOn===dayjs().format("YYYY-MM-DD")?`${data.kind==="opening"?"Saldo awal":data.kind==="stocktake"?"Stok hasil hitung":"Perkiraan stok setelah dicatat"}: ${amount(estimate)} ${line.item?.unit_name}`:"Saldo akan dihitung ulang oleh sistem"}</FontStyle></Box></Paper>;})}</Box>
        {data.lateReason?<AppNotice title="Alasan pencatatan terlambat" description={data.lateReason} compact/>:null}
        {Object.values(files).some(Boolean)?<AppNotice title="Lampiran draft" description="Lampiran yang sudah tersimpan privat akan dihubungkan ke transaksi saat pencatatan berhasil." compact/>:null}
      </Box>:null}
      </Box>
    </Box>
    </AppModal>
    <ConfirmDialog open={discardOpen} title="Buang draft dan mulai ulang?" message="Seluruh isian dan lampiran pada draft ini akan dibuang. Stok gudang tidak berubah." danger confirmText="Buang draft" loading={busy} onClose={()=>setDiscardOpen(false)} onConfirm={discardAndRestart}/>
    <ConfirmDialog open={!!pendingKind} title="Ganti jenis transaksi?" message="Isian dan lampiran jenis transaksi sebelumnya akan dikosongkan. Stok gudang belum berubah." danger confirmText="Ganti jenis" loading={busy} fullWidthMobile onClose={()=>setPendingKind(null)} onConfirm={applySelectedKind}/>
    <Notification {...notification} onClose={closeNotification}/>
  </>;
}
