"use client";

import { useState } from "react";
import { Avatar, Box, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";

/** Avatar identitas dengan foto privat, inisial, dan fallback saat gambar gagal dimuat. */
export default function PhotoAvatar({
  name,
  photoUrl,
  size = 44,
  photoLabel = "Foto",
  previewTitle = photoLabel,
  onPreview,
}) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = !words.length
    ? "?"
    : words.length === 1
      ? words[0].slice(0, 2).toUpperCase()
      : (words[0][0] + words.at(-1)[0]).toUpperCase();
  const avatarSx = {
    width: size,
    height: size,
    flexShrink: 0,
    bgcolor: alpha(theme.palette.primary.main, 0.09),
    color: theme.palette.primary.dark,
    border: "1px solid " + alpha(theme.palette.primary.main, 0.16),
    fontSize: size * 0.3,
    fontWeight: 700,
  };

  if (!photoUrl || failed) {
    return (
      <Avatar aria-label={`Inisial ${name}`} sx={avatarSx}>
        {initials}
      </Avatar>
    );
  }

  return (
    <Box
      component="button"
      type="button"
      aria-label={`Perbesar ${photoLabel.toLowerCase()} ${name}`}
      onClick={() =>
        onPreview?.({ imageUrl: photoUrl, alt: `${photoLabel} ${name}`, title: previewTitle })
      }
      sx={{
        display: "inline-flex",
        flexShrink: 0,
        m: 0,
        p: 0,
        bgcolor: "transparent",
        border: 0,
        borderRadius: "50%",
        cursor: "pointer",
        "&:focus-visible": {
          outline: "2px solid " + theme.palette.primary.main,
          outlineOffset: 2,
        },
      }}
    >
      <Avatar sx={avatarSx}>
        <Box
          component="img"
          src={photoUrl}
          alt={`${photoLabel} ${name}`}
          width={size}
          height={size}
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          sx={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "auto" }}
        />
      </Avatar>
    </Box>
  );
}
