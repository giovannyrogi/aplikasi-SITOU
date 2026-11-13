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
  interactive = true,
  variant = "circular",
  fallbackIcon,
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
    ...(variant === "rounded" && { borderRadius: 2.5 }),
  };

  if (!photoUrl || failed) {
    return (
      <Avatar
        variant={variant}
        aria-label={fallbackIcon ? `Foto ${name} tidak tersedia` : `Inisial ${name}`}
        sx={avatarSx}
      >
        {fallbackIcon || initials}
      </Avatar>
    );
  }

  return (
    <Box
      component={interactive ? "button" : "span"}
      type={interactive ? "button" : undefined}
      aria-label={
        interactive ? `Perbesar ${photoLabel.toLowerCase()} ${name}` : `${photoLabel} ${name}`
      }
      onClick={
        interactive
          ? () =>
              onPreview?.({ imageUrl: photoUrl, alt: `${photoLabel} ${name}`, title: previewTitle })
          : undefined
      }
      sx={{
        display: "inline-flex",
        flexShrink: 0,
        m: 0,
        p: 0,
        bgcolor: "transparent",
        border: 0,
        borderRadius: variant === "rounded" ? 2.5 : variant === "square" ? 0 : "50%",
        cursor: interactive ? "pointer" : "default",
        "&:focus-visible": {
          outline: "2px solid " + theme.palette.primary.main,
          outlineOffset: 2,
        },
      }}
    >
      <Avatar variant={variant} sx={avatarSx}>
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
