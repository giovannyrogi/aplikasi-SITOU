"use client";
import ActorIdentity from "@/app/components/data-display/ActorIdentity";
import { inventoryActorPhotoUrl } from "@/lib/identity/actorPresentation.mjs";
import {useEffect,useState} from "react";
import {Button,DatePicker,Input,Tooltip} from "antd";
import {Box} from "@mui/material";
import dayjs from "dayjs";
import PageHeader from "@/app/components/layout/PageHeader";
import OperationalFilterSection from "@/app/components/filters/OperationalFilterSection";
import DataPanel from "@/app/components/data-display/DataPanel";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import DataPagination from "@/app/components/data-display/DataPagination";
import AppNotice from "@/app/components/data-display/AppNotice";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import DashboardMetric from "@/app/components/dashboard/DashboardMetric";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import AppIcon from "@/app/components/icons/AppIcon";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import Notification from "@/app/components/Notifications/Notification";
import useAppNotification from "@/app/hooks/useAppNotification";
import {useLoadingBackdrop} from "@/app/components/loading/LoadingBackdropProvider";
import {readApiResponse,normalizeRequestError} from "@/lib/api/clientError";
import InventoryItemPhoto from "./InventoryItemPhoto";
import InventoryQuantityChip from "./InventoryQuantityChip";
import TransactionDetailModal from "./TransactionDetailModal";
const initial={from:"",to:"",warehouseId:"",itemId:"",locationId:"",unitId:"",recipientId:"",search:"",status:"effective",view:"details"};
const amount=(v)=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:3}).format(Number(v));
/** Abort/filter keys prevent older requests overwriting newer report or organization selections. */
export default function DistributionPanel({organizationId,organizationFilter,initialWarehouseId}) {
  const [filters,setFilters]=useState(()=>({...initial,warehouseId:initialWarehouseId || ""})),[search,setSearch]=useState(""),[options,setOptions]=useState(null),[optionsError,setOptionsError]=useState(""),[reload,setReload]=useState(0);
  const [pageSize,setPageSize]=useState(20),[page,setPage]=useState({key:"",tokens:[null],index:0});
  const [state,setState]=useState({key:"",data:null,error:""}),[detail,setDetail]=useState(null),[preview,setPreview]=useState(null);
  const {notification,showNotification,closeNotification}=useAppNotification();const {runWithLoadingBackdrop}=useLoadingBackdrop();
  useEffect(()=>{const timer=setTimeout(()=>setSearch(filters.search.trim()),300);return()=>clearTimeout(timer);},[filters.search]);
  useEffect(()=>{if(!organizationId)return;const controller=new AbortController();fetch(`/api/inventory/distribution?organizationId=${organizationId}&options=1`,{signal:controller.signal,cache:"no-store"}).then(readApiResponse).then((body)=>{if(!controller.signal.aborted){setOptions(body.data);setOptionsError("");}}).catch((error)=>{if(!controller.signal.aborted)setOptionsError(normalizeRequestError(error).message);});return()=>controller.abort();},[organizationId,reload]);
  const resolved={...filters,organizationId,search,from:filters.from||options?.from,to:filters.to||options?.to,pageSize};
  const signature=JSON.stringify(resolved),current=page.key===signature?page:{key:signature,tokens:[null],index:0},cursor=current.tokens[current.index];
  const requestKey=`${signature}:${cursor||""}:${reload}`;
  const invalid=resolved.from&&resolved.to&&resolved.from>resolved.to;
  useEffect(()=>{if(!organizationId||!options||invalid)return;const controller=new AbortController(),values=JSON.parse(signature);
    const query=new URLSearchParams(Object.entries(values).filter(([,v])=>v!==""&&v!=null));if(cursor)query.set("cursor",cursor);
    fetch(`/api/inventory/distribution?${query}`,{signal:controller.signal,cache:"no-store"}).then(readApiResponse).then((body)=>{if(!controller.signal.aborted)setState({key:requestKey,data:body.data,error:""});}).catch((error)=>{if(!controller.signal.aborted)setState({key:requestKey,data:null,error:normalizeRequestError(error).message});});return()=>controller.abort();
  },[organizationId,options,signature,cursor,requestKey,invalid]);
  const loading=!!organizationId&&!invalid&&!optionsError&&state.key!==requestKey,data=state.key===requestKey?state.data:null;
  const change=(key,value)=>setFilters((old)=>({...old,[key]:value||""}));
  const select=(key,choices,placeholder)=><AsyncSelect aria-label={placeholder} allowClear={!["view","status"].includes(key)} value={filters[key]||undefined} onChange={(v)=>change(key,v)} options={choices} placeholder={placeholder} style={{width:"100%",minHeight:44}}/>;
  const openDetail=async(row)=>{try{const body=await runWithLoadingBackdrop(()=>fetch(`/api/inventory/transactions/${row.transaction_id}?organizationId=${organizationId}`,{cache:"no-store"}).then(readApiResponse),{message:"Membuka rincian penyaluran..."});setDetail(body.data);}catch(error){showNotification(normalizeRequestError(error).message,"error");}};
  const exportExcel=async()=>{try{const values={...resolved};delete values.pageSize;const query=new URLSearchParams(Object.entries(values).filter(([,v])=>v!==""&&v!=null));query.set("export","xlsx");
    const response=await fetch(`/api/inventory/distribution?${query}`,{cache:"no-store"});if(!response.ok){await readApiResponse(response);return;}
    const url=URL.createObjectURL(await response.blob()),link=document.createElement("a");link.href=url;link.download=`sitou-distribusi-${(data?.organization.code||String(organizationId)).replace(/[^a-zA-Z0-9_-]/g,"_")}-${resolved.from}-${resolved.to}.xlsx`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);showNotification("Laporan distribusi berhasil diunduh.");
  }catch(error){showNotification(normalizeRequestError(error).message,"error");}};
  const identity=(row)=><Box sx={{display:"flex",gap:1.5,alignItems:"center",minWidth:0}}><InventoryItemPhoto item={{name:row.item_name,photo_file_id:row.photo_file_id}} organizationId={organizationId} onPreview={setPreview}/><Box sx={{minWidth:0}}><FontStyle fontWeight={600}>{row.item_name}</FontStyle><FontStyle fontSize={12}>{row.item_code} · {row.unit_name}</FontStyle>{row.cancelled_on?<CompactInfoChip label="Dibatalkan" tone="warning"/>:null}</Box></Box>;
  const action=(row)=>filters.view==="summary"?<Button onClick={()=>setFilters((old)=>({...old,view:"details",warehouseId:row.warehouse_id,itemId:row.item_id,locationId:row.location_id==="0"?"":row.location_id,unitId:row.unit_id==="0"?"":row.unit_id}))} style={{minHeight:44}}>Lihat penyaluran</Button>:row.canReadTransaction?<Tooltip title="Lihat detail penyaluran"><Button aria-label={`Lihat detail penyaluran ${row.item_name}`} icon={<AppIcon icon="solar:eye-linear" width={18}/>} onClick={()=>openDetail(row)} style={{minWidth:44,minHeight:44}}/></Tooltip>:null;
  const qty=(row,key)=>`${amount(row[key])} ${row.unit_name}`;
  const columns=[...(filters.view==="details"?[{key:"date",title:"Tanggal",dataIndex:"occurred_on",render:(v)=>dayjs(v).format("D MMM YYYY"),width:135}]:[]),
    {key:"item",title:"Barang",render:(_,r)=>identity(r),width:245},{key:"warehouse",title:"Gudang asal",dataIndex:"warehouse_name",width:185},
    {key:"destination",title:"Tujuan",render:(_,r)=><Box><FontStyle>{r.location_name||"Tidak tersedia"}</FontStyle><FontStyle fontSize={12}>{r.destination_unit_name||"Tidak tersedia"}</FontStyle></Box>,width:230},
    ...(filters.view==="details"?[{key:"recipient",title:"Penerima",render:(_,r)=><Box><FontStyle>{r.recipient_name||"Tidak tersedia"}</FontStyle>{r.reference_no?<FontStyle fontSize={12}>Memo: {r.reference_no}</FontStyle>:null}</Box>,width:225}]:[{key:"count",title:"Transaksi",dataIndex:"transaction_count",width:100}]),
    ...["distributed_quantity","returned_quantity","net_quantity"].map((key,i)=>({key,title:["Jumlah disalurkan","Dikembalikan","Belum dikembalikan"][i],align:"right",render:(_,r)=>qty(r,key),width:160})),
    ...(filters.view==="details"?[{key:"actor",title:"Disimpan oleh",width:200,render:(_,row)=><ActorIdentity position={row.actor_position_name} name={row.actor_name} photoUrl={inventoryActorPhotoUrl(row.actor_photo_file_id,organizationId,row.transaction_id,"distribution")}/>}]:[]),
    {key:"action",title:"Aksi",render:(_,r)=>action(r),width:filters.view==="summary"?175:80}];
  return <Box sx={{display:"grid",gap:3,minWidth:0}}>
    <PageHeader title="Distribusi Barang" description="Telusuri penyaluran barang dari gudang kepada lokasi, Divisi & Unit, dan Pegawai penerima."/>
    {!organizationId?<AppNotice title="Pilih organisasi" description="Pilih organisasi untuk membaca laporan distribusi."/>:null}
    <OperationalFilterSection title="Filter distribusi" onReset={()=>setFilters(initial)} items={[
      ...(organizationFilter?[{key:"org",label:"Organisasi",control:organizationFilter}]:[]),
      ...[["from","Dari tanggal"],["to","Sampai tanggal"]].map(([key,label])=>({key,label,control:<DatePicker aria-label={label} format="DD MMM YYYY" value={resolved[key]?dayjs(resolved[key]):null} onChange={(v)=>change(key,v?.format("YYYY-MM-DD"))} style={{width:"100%",minHeight:44}}/>})),
      {key:"warehouse",label:"Gudang asal",control:select("warehouseId",options?.warehouses||[],"Semua gudang")},
      {key:"item",label:"Barang",control:select("itemId",options?.items||[],"Semua barang")},
      {key:"location",label:"Lokasi tujuan",control:select("locationId",options?.locations||[],"Semua lokasi tujuan")},
      {key:"unit",label:"Divisi & Unit tujuan",control:select("unitId",options?.units||[],"Semua Divisi & Unit tujuan")},
      {key:"recipient",label:"Pegawai penerima",control:select("recipientId",options?.recipients||[],"Semua Pegawai penerima")},
      {key:"search",label:"Barang atau nomor memo",control:<Input aria-label="Cari distribusi" value={filters.search} onChange={(e)=>change("search",e.target.value)} placeholder="Nama, kode barang, penerima, atau nomor memo"/>},
      {key:"status",label:"Status penyaluran",control:select("status",[{value:"effective",label:"Tidak dibatalkan"},{value:"cancelled",label:"Dibatalkan"},{value:"all",label:"Semua status"}],"Status penyaluran")},
      {key:"view",label:"Tampilan",control:select("view",[{value:"details",label:"Rincian penyaluran"},{value:"summary",label:"Rekap barang dan tujuan"}],"Tampilan laporan")},
    ]}/>
    {optionsError?<AppNotice tone="danger" title="Pilihan filter belum dapat dimuat" description={optionsError} action={<Button onClick={()=>setReload((n)=>n+1)}>Muat ulang</Button>}/>:null}
    {invalid?<AppNotice tone="danger" title="Periode tidak valid" description="Tanggal akhir tidak boleh sebelum tanggal awal."/>:null}
    {organizationId&&!invalid?<>
      {loading||data?<Box sx={{display:"grid",gridTemplateColumns:{xs:"minmax(0,1fr)",sm:"repeat(2,minmax(0,1fr))",lg:"repeat(4,minmax(0,1fr))"},gap:2}}>
        {[["transactions","Transaksi penyaluran","solar:clipboard-list-bold-duotone"],["items","Jenis barang","solar:box-bold-duotone"],["destinations","Lokasi/unit tujuan","solar:map-point-wave-bold-duotone"],["recipients","Pegawai penerima","solar:users-group-rounded-bold-duotone"]].map(([key,label,icon])=><DashboardMetric key={key} loading={loading} metric={{label,value:data?.metrics[key]||0,icon,tone:"info",description:"Mengikuti periode dan filter laporan."}}/>)}</Box>:null}
      <DataPanel title={filters.view==="summary"?"Rekap barang dan tujuan":"Rincian penyaluran"} description="Semua jumlah menggunakan satuan masing-masing barang. Jumlah pada transaksi yang dibatalkan ditampilkan sebagai 0." exportConfig={{enabled:!!data,formats:["excel"],onExcel:exportExcel,disabled:loading}}>
        <ResponsiveDataView data={data?.data||[]} columns={columns} loading={loading} error={optionsError || (state.key===requestKey?state.error:"")} onRetry={()=>setReload((n)=>n+1)} scrollX={filters.view==="summary"?1600:1950} emptyDescription="Tidak ada penyaluran sesuai periode, filter, dan cakupan akses Anda." renderCard={(row)=><Box sx={{display:"grid",gap:1.5,minWidth:0}}>{identity(row)}<FontStyle>{row.warehouse_name} → {row.location_name||"Tidak tersedia"}</FontStyle><FontStyle>{row.destination_unit_name||"Tidak tersedia"}</FontStyle>{row.occurred_on?<FontStyle>{dayjs(row.occurred_on).format("D MMM YYYY")} · {row.recipient_name||"Tidak tersedia"}</FontStyle>:null}<Box sx={{display:"flex",gap:1,flexWrap:"wrap"}}>{["distributed_quantity","returned_quantity","net_quantity"].map((key,i)=><InventoryQuantityChip key={key} label={`${["Jumlah disalurkan","Dikembalikan","Belum dikembalikan"][i]}: ${qty(row,key)}`} tone={i===2?"success":"info"}/>)}</Box>{row.actor_name?<Box><FontStyle fontSize={12} sx={{mb:1}}>Disimpan oleh</FontStyle><ActorIdentity position={row.actor_position_name} name={row.actor_name} photoUrl={inventoryActorPhotoUrl(row.actor_photo_file_id,organizationId,row.transaction_id,"distribution")}/></Box>:null}{action(row)}</Box>}/>
        <Box sx={{p:2}}><DataPagination total={data?.total} loading={loading} pageSize={pageSize} onPageSizeChange={setPageSize} cursor={{page:current.index+1,next:data?.nextCursor}} onPrevious={()=>setPage({...current,index:current.index-1})} onNext={()=>setPage({...current,index:current.index+1,tokens:[...current.tokens.slice(0,current.index+1),data.nextCursor]})}/></Box>
      </DataPanel></>:null}
    {detail?<TransactionDetailModal detail={detail} organizationId={organizationId} periodEnd={resolved.to} onClose={()=>setDetail(null)}/>:null}
    <ImagePreviewModal open={!!preview} imageUrl={preview?.url} title={preview?.name||"Foto barang"} onClose={()=>setPreview(null)}/>
    <Notification {...notification} onClose={closeNotification}/>
  </Box>;
}
