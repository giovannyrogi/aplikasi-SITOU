"use client";

import { useState } from "react";
import { Avatar, Box, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";

/** Menghasilkan inisial ringkas dari nama tanpa membuka data gambar lain sebagai fallback. */
function getInitials(name) {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words.at(-1)[0]).toUpperCase();
}

function avatarSx(theme, size) {
  return {
    width: size,
    height: size,
    flexShrink: 0,
    bgcolor: alpha(theme.palette.primary.main, 0.09),
    color: theme.palette.primary.dark,
    border: "1px solid " + alpha(theme.palette.primary.main, 0.16),
    fontSize: size * 0.3,
    fontWeight: 700,
  };
}

function InitialAvatar({ name, size }) {
  const theme = useTheme();

  return (
    <Avatar aria-label={"Inisial " + name} sx={avatarSx(theme, size)}>
      {getInitials(name)}
    </Avatar>
  );
}

/** Pas foto valid mengirim URL privat ke satu modal preview terpusat pada halaman. */
function EmployeePhoto({ photoUrl, name, size, onPreview }) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  if (failed) return <InitialAvatar name={name} size={size} />;

  return (
    <Box
      component="button"
      type="button"
      aria-label={"Perbesar pas foto " + name}
      onClick={() =>
        onPreview?.({
          imageUrl: photoUrl,
          alt: "Pas foto " + name,
          title: "Pas foto pegawai",
        })
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
      <Avatar sx={avatarSx(theme, size)}>
        <Box
          component="img"
          src={photoUrl}
          alt={"Pas foto " + name}
          onError={() => setFailed(true)}
          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </Avatar>
    </Box>
  );
}

/** Menampilkan pas foto privat pegawai; data tanpa foto hanya menampilkan inisial. */
export default function EmployeeAvatar({ employee, size = 44, onPreview }) {
  const fileId = employee?.profile_photo_file_id;
  const organizationId = employee?.organization_id;
  const name = employee?.full_name || "pegawai";
  const photoUrl =
    fileId && organizationId
      ? "/api/uploads/" +
        encodeURIComponent(fileId) +
        "?organizationId=" +
        encodeURIComponent(organizationId)
      : null;

  return photoUrl ? (
    <EmployeePhoto
      key={photoUrl}
      photoUrl={photoUrl}
      name={name}
      size={size}
      onPreview={onPreview}
    />
  ) : (
    <InitialAvatar name={name} size={size} />
  );
}
