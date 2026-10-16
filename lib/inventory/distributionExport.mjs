import ExcelJS from "exceljs";
import {scaled} from "./replay.mjs";
import {DISTRIBUTION_NET_HELP,DISTRIBUTION_PERIOD_HELP} from "./distributionPolicy.mjs";
/** Literal cells only; preserve large decimal quantities instead of rounding beyond safe precision. */
export async function distributionWorkbook(report) {
  const workbook=new ExcelJS.Workbook();workbook.creator="SITOU";
  const guide=workbook.addWorksheet("Petunjuk");
  const rows=[["Laporan Distribusi Barang"],["Organisasi",report.organization.name],["Periode penyaluran",`${report.filters.from} — ${report.filters.to}`],["Batas pengembalian/pembatalan",report.filters.to],["Tampilan",report.filters.view==="summary"?"Rekap barang dan tujuan":"Rincian penyaluran"],["Status",({effective:"Tidak dibatalkan",cancelled:"Dibatalkan",all:"Semua status"})[report.filters.status]],["Waktu pembuatan",new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"medium",timeZone:report.organization.timezone}).format(new Date(report.generatedAt))],["Aturan periode",DISTRIBUTION_PERIOD_HELP],["Belum dikembalikan",DISTRIBUTION_NET_HELP],["Gudang",report.filters.warehouseId?report.data[0]?.warehouse_name||"Pilihan tanpa hasil":"Semua gudang"],["Barang",report.filters.itemId?report.data[0]?.item_name||"Pilihan tanpa hasil":"Semua barang"],["Lokasi tujuan",report.filters.locationId?report.data[0]?.location_name||"Pilihan tanpa hasil":"Semua lokasi"],["Divisi & Unit",report.filters.unitId?report.data[0]?.destination_unit_name||"Pilihan tanpa hasil":"Semua Divisi & Unit"],["Pegawai penerima",report.filters.recipientId?report.data[0]?.recipient_name||"Pegawai penerima dipilih":"Semua penerima"],["Pencarian",report.filters.search||"Tidak digunakan"]];
  rows.forEach((r)=>guide.addRow(r));guide.columns=[{width:32},{width:110}];
  const sheet=workbook.addWorksheet("Distribusi");const detail=report.filters.view==="details";
  sheet.columns=[...(detail?[{header:"Tanggal penyaluran",key:"occurred_on",width:20}]:[]),
    {header:"Gudang asal",key:"warehouse_name",width:26},{header:"Kode barang",key:"item_code",width:20},{header:"Barang",key:"item_name",width:30},
    {header:"Lokasi tujuan",key:"location_name",width:26},{header:"Divisi & Unit tujuan",key:"destination_unit_name",width:30},
    ...(detail?[{header:"Pegawai penerima",key:"recipient_name",width:30},{header:"Nomor memo/permintaan",key:"reference_no",width:24},{header:"Jumlah dokumen asal",key:"original_quantity",width:23}]:[{header:"Transaksi",key:"transaction_count",width:15}]),
    ...["distributed_quantity","returned_quantity","net_quantity"].map((key,i)=>({header:["Jumlah disalurkan","Dikembalikan","Belum dikembalikan"][i],key,width:23})),{header:"Satuan",key:"unit_name",width:15},...(detail?[{header:"Tanggal pembatalan",key:"cancelled_on",width:22},{header:"Disimpan oleh",key:"actor_name",width:24}]:[])];
  const quantityKeys=["original_quantity","distributed_quantity","returned_quantity","net_quantity"];
  for(const entry of report.data){const output={...entry},formats={};for(const key of quantityKeys){if(output[key]!=null){const n=scaled(output[key]);const safe=n<=BigInt(Number.MAX_SAFE_INTEGER)&&n>=-BigInt(Number.MAX_SAFE_INTEGER);output[key]=safe?Number(n)/1000:String(output[key]);
      // Excel dapat menampilkan pemisah desimal meskipun seluruh digit # kosong.
      // Gunakan jumlah desimal nyata agar 1 tampil 1, bukan 1. atau 1,.
      const decimals=(n<0n?-n:n)%1000n;
      const digits=decimals.toString().padStart(3,"0").replace(/0+$/,"").length;
      formats[key]=safe?`#,##0${digits?"."+"0".repeat(digits):""}`:"@";
    }}
    const row=sheet.addRow(output);for(const [key,format] of Object.entries(formats))if(sheet.columns.some((c)=>c.key===key))row.getCell(key).numFmt=format;}
  sheet.views=[{state:"frozen",ySplit:1}];sheet.autoFilter={from:{row:1,column:1},to:{row:sheet.rowCount,column:sheet.columns.length}};
  sheet.getRow(1).font={bold:true};
  return workbook.xlsx.writeBuffer();
}
