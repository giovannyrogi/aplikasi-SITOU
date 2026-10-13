"use client";
import {Button} from "antd";
import {Box,useTheme} from "@mui/material";
import AppIcon from "@/app/components/icons/AppIcon";
import FontStyle from "@/app/components/font-style/FontStyle";

/** Aksi sekunder yang menonjol untuk memeriksa record terkait tanpa meninggalkan form. */
export default function RelatedRecordAction({title,description,label,onClick,loading=false,disabled=false,icon=null}) {
  const theme=useTheme(),tone=theme.status.info;
  return <Box sx={{p:2,borderRadius:2,border:"1px solid",borderColor:tone.border,bgcolor:tone.background,minWidth:0,display:"grid",gap:1.5}}>
    <Box sx={{minWidth:0}}><FontStyle fontWeight={600} fontSize={13}>{title}</FontStyle><FontStyle fontSize={12} sx={{mt:.5,color:"text.secondary",lineHeight:1.6}}>{description}</FontStyle></Box>
    <Button onClick={onClick} loading={loading} disabled={disabled} aria-label={label} aria-busy={loading} icon={icon?<AppIcon icon={icon} width={18}/>:undefined}
      style={{minHeight:44,width:"100%",fontSize:13,fontWeight:600,color:disabled?undefined:tone.main,borderColor:disabled?undefined:tone.border,background:disabled?undefined:theme.ui.panelBg}}>{label}</Button>
  </Box>;
}
