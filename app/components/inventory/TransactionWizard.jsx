"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, DatePicker, Input, InputNumber, Steps } from "antd";
import { Box, Divider, Paper, useMediaQuery, useTheme } from "@mui/material";
import dayjs from "dayjs";
import AppModal from "@/app/components/modals/AppModal";
import AppNotice from "@/app/components/data-display/AppNotice";
import RelatedRecordAction from "@/app/components/actions/RelatedRecordAction";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import FontStyle from "@/app/components/font-style/FontStyle";
import AppIcon from "@/app/components/icons/AppIcon";
import AppIconTile from "@/app/components/icons/AppIconTile";
import Notification from "@/app/components/Notifications/Notification";
import PrivateFileUpload from "@/app/components/forms/PrivateFileUpload";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import InventoryItemPhoto from "./InventoryItemPhoto";
import InventoryItemCard from "./InventoryItemCard";
import InventoryStockMetric from "./InventoryStockMetric";
import InventoryQuantityChip from "./InventoryQuantityChip";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import useAppNotification from "@/app/hooks/useAppNotification";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { readApiResponse } from "@/lib/api/clientError";
import { transactionKinds as kinds, transactionTone } from "./transactionPresentations";
import { sourceTransactionLabel } from "@/lib/inventory/sourceTransactionLabel.mjs";
import {buildReturnLines,transactionPayload} from "@/lib/inventory/returnPolicy.mjs";
import OpeningCorrectionModal from "./OpeningCorrectionModal";
import {requiresLateReason,transactionDocumentField,transactionReferenceLabel} from "@/lib/inventory/transactionFieldPolicy.mjs";
import TransactionSourceDetailModal from "./TransactionSourceDetailModal";

const amount = (value) => new Intl.NumberFormat("id-ID",{maximumFractionDigits:3}).format(Number(value));
const reviewTitles = {opening:"Rincian stok awal",receipt:"Rincian barang masuk",issue:"Rincian barang keluar",return:"Rincian barang kembali",stocktake:"Rincian stok opname"};
const empty = (organizationId,transactionId) => ({organizationId:Number(organizationId),transactionId,kind:"",warehouseId:null,occurredOn:"",referenceNo:"",notes:"",lateReason:"",destinationLocationId:null,destinationUnitId:null,recipientEmployeeId:null,sourceTransactionId:null,lines:[]});

export default function TransactionWizard({organizationId,draftId,onClose,onSaved}) {
  const theme = useTheme();
  const mobile = useMediaQuery("(max-width:599px)");
  const {runWithLoadingBackdrop}=useLoadingBackdrop();
  const [step,setStep] = useState(0);
  const [photoPreview,setPhotoPreview] = useState(null);
  const [correctionItem,setCorrectionItem] = useState(null);
  const [stockPreview,setStockPreview] = useState(null);
  const [data,setData] = useState(()=>empty(organizationId,draftId || crypto.randomUUID()));
  const [version,setVersion] = useState(null);
  const versionRef=useRef(null);
  const savedKindRef=useRef(null);
  const pendingCommitRef=useRef(null);
  const [commitUncertain,setCommitUncertain]=useState(false);
  const queueRef=useRef(Promise.resolve(true));
  const revisionRef=useRef(0);
  const [draftStatus,setDraftStatus]=useState(draftId?"loading":"new");
  const [draftUpdatedAt,setDraftUpdatedAt]=useState(null);
  const [discardOpen,setDiscardOpen]=useState(false);
  const [pendingKind,setPendingKind]=useState(null);
  const [selectedKind,setSelectedKind]=useState("");
  const [options,setOptions] = useState(null);
  const optionsRequestRef=useRef(0);
  const [itemSearch,setItemSearch] = useState("");
  const [debouncedItemSearch,setDebouncedItemSearch] = useState("");
  const [sources,setSources] = useState([]);
  const [returnSource,setReturnSource] = useState(null);
  const [returnLoading,setReturnLoading] = useState(false);
  const [returnError,setReturnError] = useState("");
  const [sourceDetailOpen,setSourceDetailOpen] = useState(false);
  const sourcePageRef=useRef({key:"",cursor:null,loading:false});
  const [sourceLoadedKey,setSourceLoadedKey]=useState(null);
  const [sourceListError,setSourceListError]=useState("");
  const [sourceReload,setSourceReload]=useState(0);
  const [sourceSearch,setSourceSearch] = useState("");
  const [debouncedSourceSearch,setDebouncedSourceSearch] = useState("");
  const [recipients,setRecipients] = useState([]);
  const [errors,setErrors] = useState({});
  const [busy,setBusy] = useState(false);
  const [files,setFiles] = useState({purchaseProof:null,requestDocument:null,handoverPhoto:null});
  const [dirty,setDirty] = useState(false);
  const {notification,showNotification,closeNotification} = useAppNotification();
  useEffect(()=>{
    if(step!==3 || stockPreview || !data.warehouseId || !data.lines.length || (data.kind==="return" && !returnSource))return;
    const controller=new AbortController();
    void fetch("/api/inventory/transactions/preview",{method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify(transactionPayload({...data,version:versionRef.current || undefined}))})
      .then(readApiResponse).then((body)=>{if(!controller.signal.aborted)setStockPreview(body.data);})
      .catch((cause)=>{if(!controller.signal.aborted){setErrors(cause.fieldErrors || {});setStep(2);showNotification(cause.message,"error");}});
    return ()=>controller.abort();
  },[step,stockPreview,data,returnSource,showNotification]);
  useEffect(()=>{const key=Object.keys(errors).find((k)=>k.startsWith("lines.")||["occurredOn","lateReason","warehouseId"].includes(k));if(!key)return;
    const timer=setTimeout(()=>{const node=document.querySelector(`[data-field="${key}"]`);node?.scrollIntoView({block:"nearest"});node?.querySelector("input,button")?.focus();},0);return()=>clearTimeout(timer);},[errors,step]);
  const queryBase = `organizationId=${encodeURIComponent(organizationId)}`;
  const sourceQueryKey=`${organizationId}:${data.warehouseId}:${debouncedSourceSearch}:${sourceReload}`;
  const includeItemIds = [...new Set([
    ...data.lines.map((line)=>line.itemId).filter(Boolean),
    ...(sources.find((row)=>row.id===data.sourceTransactionId)?.lines || []).map((line)=>line.itemId),
  ])].join(",");
  const update = (patch) => {setData((old)=>({...old,...patch}));revisionRef.current++;setDirty(true);setDraftStatus("dirty");setErrors((old)=>{const next={...old};for(const key of Object.keys(patch))delete next[key];return next;});};
  const loadOptions = useCallback(async (warehouseId,search,includeIds) => {
    const serial=++optionsRequestRef.current;
    try {
      const params = new URLSearchParams({organizationId});
      if (warehouseId) params.set("warehouseId",String(warehouseId));
      if (search) params.set("itemSearch",search);
      if (includeIds) params.set("includeItemIds",includeIds);
      const body = await readApiResponse(await fetch(`/api/inventory/transactions?${params}&options=1`,{cache:"no-store"}));
      if(serial===optionsRequestRef.current)setOptions(body.data);
      return body.data;
    } catch(cause) {if(serial===optionsRequestRef.current)showNotification(cause.message,"error");}
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
    if (data.kind!=="return" || !data.warehouseId) return;
    let active=true;
    const key=sourceQueryKey;
    sourcePageRef.current={key,cursor:null,loading:true};
    const params = new URLSearchParams({organizationId,kind:"issue",status:"active",search:debouncedSourceSearch,pageSize:"50"});
    if(data.warehouseId)params.set("warehouseId",String(data.warehouseId));
    void fetch(`/api/inventory/transactions?${params}`,{cache:"no-store"}).then(readApiResponse).then((body)=>{if(active){setSources(body.data.data.filter((row)=>!row.cancelled));setSourceLoadedKey(key);setSourceListError("");sourcePageRef.current={key,cursor:body.data.nextCursor,loading:false};}}).catch((cause)=>{if(active){sourcePageRef.current.loading=false;setSourceLoadedKey(key);setSourceListError(cause.message);showNotification(cause.message,"error");}});
    return ()=>{active=false;};
  },[data.kind,data.warehouseId,organizationId,debouncedSourceSearch,sourceQueryKey,showNotification]);
  useEffect(()=>{
    if(data.kind!=="return" || !data.warehouseId || !data.sourceTransactionId)return;
    const controller=new AbortController();
    void fetch(`/api/inventory/transactions/${data.sourceTransactionId}/return-options?${queryBase}&warehouseId=${data.warehouseId}`,{signal:controller.signal,cache:"no-store"}).then(readApiResponse)
      .then((body)=>{if(!controller.signal.aborted){setReturnSource(body.data);setReturnError("");setReturnLoading(false);setData((current)=>({...current,lines:buildReturnLines(body.data.lines,current.lines)}));}})
      .catch((cause)=>{if(!controller.signal.aborted){setReturnLoading(false);setReturnError(cause.message);showNotification(cause.message,"error");}});
    return ()=>controller.abort();
  },[data.kind,data.warehouseId,data.sourceTransactionId,queryBase,showNotification]);
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
  const source = returnSource?.id===data.sourceTransactionId && returnSource.warehouse_id===String(data.warehouseId) ? returnSource : sources.find((row)=>row.id===data.sourceTransactionId);
  const returnPending=data.kind==="return" && !!data.sourceTransactionId && (returnLoading || (!returnSource && !returnError));
  const available = data.kind==="return" ? (source?.lines || []).map((line)=>options?.items.find((item)=>item.id===line.itemId)).filter(Boolean) : (options?.items || []).filter((item)=>data.kind==="opening"?item.opening_eligible:data.kind==="receipt"?true:item.has_history);
  const selected = useMemo(()=>data.lines.filter((line)=>data.kind!=="return"||Number(line.quantity)>0).map((line)=>{
    const catalogItem=options?.items.find((item)=>item.id===String(line.itemId));
    const sourceItem=returnSource?.lines.find((item)=>item.itemId===String(line.itemId));
    return {...line,item:data.kind==="return"?{...catalogItem,...sourceItem}:catalogItem};
  }),[data.lines,data.kind,returnSource,options]);
  const validate = (targetStep) => {
    const next={};
    if(!(targetStep===0?selectedKind:data.kind))next.kind="Pilih jenis transaksi.";
    if(targetStep>=1){
      if(!data.warehouseId)next.warehouseId="Pilih gudang.";
      if(!data.occurredOn)next.occurredOn="Pilih tanggal transaksi.";
      if(requiresLateReason(data.kind,data.occurredOn,options?.today)&&data.lateReason.trim().length<10)next.lateReason="Jelaskan alasan input terlambat, minimal 10 karakter.";
      if(data.kind==="return"&&(!data.sourceTransactionId || !returnSource || returnSource.id!==data.sourceTransactionId || returnError))next.sourceTransactionId="Pilih transaksi penyaluran sebelumnya dan tunggu daftar barang dimuat.";
      if(data.kind==="issue"){
      if(!data.destinationLocationId)next.destinationLocationId="Pilih lokasi tujuan.";
      if(!data.destinationUnitId)next.destinationUnitId="Pilih Divisi & Unit tujuan.";
      if(!data.recipientEmployeeId)next.recipientEmployeeId="Pilih pegawai penerima.";
      }
    }
    if(targetStep>=2){
      if(!data.lines.length)next.lines="Tambahkan sedikitnya satu barang.";
      if(data.kind==="return" && !data.lines.some((line)=>Number(line.quantity)>0))next.lines="Isi jumlah pengembalian pada sedikitnya satu barang. Isi 0 untuk barang yang tidak dikembalikan.";
      for(const [index,line] of data.lines.entries()){
        if(data.kind==="return" && (line.quantity==null || Number(line.quantity)===0))continue;
        if(!line.itemId)next[`lines.${index}.itemId`]="Pilih barang.";
        if(line.quantity===null||line.quantity===undefined||line.quantity===""||line.quantity<0||(!["opening","stocktake"].includes(data.kind)&&line.quantity===0))next[`lines.${index}.quantity`]="Isi jumlah yang valid.";
        const item=options?.items.find((entry)=>entry.id===String(line.itemId));
        if(data.kind==="return"){
          const original=returnSource?.lines.find((entry)=>entry.itemId===String(line.itemId));
          if(!original?.canReturn || Number(line.quantity)>Number(original.remainingQuantity))next[`lines.${index}.quantity`]="Jumlah melebihi batas pengembalian atau barang belum dapat digunakan. Periksa transaksi penyaluran.";
          if(original && !original.allows_fractional && Number(line.quantity)%1!==0)next[`lines.${index}.quantity`]="Satuan barang ini hanya menerima bilangan bulat.";
        }
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
  const requestClose=async()=>{if(commitUncertain){onClose?.();return;}const saved=dirty?await saveDraft(data,step):await queueRef.current;if(saved!==false)onClose?.();};
  const applySelectedKind=async()=>{
    const reference=selectedKind==="return" ? (options?.today ? options : await loadOptions(null,"","")) : null;
    const snapshot={...empty(organizationId,data.transactionId),kind:selectedKind,occurredOn:reference?.today || ""};
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
    const next=step+1;
    if(next===3){
      setBusy(true);
      try{
        if(!(await saveDraft(data,next)))return;
        const body=await runWithLoadingBackdrop(()=>fetch("/api/inventory/transactions/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(transactionPayload({...data,version:versionRef.current}))}).then(readApiResponse),{message:"Memeriksa jumlah dan sisa stok..."});
        setStockPreview(body.data);setStep(next);
      }catch(cause){setErrors(cause.fieldErrors || {});showNotification(cause.message,"error");if(cause.fieldErrors?.occurredOn||cause.fieldErrors?.lateReason)setStep(1);}
      finally{setBusy(false);}
    }else if(await saveDraft(data,next))setStep(next);
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
      showNotification("Draft dibuang. Anda dapat mulai membuat transaksi baru.");
    }catch(cause){showNotification(cause.message,"error");}
    finally{setBusy(false);}
  };
  const post = async () => {
    if(!pendingCommitRef.current && !validate(2))return;
    setBusy(true);
    try {
      if(pendingCommitRef.current){
        const check=await readApiResponse(await fetch(`/api/inventory/transactions/${data.transactionId}?${queryBase}`,{cache:"no-store"}));
        if(check?.data?.status==="posted"){pendingCommitRef.current=null;setCommitUncertain(false);setDirty(false);onSaved?.();return;}
      }else{
        if(!(await saveDraft(data,step)))return;
        pendingCommitRef.current=transactionPayload({...data,version:versionRef.current || undefined,calculationVersions:stockPreview?.calculationVersions});
      }
      const posted=await runWithLoadingBackdrop(()=>fetch("/api/inventory/transactions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(pendingCommitRef.current)}).then(readApiResponse),{message:"Menyimpan transaksi dan memperbarui stok..."});
      if(posted?.data?.status!=="posted")throw new TypeError("Unverified commit");
      pendingCommitRef.current=null;setCommitUncertain(false);setDirty(false);showNotification("Transaksi tersimpan dan stok diperbarui.");onSaved?.();
    }catch(cause){
      if(cause instanceof TypeError || cause.code==="INVALID_RESPONSE"){
        try {const verified=await readApiResponse(await fetch(`/api/inventory/transactions/${data.transactionId}?${queryBase}`,{cache:"no-store"}));if(verified?.data?.status==="posted"){pendingCommitRef.current=null;setCommitUncertain(false);setDirty(false);onSaved?.();return;}}catch {}
        setCommitUncertain(true);showNotification("Status penyimpanan belum dapat diverifikasi. Periksa transaksi sebelum mencoba kembali.","error");
      }else{pendingCommitRef.current=null;setCommitUncertain(false);setErrors(cause.fieldErrors || {});showNotification(cause.message,"error");if(cause.fieldErrors?.lines)setStep(2);if(cause.code==="VERSION_CONFLICT")setStockPreview(null);}
    }finally{setBusy(false);}
  };
  const setLine=(index,patch)=>{update({lines:data.lines.map((line,n)=>n===index?{...line,...patch}:line)});setErrors((old)=>{const next={...old};for(const key of Object.keys(patch))delete next[`lines.${index}.${key}`];return next;});};
  const openSourceDetail=async()=>{
    try{
      const body=await runWithLoadingBackdrop(()=>fetch(`/api/inventory/transactions/${data.sourceTransactionId}/return-options?${queryBase}&warehouseId=${data.warehouseId}`,{cache:"no-store"}).then(readApiResponse),{message:"Memuat detail penyaluran..."});
      setReturnSource(body.data);setSourceDetailOpen(true);
    }catch(cause){showNotification(cause.message,"error");}
  };
  const loadMoreSources=async(event)=>{
    const node=event.target;
    if(node.scrollTop+node.clientHeight<node.scrollHeight-32)return;
    const page=sourcePageRef.current;
    if(!page.cursor || page.loading)return;
    page.loading=true;
    try{
      const params=new URLSearchParams({organizationId,warehouseId:String(data.warehouseId),kind:"issue",status:"active",search:debouncedSourceSearch,pageSize:"50",cursor:page.cursor});
      const body=await readApiResponse(await fetch(`/api/inventory/transactions?${params}`,{cache:"no-store"}));
      if(sourcePageRef.current.key===page.key){setSources((current)=>[...current,...body.data.data.filter((row)=>!current.some((entry)=>entry.id===row.id))]);sourcePageRef.current.cursor=body.data.nextCursor;}
    }catch(cause){showNotification(cause.message,"error");}
    finally{if(sourcePageRef.current.key===page.key)sourcePageRef.current.loading=false;}
  };
  const chooseKind=(kind)=>{setSelectedKind(kind);setErrors((old)=>({...old,kind:undefined}));};
  const fieldError=(key)=><FontStyle fontSize={11.5} sx={{color:theme.status.danger.main,mt:.5}}>{errors[key]}</FontStyle>;
  const label=(text)=><FontStyle fontSize={12} fontWeight={600} sx={{mb:.75}}>{text}</FontStyle>;
  const activeKind=kinds.find((entry)=>entry.value===data.kind);
  const modalTitle=activeKind?.label || (draftStatus==="loading"?"Memuat draft transaksi":"Tambah transaksi barang");
  const documentField=transactionDocumentField(data.kind);
  const field=(key,text,control)=><Box data-field={key} sx={{minWidth:0}}>{label(text)}{control}{errors[key]?fieldError(key):null}</Box>;
  const referenceField=documentField?field("referenceNo",documentField.label,<Box><Input aria-label={documentField.label} maxLength={100} value={data.referenceNo} onChange={(event)=>update({referenceNo:event.target.value})} placeholder={documentField.placeholder} style={{minHeight:44}}/><FontStyle explanation fontSize={12} sx={{mt:1,lineHeight:1.6}}>{documentField.description}</FontStyle></Box>):null;
  return <>
    <AppModal open title={modalTitle} description={draftId&&draftStatus!=="new"?"Lanjutkan isian transaksi. Draft tidak mengubah stok.":"Isi transaksi secara bertahap. Draft tidak mengubah stok."} icon={activeKind?.icon || "solar:clipboard-list-bold-duotone"} size="xl" onClose={requestClose} disableClose={draftStatus==="loading"||busy} contentSx={{pb:4}} footer={<Box sx={{display:{xs:"grid",sm:"flex"},gridTemplateColumns:"minmax(0,1fr)",gap:1.5,flexWrap:"wrap",justifyContent:"flex-end",alignItems:"center",width:"100%","& > .ant-btn":{width:{xs:"100%",sm:"auto"},minHeight:44}}}><Button onClick={requestClose} disabled={busy||draftStatus==="loading"}>Simpan draft & tutup</Button>{step?<Button onClick={previousStep} disabled={busy||commitUncertain}>Kembali</Button>:null}{draftStatus==="error"?<Button onClick={()=>saveDraft(data,step)}>Coba simpan lagi</Button>:null}{step<3?<Button type="primary" onClick={nextStep} disabled={busy||draftStatus==="loading"||returnPending}>Lanjut</Button>:<Button type="primary" loading={busy} disabled={!stockPreview} onClick={post}>{commitUncertain?"Periksa status penyimpanan":"Simpan transaksi"}</Button>}</Box>}>
    {commitUncertain?<AppNotice tone="warning" description="Status penyimpanan belum dapat diverifikasi. Isian dikunci sampai status transaksi diperiksa. UUID permintaan tetap sama saat mencoba kembali."/>:null}
    <Box component="fieldset" disabled={commitUncertain} sx={{display:"grid",gap:3,minWidth:0,pb:1,p:0,m:0,border:0}}>
    {data.kind==="receipt" && options?.canCorrectOpening && errors.lines ? <Box sx={{display:"flex",gap:1,flexWrap:"wrap"}}>{data.lines.filter((line)=>options.items.some((item)=>item.id===String(line.itemId) && item.opening_date && item.opening_date>data.occurredOn)).map((line)=><Button key={line.itemId} onClick={()=>setCorrectionItem(line.itemId)}>Tinjau stok awal {options.items.find((item)=>item.id===String(line.itemId))?.name}</Button>)}</Box> : null}
    <Box sx={{width:"100%",maxWidth:{xs:300,sm:"none"},mx:"auto","& .ant-steps-item-title":{fontSize:{xs:"12px !important",sm:"14px !important"},whiteSpace:"normal",textAlign:"center"}}}><Steps current={step} size="small" responsive={false} titlePlacement={mobile?"vertical":"horizontal"} items={[{title:"Jenis"},{title:"Detail"},{title:"Barang"},{title:"Periksa"}]} /></Box>
    <AppNotice role="status" tone={{new:"info",loading:"neutral",dirty:"warning",saving:"info",saved:"success",error:"danger"}[draftStatus]} title={{new:"Draft belum disimpan",loading:"Memuat draft",dirty:"Perubahan belum disimpan",saving:"Menyimpan perubahan",saved:"Draft aman tersimpan",error:"Draft belum tersimpan"}[draftStatus]} description={<>{({new:"Pilih jenis transaksi, lalu tekan Lanjut untuk menyimpan draft.",loading:"SITOU sedang memulihkan isian terakhir Anda.",dirty:"Tekan Lanjut, Kembali, atau Simpan draft & tutup untuk menyimpan perubahan.",saving:"Mohon tunggu, isian terbaru sedang diamankan ke server.",saved:"Form dapat ditutup dan dilanjutkan kembali sebelum masa draft berakhir.",error:"Periksa koneksi lalu coba simpan draft kembali. Isian Anda tetap ada di form."})[draftStatus]}{draftUpdatedAt?<Box component="span" sx={{display:"block",mt:.75}}>Terakhir disimpan: {dayjs(draftUpdatedAt).format("D MMM YYYY, HH.mm")}</Box>:null}</>} sx={version?{"& > :last-child":{width:{xs:"100%",sm:"auto"}}}:undefined} action={version?<Button danger onClick={()=>setDiscardOpen(true)} disabled={busy||draftStatus==="saving"} style={{minHeight:44,width:mobile?"100%":undefined}}>Buang draft & mulai ulang</Button>:null}/>
    <Box sx={{display:"grid",gap:3,minWidth:0}}>
      {step===0?<Box sx={{display:"grid",gap:2.5}}>
        <Box data-field="kind"><FontStyle fontSize={12} fontWeight={600} sx={{mb:1}}>Silakan pilih jenis transaksi</FontStyle><Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"repeat(2,minmax(0,1fr))"},gap:1.5}}>{kinds.filter((kind)=>kind.value!=="opening" || options?.canInitializeOpening || selectedKind==="opening").map((kind)=>{const tone=transactionTone(theme,kind.tone);return <Paper key={kind.value} component="button" type="button" onClick={()=>chooseKind(kind.value)} aria-pressed={selectedKind===kind.value} variant="outlined" sx={{display:"flex",textAlign:"left",gap:1.5,p:2,cursor:"pointer",borderRadius:2,borderColor:selectedKind===kind.value?tone.main:theme.ui.border,bgcolor:selectedKind===kind.value?tone.background:theme.ui.panelBg,"&:focus-visible":{outline:`2px solid ${tone.main}`}}}><AppIconTile icon={kind.icon} tone={kind.tone} size={36} iconSize={21} showBorder/><Box><FontStyle fontSize={14} fontWeight={700}>{kind.label}</FontStyle><FontStyle explanation fontSize={11.5} sx={{mt:.5}}>{kind.description}</FontStyle></Box></Paper>})}</Box>{errors.kind?fieldError("kind"):null}</Box>
      </Box>:null}
      {step===1?<Box sx={{display:"grid",gap:2.5}}>
        <AppNotice title={kinds.find((entry)=>entry.value===data.kind)?.label || "Detail transaksi"} description={data.kind==="opening"?"Pilih gudang dan tanggal acuan stok sebelum pencatatan dimulai. Tidak perlu mengetahui kapan barang lama pertama kali diterima.":"Pilih gudang dan tanggal saat barang diterima, dikeluarkan, dikembalikan, atau dihitung. Tanggal ini menjadi tanggal transaksi pada riwayat."} compact/>
        <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"1fr 1fr"},gap:2}}>
          {field("warehouseId","Gudang *",<AsyncSelect value={data.warehouseId ? String(data.warehouseId):undefined} onChange={(value)=>{optionsRequestRef.current++;setOptions((current)=>current?{...current,items:[]}:current);setSources([]);setSourceListError("");setReturnSource(null);setReturnLoading(false);setReturnError("");update({warehouseId:Number(value),sourceTransactionId:null,lines:[],openingCorrections:[]});}} options={(options?.warehouses || []).map((entry)=>({value:entry.id,label:entry.name}))} placeholder="Pilih gudang" style={{width:"100%",minHeight:44}} status={errors.warehouseId?"error":undefined}/>)}
          {field("occurredOn",data.kind==="return"?"Tanggal barang diterima kembali *":"Tanggal transaksi *",<DatePicker value={data.occurredOn?dayjs(data.occurredOn):null} onChange={(value)=>update({occurredOn:value?.format("YYYY-MM-DD") || ""})} disabledDate={(date)=>date.isAfter(dayjs(options?.today),"day")||date.isBefore(dayjs(options?.today).subtract(30,"day"),"day")} format="DD MMM YYYY" placeholder="Pilih tanggal" style={{width:"100%",minHeight:44}} status={errors.occurredOn?"error":undefined}/>)}
        </Box>
        {data.kind==="return"?<AppNotice title="Tanggal pengembalian" description="Tanggal ini menunjukkan kapan barang benar-benar diterima kembali di gudang. Bawaan hari ini; ubah hanya jika barang kembali pada tanggal lain." compact/>:null}
        {requiresLateReason(data.kind,data.occurredOn,options?.today)?field("lateReason",data.kind==="return"?"Alasan pengembalian baru dimasukkan *":"Alasan input terlambat *",<Input.TextArea rows={2} maxLength={500} value={data.lateReason} onChange={(event)=>update({lateReason:event.target.value})} placeholder="Mengapa baru disimpan sekarang?" status={errors.lateReason?"error":undefined}/>):null}
        {data.kind==="return"?<Box sx={{display:"grid",gridTemplateColumns:{xs:"minmax(0,1fr)",sm:"repeat(2,minmax(0,1fr))"},gap:2}}>{field("sourceTransactionId","Transaksi penyaluran sebelumnya *",<Box>
          <AsyncSelect filterOption={false} onPopupScroll={loadMoreSources} onSearch={setSourceSearch} value={data.sourceTransactionId || undefined} onChange={(value)=>{setReturnSource(null);setReturnLoading(true);setReturnError("");update({sourceTransactionId:value,lines:[]});}} options={sources.map((row)=>({value:row.id,label:sourceTransactionLabel(row,dayjs(row.occurred_on).format("D MMM YYYY"))}))} placeholder={data.warehouseId ? "Cari nomor dokumen atau nama barang" : "Pilih gudang dahulu"} disabled={!data.warehouseId || busy} loading={returnPending || (!!data.warehouseId && sourceLoadedKey!==sourceQueryKey)} notFoundContent={sourceLoadedKey!==sourceQueryKey?"Memuat daftar penyaluran...":sourceListError?"Daftar penyaluran belum dapat dimuat.":"Tidak ada penyaluran sesuai pencarian di gudang ini."} style={{width:"100%",minHeight:44}}/>

          {sourceListError?<Box sx={{mt:1}}><FontStyle role="alert" fontSize={12} sx={{color:"error.main"}}>{sourceListError}</FontStyle><Button onClick={()=>setSourceReload((value)=>value+1)} style={{minHeight:44}}>Muat ulang daftar penyaluran</Button></Box>:null}
          {returnError?<FontStyle role="alert" fontSize={12} sx={{mt:1,color:"error.main"}}>{returnError}</FontStyle>:null}
        </Box>)}
{data.sourceTransactionId?<Box sx={{pt:{xs:0,sm:2.5}}}><RelatedRecordAction title="Penyaluran yang dipilih" description="Periksa tujuan, penerima, dan rincian barang sebelum melanjutkan." label="Lihat detail transaksi" onClick={openSourceDetail} loading={returnPending} disabled={returnPending || !!returnError || busy}/></Box>:null}
</Box>:null}
        {!documentField && data.referenceNo?<AppNotice title="Nomor referensi tersimpan" description={data.referenceNo} compact/>:null}
        {data.kind==="issue"?<><AppNotice title="Tujuan penyaluran" description="Satu lokasi, Divisi & Unit, dan pegawai penerima berlaku untuk semua barang dalam transaksi ini." compact/><Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"1fr 1fr"},gap:2}}>
          {field("destinationLocationId","Lokasi tujuan *",<AsyncSelect value={data.destinationLocationId?String(data.destinationLocationId):undefined} onChange={(value)=>update({destinationLocationId:Number(value),destinationUnitId:null,recipientEmployeeId:null})} options={(options?.locations || []).map((row)=>({value:row.id,label:row.name}))} placeholder="Pilih lokasi" style={{width:"100%",minHeight:44}}/>)}
          {field("destinationUnitId","Divisi & Unit tujuan *",<AsyncSelect value={data.destinationUnitId?String(data.destinationUnitId):undefined} onChange={(value)=>update({destinationUnitId:Number(value),recipientEmployeeId:null})} options={(options?.units || []).filter((row)=>row.location_id===String(data.destinationLocationId)).map((row)=>({value:row.id,label:row.name}))} placeholder="Pilih Divisi & Unit" disabled={!data.destinationLocationId} style={{width:"100%",minHeight:44}}/>)}
          {field("recipientEmployeeId","Pegawai penerima *",<AsyncSelect value={data.recipientEmployeeId?String(data.recipientEmployeeId):undefined} onChange={(value)=>update({recipientEmployeeId:Number(value)})} options={recipients.map((row)=>({value:row.id,label:`${row.full_name} · ${row.employee_no}`}))} placeholder="Pilih pegawai" disabled={!data.destinationUnitId||!data.occurredOn} style={{width:"100%",minHeight:44}}/>)}
          {referenceField}
        </Box></>:null}
        {data.kind==="receipt"?<Box sx={{display:"grid",gridTemplateColumns:{xs:"minmax(0,1fr)",sm:"repeat(2,minmax(0,1fr))"},gap:2}}>{referenceField}</Box>:null}

        {data.kind==="receipt"||data.kind==="issue"?<Box sx={{display:"grid",gap:3,mb:1}}>
          {data.kind==="receipt"?<Box>{label("Bukti pembelian (gambar, opsional)")}<PrivateFileUpload value={files.purchaseProof} organizationId={organizationId} uploadUrl={`/api/inventory/transactions/${data.transactionId}/draft-files`} fields={{purpose:"purchase_proof"}} onChange={(value)=>uploadDraftFile("purchaseProof","purchase_proof",value)} onRemoveRequest={({file})=>removeDraftFile("purchaseProof",file)} disabled={!version} onError={(message)=>showNotification(message,"error")} backdropMessages={{upload:"Mengunggah bukti pembelian...",remove:"Menghapus bukti pembelian..."}} accept="image/jpeg,image/png,image/webp" maxSizeBytes={5*1024*1024} emptyTitle="Pilih gambar bukti pembelian" helpText="JPEG, PNG, atau WebP; maksimal 5 MB. File tetap privat."/></Box>:null}
          {data.kind==="issue"?<Box sx={{display:"grid",gap:4,minWidth:0}}><Box>{label("Dokumen permintaan (PDF, opsional)")}<PrivateFileUpload value={files.requestDocument} organizationId={organizationId} uploadUrl={`/api/inventory/transactions/${data.transactionId}/draft-files`} fields={{purpose:"request_document"}} onChange={(value)=>uploadDraftFile("requestDocument","request_document",value)} onRemoveRequest={({file})=>removeDraftFile("requestDocument",file)} disabled={!version} onError={(message)=>showNotification(message,"error")} backdropMessages={{upload:"Mengunggah dokumen permintaan...",remove:"Menghapus dokumen permintaan..."}} accept=".pdf,application/pdf" maxSizeBytes={10*1024*1024} emptyTitle="Pilih dokumen permintaan PDF" helpText="Maksimal 10 MB. File tetap privat."/></Box><Box sx={{mt:3,pt:1}}>{label("Foto serah terima (opsional)")}<PrivateFileUpload value={files.handoverPhoto} organizationId={organizationId} uploadUrl={`/api/inventory/transactions/${data.transactionId}/draft-files`} fields={{purpose:"handover_photo"}} onChange={(value)=>uploadDraftFile("handoverPhoto","handover_photo",value)} onRemoveRequest={({file})=>removeDraftFile("handoverPhoto",file)} disabled={!version} onError={(message)=>showNotification(message,"error")} backdropMessages={{upload:"Mengunggah foto serah terima...",remove:"Menghapus foto serah terima..."}} accept="image/jpeg,image/png,image/webp" maxSizeBytes={5*1024*1024} emptyTitle="Pilih foto serah terima" helpText="JPEG, PNG, atau WebP; maksimal 5 MB."/></Box></Box>:null}
        </Box>:null}
        <Box sx={{pt:data.kind==="receipt"||data.kind==="issue"?3:0}}>
          {field("notes","Catatan (opsional)",<Input.TextArea rows={2} maxLength={2000} value={data.notes} onChange={(event)=>update({notes:event.target.value})} placeholder="Keterangan tambahan untuk riwayat transaksi"/>)}
        </Box>
      </Box>:null}
      {step===2?<Box sx={{display:"grid",gap:2}}>
        <AppNotice title={data.kind==="opening"?"Masukkan hasil hitung awal":"Jumlah akan mengubah stok saat transaksi disimpan"} description={data.kind==="opening"?"Isi 0 jika barang sudah dihitung tetapi gudang kosong. Stok awal tidak dapat diedit setelah disimpan.":"Periksa jumlah per barang. Draft tidak mengubah stok."}/>
        {data.kind!=="return"&&!available.length?<AppNotice tone="warning" title="Belum ada barang yang dapat dipilih" description={data.kind==="opening"?"Daftarkan barang aktif di gudang melalui Data Master → Barang Persediaan.":"Masukkan stok awal atau periksa pengaturan barang di gudang ini."}/>:null}
        {data.kind!=="return"?data.lines.map((line,index)=>{const item=options?.items.find((entry)=>entry.id===String(line.itemId));return <Paper key={index} variant="outlined" sx={{p:2,borderRadius:2,display:"grid",gridTemplateColumns:{xs:"1fr auto",sm:"minmax(0,1fr) 160px auto"},gap:1.5,alignItems:"start"}}>
          <Box data-field={`lines.${index}.itemId`} sx={{minWidth:0}}>{label(`Barang ${index+1}`)}<Box sx={{display:"flex",gap:1.25,alignItems:"center"}}><InventoryItemPhoto item={item} organizationId={organizationId} onPreview={setPhotoPreview}/><AsyncSelect filterOption={false} onSearch={setItemSearch} value={line.itemId?String(line.itemId):undefined} onChange={(value)=>{setLine(index,{itemId:Number(value),quantity:Number(value)===line.itemId?line.quantity:null});setItemSearch("");}} options={available.filter((entry)=>entry.id===String(line.itemId)||!data.lines.some((other)=>String(other.itemId)===entry.id)).map((entry)=>({value:entry.id,label:`${entry.name} · ${entry.unit_name}`}))} placeholder="Cari nama atau kode barang" style={{width:"100%",minWidth:0,minHeight:44}}/></Box>{item?<Box sx={{mt:1.5}}><InventoryQuantityChip label={`${["receipt","issue","stocktake"].includes(data.kind)?"Stok gudang saat ini":"Satuan"}: ${["receipt","issue","stocktake"].includes(data.kind)?(item.has_history?amount(item.balance)+" ":"Belum ada transaksi · "):""}${item.unit_name}`} tone="info" sx={{fontSize:13,fontWeight:700}}/></Box>:null}{errors[`lines.${index}.itemId`]?fieldError(`lines.${index}.itemId`):null}</Box>
          <Box data-field={`lines.${index}.quantity`} sx={{gridColumn:{xs:"1",sm:"auto"}}}>{label(data.kind==="stocktake"?"Hasil hitung *":data.kind==="opening"?"Stok awal *":"Jumlah *")}<InputNumber disabled={!item || busy} placeholder={item ? undefined : "Pilih barang dahulu"} min={0} max={999999999999} precision={item?.allows_fractional?undefined:0} value={line.quantity} onChange={(value)=>setLine(index,{quantity:value})} style={{width:"100%",minHeight:44}} status={errors[`lines.${index}.quantity`]?"error":undefined}/>{errors[`lines.${index}.quantity`]?fieldError(`lines.${index}.quantity`):null}</Box>
          <Button danger type="text" icon={<AppIcon icon="solar:trash-bin-trash-linear" width={18}/>} aria-label={`Hapus barang ${index+1}`} onClick={()=>update({lines:data.lines.filter((_,n)=>n!==index)})} style={{minHeight:44,minWidth:44,marginTop:24}}/>
        </Paper>}):null}
        {data.kind==="return"?<Box sx={{display:"grid",gap:2,minWidth:0}}>
          <AppNotice title="Barang yang dikembalikan" description="Barang berasal dari penyaluran yang dipilih. Jumlah awal berisi sisa yang masih dapat dikembalikan. Sesuaikan dengan barang yang kembali; isi 0 jika tidak dikembalikan."/>
          {returnPending?<AppNotice description="Memuat barang dan batas pengembalian..."/>:returnError?<AppNotice tone="danger" description={returnError}/>:null}
          {(returnSource?.lines || []).map((original,index)=>{
            const line=data.lines.find((entry)=>String(entry.itemId)===original.itemId);
            const lineIndex=data.lines.findIndex((entry)=>String(entry.itemId)===original.itemId);
            return <Paper key={original.itemId} variant="outlined" sx={{p:2,borderRadius:2,display:"grid",gridTemplateColumns:{xs:"minmax(0,1fr)",sm:"minmax(0,1fr) 180px"},gap:2,minWidth:0}}>
              <Box sx={{display:"grid",gap:1.5,minWidth:0}}><Box sx={{display:"flex",alignItems:"center",gap:1.5}}><InventoryItemPhoto item={original} organizationId={organizationId} onPreview={setPhotoPreview}/><FontStyle fontWeight={700} sx={{overflowWrap:"anywhere"}}>{original.name}</FontStyle></Box>
                <Box sx={{display:"flex",gap:1,flexWrap:"wrap"}}><InventoryQuantityChip label={`Disalurkan: ${amount(original.quantity)} ${original.unit}`} tone="neutral"/><InventoryQuantityChip label={`Sudah kembali: ${amount(original.returnedQuantity)} ${original.unit}`} tone="neutral"/><InventoryQuantityChip label={`Maksimal kembali: ${amount(original.remainingQuantity)} ${original.unit}`} tone="info"/></Box>
                {!original.canReturn?<FontStyle explanation fontSize={12}>{Number(original.remainingQuantity)===0?"Seluruh jumlah sudah dikembalikan.":"Barang atau pengaturan gudang nonaktif. Hubungi Pengelola Master Inventaris sebelum memproses pengembalian."}</FontStyle>:null}
              </Box>
              <Box data-field={`lines.${lineIndex}.quantity`}><FontStyle fontSize={12} fontWeight={600} sx={{mb:1}}>Jumlah ({original.unit})</FontStyle><InputNumber aria-label={`Jumlah ${original.name}`} min={0} max={Number(original.remainingQuantity)} precision={original.allows_fractional?undefined:0} disabled={!original.canReturn || returnPending || busy || lineIndex<0} value={line?.quantity ?? 0} onChange={(value)=>{if(lineIndex>=0)setLine(lineIndex,{quantity:value ?? 0});}} style={{width:"100%",minHeight:44}} status={errors[`lines.${lineIndex}.quantity`]?"error":undefined}/>{errors[`lines.${lineIndex}.quantity`]?fieldError(`lines.${lineIndex}.quantity`):null}</Box>
            </Paper>;
          })}
        </Box>:null}
        {errors.lines?fieldError("lines"):null}
        {data.kind!=="return"?<Button icon={<AppIcon icon="solar:add-circle-linear" width={18}/>} disabled={!available.length||data.lines.length>=100} onClick={()=>update({lines:[...data.lines,{itemId:null,quantity:null}]})} style={{minHeight:44,justifySelf:"start"}}>Tambah barang</Button>:null}
      </Box>:null}
      {step===3?<Box sx={{display:"grid",gap:2}}>
        <AppNotice tone="warning" title="Periksa sebelum menyimpan" description="Transaksi yang telah disimpan tidak dapat diedit atau dihapus. Jika ada kesalahan, buat pembatalan beralasan atau stok opname."/>
        <Box sx={{display:"grid",gridTemplateColumns:{xs:"minmax(0,1fr)",sm:"repeat(2,minmax(0,1fr))"},gap:2}}>{[
          ["Jenis",kinds.find((entry)=>entry.value===data.kind)?.label],["Gudang",warehouse?.name],
          [data.kind==="return"?"Tanggal pengembalian ke gudang":"Tanggal transaksi",data.occurredOn?dayjs(data.occurredOn).format("D MMM YYYY"):"—"],
          ["Barang",`${data.kind==="return"?selected.length:data.lines.length} jenis`],...(data.referenceNo?[[transactionReferenceLabel(data.kind),data.referenceNo]]:[]),
          ...(data.kind==="issue"?[["Pegawai penerima",recipients.find((entry)=>entry.id===String(data.recipientEmployeeId))?.full_name || "—"]]:[]),
          ...(data.kind==="return"&&returnSource?[
            ["Tanggal penyaluran sebelumnya",dayjs(returnSource.occurred_on).format("D MMM YYYY")],
            ["Lokasi penyaluran",returnSource.destination_location_name || "Tidak tersedia"],
            ["Divisi & Unit penyaluran",returnSource.destination_unit_name || "Tidak tersedia"],
            ["Penerima penyaluran",returnSource.recipient_name || "Tidak tersedia"],
          ]:[]),
        ].map(([name,value])=><Box key={name}><FontStyle fontSize={12} sx={{color:"text.secondary"}}>{name}</FontStyle><FontStyle fontSize={14} fontWeight={600} sx={{overflowWrap:"anywhere"}}>{value}</FontStyle></Box>)}</Box>
        {stockPreview?.occurredOn!==stockPreview?.asOf?<AppNotice tone="info" title="Transaksi bertanggal sebelumnya" description={data.kind==="opening"?`Stok awal berlaku mulai ${dayjs(data.occurredOn).format("D MMM YYYY")}. Stok saat ini juga mencakup transaksi setelah tanggal itu.`:`Angka Sebelum dan Sesudah berlaku pada ${dayjs(data.occurredOn).format("D MMM YYYY")}. Saat ini juga mencakup transaksi setelah tanggal itu.`} compact/>:null}
        <Box component="section" aria-label={reviewTitles[data.kind] || "Rincian barang"} sx={{display:"grid",gap:1.5,minWidth:0}}>
        <FontStyle component="h2" fontSize={15} fontWeight={700}>{reviewTitles[data.kind] || "Rincian barang"}</FontStyle>
        <Box component="ul" sx={{m:0,p:0,listStyle:"none",display:"grid",gridTemplateColumns:{xs:"minmax(0,1fr)",md:selected.length===1?"minmax(0,600px)":"repeat(2,minmax(0,1fr))"},justifyContent:"start",gap:2,alignItems:"stretch"}}>{selected.map((line,index)=>{
          const projection=stockPreview?.lines.find((entry)=>entry.itemId===String(line.itemId));
          const label=data.kind==="issue"?"Jumlah keluar":data.kind==="receipt"?"Jumlah masuk":data.kind==="return"?"Jumlah dikembalikan":data.kind==="opening"?"Stok awal":"Hasil hitung fisik";
          return <InventoryItemCard component="li" compact showAttributes key={line.itemId || index}
            item={line.item} organizationId={organizationId}
            onPreview={(item,url)=>setPhotoPreview({url,name:item.name})}>
            <Box sx={{display:"grid",gap:1.5}}>
              {projection?<Box role="group" aria-label={data.kind==="opening"?"Stok gudang":"Perubahan stok gudang"} sx={{display:"grid",gap:2,p:2,borderRadius:2,bgcolor:theme.ui.panelSubtleBg,border:`1px solid ${theme.ui.panelBorderSubtle}`}}>
                <FontStyle fontSize={11.5} fontWeight={700}>{data.kind==="opening"?"Stok gudang":"Perubahan stok gudang"}</FontStyle>
                {data.kind!=="opening"?<InventoryStockMetric label={label} value={amount(line.quantity)}
                  unit={line.item?.unit_name || line.item?.unit || projection.unit}
                  icon={activeKind?.icon || "solar:box-bold-duotone"}
                  tone={activeKind?.tone || "info"}/>:null}
                {data.kind!=="opening"?<Divider sx={{borderColor:theme.ui.panelBorderSubtle}}/>:null}
                <Box sx={{display:"grid",gridTemplateColumns:{xs:"minmax(0,1fr)",sm:"repeat(2,minmax(0,1fr))"},gap:1.5}}>
                {data.kind==="opening"?<InventoryStockMetric label="Stok awal" value={amount(line.quantity)}
                  unit={line.item?.unit_name || line.item?.unit || projection.unit}
                  icon={activeKind?.icon || "solar:box-bold-duotone"} tone="info"/>:<>
                  <InventoryStockMetric label="Sebelum" value={amount(projection.beforeDate)} unit={projection.unit} icon="solar:history-bold-duotone" tone="neutral"/>
                  <InventoryStockMetric label="Sesudah" value={amount(projection.afterDate)} unit={projection.unit} icon="solar:check-read-bold-duotone" tone={Number(projection.afterDate)<=0?"danger":"info"}/>
                </>}
                {stockPreview.occurredOn!==stockPreview.asOf?<Box sx={{gridColumn:{xs:"auto",sm:data.kind==="opening"?"auto":"1 / -1"},pt:data.kind==="opening"?0:1.5,borderTop:data.kind==="opening"?"none":`1px solid ${theme.ui.panelBorderSubtle}`}}>
                  <InventoryStockMetric label="Stok saat ini" value={amount(projection.currentAfter)} unit={projection.unit} icon="inventory:warehouse" tone="brand"/>
                </Box>:null}
                </Box>
              </Box>:<AppNotice tone="warning" description="Perkiraan stok belum tersedia. Kembali ke tahap Barang lalu tekan Lanjut untuk memeriksa." compact/>}
            </Box>
          </InventoryItemCard>;
        })}</Box>
        </Box>
        <FontStyle explanation fontSize={12} sx={{color:"text.secondary"}}>Angka dihitung dari stok terbaru. Sistem memeriksa kembali stok saat transaksi disimpan.</FontStyle>
        {data.lateReason?<AppNotice title={requiresLateReason(data.kind,data.occurredOn,options?.today)?"Alasan input terlambat":"Keterangan tersimpan"} description={data.lateReason} compact/>:null}
        {Object.values(files).some(Boolean)?<AppNotice title="Lampiran draft" description="Lampiran yang sudah tersimpan privat akan dihubungkan ke transaksi saat transaksi disimpan." compact/>:null}
      </Box>:null}
      </Box>
    </Box>
    </AppModal>
    <ConfirmDialog open={discardOpen} title="Buang draft dan mulai ulang?" message="Seluruh isian dan lampiran pada draft ini akan dibuang. Stok gudang tidak berubah." danger confirmText="Buang draft" loading={busy} onClose={()=>setDiscardOpen(false)} onConfirm={discardAndRestart}/>
    <ConfirmDialog open={!!pendingKind} title="Ganti jenis transaksi?" message="Isian dan lampiran jenis transaksi sebelumnya akan dikosongkan. Stok gudang belum berubah." danger confirmText="Ganti jenis" loading={busy} fullWidthMobile onClose={()=>setPendingKind(null)} onConfirm={applySelectedKind}/>
    <Notification {...notification} onClose={closeNotification}/>
    {sourceDetailOpen && returnSource ? <TransactionSourceDetailModal source={returnSource} organizationId={organizationId} onClose={()=>setSourceDetailOpen(false)}/> : null}
    {correctionItem ? <OpeningCorrectionModal organizationId={organizationId} warehouseId={data.warehouseId} itemId={correctionItem} pendingData={data} onClose={()=>setCorrectionItem(null)} onApplied={(correction)=>{update({openingCorrections:[...(data.openingCorrections||[]).filter((c)=>String(c.itemId)!==String(correction.itemId)),correction]});setCorrectionItem(null);setStockPreview(null);setErrors({});showNotification("Koreksi disiapkan. Periksa penerimaan sebelum menyimpan.","info");}}/> : null}
    <ImagePreviewModal open={!!photoPreview} onClose={()=>setPhotoPreview(null)} imageUrl={photoPreview?.url} title={photoPreview?.name || "Foto barang"} alt={`Foto ${photoPreview?.name || "barang"}`}/>
  </>;
}
