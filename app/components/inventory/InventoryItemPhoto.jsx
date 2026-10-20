"use client";
import { useState } from "react";
import { Box } from "@mui/material";
import AppIcon from "@/app/components/icons/AppIcon";

/** Thumbnail privat dengan target sentuh dan aksi preview gambar bersama. */
export default function InventoryItemPhoto({ item, organizationId, onPreview, size = 44, height = size, fit = "cover", tabIndex }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const url = item?.photo_file_id ? `/api/uploads/${item.photo_file_id}?organizationId=${encodeURIComponent(organizationId)}` : null;
  const visible = url && url !== failedUrl;
  return <Box component={visible ? "button" : "span"} type={visible ? "button" : undefined} tabIndex={visible ? tabIndex : undefined}
    aria-label={visible ? `Perbesar foto ${item.name}` : "Barang tanpa foto"}
    onClick={visible ? () => onPreview({ url, name:item.name }) : undefined}
    sx={{ width:size,height,p:0,flexShrink:0,borderRadius:1.5,display:"grid",gridTemplateRows:"minmax(0,1fr)",gridTemplateColumns:"minmax(0,1fr)",placeItems:"center",overflow:"hidden",bgcolor:"action.hover",color:"text.secondary",border:"1px solid",borderColor:"divider",cursor:visible ? "zoom-in" : "default","&:focus-visible":{outline:"2px solid",outlineColor:"primary.main",outlineOffset:2} }}>
    {visible ? <Box component="img" src={url} alt={`Foto ${item.name}`} onError={() => setFailedUrl(url)} sx={{width:"100%",height:"100%",minWidth:0,minHeight:0,objectFit:fit}}/> : <AppIcon icon="solar:gallery-minimalistic-linear" width={22}/>}
  </Box>;
}
