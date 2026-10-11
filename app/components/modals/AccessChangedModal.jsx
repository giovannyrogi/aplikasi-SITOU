"use client";

import { Button } from "antd";
import AppNotice from "../data-display/AppNotice";
import AppModal from "./AppModal";
import AccessCountdownPanel from "./AccessCountdownPanel";

/** Keputusan izin berasal dari server; modal ini hanya menjelaskan dampaknya. */
export default function AccessChangedModal({ mode, secondsRemaining = 5, onContinue }) {
  const redirect = mode === "redirect";
  const reduced = mode === "write-reduced";
  return (
    <AppModal
      open={Boolean(mode)}
      title={
        redirect
          ? "Akses halaman dicabut"
          : reduced
            ? "Sebagian akses mengelola dicabut"
            : "Akses mengelola dicabut"
      }
      description={
        redirect
          ? "Halaman ini tidak lagi tersedia untuk akun Anda."
          : reduced
            ? "Sebagian tindakan pada halaman ini tidak lagi tersedia."
            : "Halaman tetap dapat dibaca, tetapi tidak dapat diubah."
      }
      icon="solar:lock-password-bold-duotone"
      size="sm"
      contentSx={{ display: "grid", gap: 3, alignContent: "start" }}
      showCloseButton={false}
      disableClose
      closeOnBackdrop={false}
      closeOnEscape={false}
      footer={
        <Button type="primary" onClick={onContinue}>
          {redirect ? "Ke Dashboard sekarang" : reduced ? "Lanjutkan" : "Lanjut membaca"}
        </Button>
      }
    >
      <AppNotice
        tone="warning"
        title="Hak akses Anda telah berubah"
        description={
          redirect
            ? "Form dan data halaman ini telah ditutup. Perubahan yang belum disimpan tidak tersimpan."
            : "Form yang sedang dibuka telah ditutup. Perubahan yang belum disimpan tidak tersimpan."
        }
      />
      <AccessCountdownPanel
        secondsRemaining={secondsRemaining}
        destination={
          redirect ? "Dashboard" : reduced ? "halaman dengan izin terbaru" : "halaman baca-saja"
        }
        label={redirect ? "Pengalihan otomatis" : "Pembaruan tampilan otomatis"}
        icon="solar:lock-keyhole-linear"
        actionText={
          redirect
            ? undefined
            : reduced
              ? "Sebagian tindakan akan dinonaktifkan."
              : "Halaman ini akan menjadi baca-saja."
        }
        description={
          redirect
            ? "Anda tetap dapat menggunakan menu lain yang masih diizinkan."
            : reduced
              ? "Tindakan yang izinnya dicabut akan disembunyikan."
              : "Tindakan tambah, ubah, dan hapus yang tidak lagi diizinkan akan disembunyikan."
        }
      />
    </AppModal>
  );
}
