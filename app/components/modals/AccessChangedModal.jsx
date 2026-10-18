"use client";

import { Button } from "antd";
import { Box, useTheme } from "@mui/material";
import AppIcon from "../icons/AppIcon";
import FontStyle from "../font-style/FontStyle";
import AppModal from "./AppModal";
import AccessCountdownPanel from "./AccessCountdownPanel";

/** Keputusan izin berasal dari server; modal ini hanya menjelaskan dampaknya. */
export default function AccessChangedModal({
  mode,
  secondsRemaining = 5,
  onContinue,
  showUnsavedNotice = false,
}) {
  const theme = useTheme();
  const redirect = mode === "redirect";
  const reduced = mode === "write-reduced";
  return (
    <AppModal
      open={Boolean(mode)}
      title={
        redirect
          ? "Akses halaman dicabut"
          : reduced
            ? "Sebagian izin mengubah data dicabut"
            : "Izin mengubah data dicabut"
      }
      description={
        redirect
          ? "Anda tidak lagi dapat membuka halaman ini."
          : reduced
            ? "Sebagian tindakan pada halaman ini tidak lagi tersedia."
            : "Halaman ini masih dapat dilihat, tetapi datanya tidak dapat diubah."
      }
      icon="solar:lock-password-bold-duotone"
      size="sm"
      contentSx={{ display: "grid", gap: 2, alignContent: "start" }}
      showCloseButton={false}
      disableClose
      closeOnBackdrop={false}
      closeOnEscape={false}
      footer={
        <Button type="primary" onClick={onContinue} style={{ minHeight: 44 }}>
          {redirect ? "Ke Dashboard" : reduced ? "Lanjutkan" : "Lanjut membaca"}
        </Button>
      }
    >
      {showUnsavedNotice ? (
        <Box
          role="status"
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1.25,
            p: 1.75,
            borderRadius: 2,
            bgcolor: theme.status.warning.background,
            color: theme.status.warning.text,
          }}
        >
          <AppIcon
            icon="solar:danger-triangle-bold"
            width={20}
            color={theme.status.warning.main}
            aria-hidden="true"
            style={{ flexShrink: 0, marginTop: 1 }}
          />
          <FontStyle fontSize={12.5} sx={{ lineHeight: 1.55 }}>
            Jika ada isian yang belum disimpan, perubahan tersebut tidak tersimpan.
          </FontStyle>
        </Box>
      ) : null}
      <AccessCountdownPanel
        secondsRemaining={secondsRemaining}
        destination={
          redirect ? "Dashboard" : reduced ? "halaman dengan izin terbaru" : "halaman baca-saja"
        }
        label={redirect ? "Pengalihan otomatis" : "Pembaruan otomatis"}
        compact
        tone="brand"
        actionText={
          redirect
            ? "Dashboard akan terbuka sebentar lagi."
            : reduced
              ? "Tampilan akan menyesuaikan izin terbaru."
              : "Halaman akan menjadi baca-saja."
        }
        description={
          redirect
            ? "Menu lain yang masih diizinkan tetap dapat digunakan."
            : "Tindakan yang tidak lagi diizinkan akan disembunyikan."
        }
      />
    </AppModal>
  );
}
