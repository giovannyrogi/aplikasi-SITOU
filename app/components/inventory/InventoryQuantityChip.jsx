"use client";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";

/** Angka operasional harus terbaca utuh pada desktop maupun ponsel. */
export default function InventoryQuantityChip({label,tone="info"}) {
  return <CompactInfoChip label={label} tone={tone} sx={{height:"auto",minHeight:32,maxWidth:"100%",
    "& .MuiChip-label":{px:1.25,py:.75,fontSize:13,fontWeight:700,lineHeight:1.5,whiteSpace:"normal",overflowWrap:"anywhere"}}}/>;
}
