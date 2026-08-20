"use client";

import { useState } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import Zoom from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";
import FontStyle from "../font-style/FontStyle";
import AppModal from "./AppModal";

function PreviewImage({ imageUrl, alt }) {
  const theme = useTheme();
  const [state, setState] = useState(imageUrl ? "loading" : "error");

  return (
    <Box
      sx={{
        minHeight: { xs: 280, sm: 420 },
        display: "grid",
        placeItems: "center",
        position: "relative",
      }}
    >
      {state === "loading" ? <CircularProgress color="primary" /> : null}
      {state === "error" ? (
        <FontStyle fontSize={13} fontWeight={600} sx={{ color: theme.palette.error.main }}>
          Gambar tidak dapat ditampilkan.
        </FontStyle>
      ) : null}
      {imageUrl ? (
        <Zoom>
          {/* Blob dan endpoint privat tidak selalu kompatibel dengan optimasi next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={alt}
            onLoad={() => setState("ready")}
            onError={() => setState("error")}
            style={{
              display: state === "error" ? "none" : "block",
              maxWidth: "100%",
              maxHeight: "72dvh",
              objectFit: "contain",
              borderRadius: 8,
            }}
          />
        </Zoom>
      ) : null}
    </Box>
  );
}

export default function ImagePreviewModal({
  open,
  onClose,
  imageUrl,
  alt = "Pratinjau gambar",
  title = "Pratinjau gambar",
}) {
  const theme = useTheme();

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={title}
      description={alt}
      icon="solar:gallery-wide-bold-duotone"
      size="xl"
      contentSx={{ p: { xs: 1, sm: 2 }, bgcolor: theme.ui.pageBg }}
    >
      <PreviewImage key={`${open}-${imageUrl}`} imageUrl={imageUrl} alt={alt} />
    </AppModal>
  );
}
