"use client";
import { useState } from "react";
import { Box } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";
import PhotoAvatar from "./PhotoAvatar";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";

/** Identitas pelaku bersama; URL foto harus berasal dari akses dokumen berizin. */
export default function ActorIdentity({ name = "Tidak tersedia", position, photoUrl, size = 44 }) {
  const [preview, setPreview] = useState(null);
  return <>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
      <PhotoAvatar key={photoUrl || name} name={name} photoUrl={photoUrl} size={size}
        photoLabel="Pas foto" previewTitle={`Pas foto ${name}`} onPreview={setPreview}/>
      <Box sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
        <FontStyle fontSize={12}>{name}</FontStyle>
        {position ? <FontStyle fontSize={11.5} sx={{ color: "text.secondary", mt: .25 }}>{position}</FontStyle> : null}
      </Box>
    </Box>
    <ImagePreviewModal open={!!preview} imageUrl={preview?.imageUrl} alt={preview?.alt}
      title={preview?.title || "Pas foto pelaku"} onClose={() => setPreview(null)}/>
  </>;
}
