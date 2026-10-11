"use client";

import { Button } from "antd";
import AccessCountdownPanel from "./AccessCountdownPanel";
import AppModal from "./AppModal";

export default function ExpiredSessionModal({ open, secondsRemaining = 5, onLogout }) {
  return (
    <AppModal
      open={open}
      title="Sesi login berakhir"
      description="Demi keamanan akun, Anda harus masuk kembali."
      icon="solar:shield-warning-bold-duotone"
      size="sm"
      showCloseButton={false}
      disableClose
      closeOnBackdrop={false}
      closeOnEscape={false}
      footer={
        <Button type="primary" onClick={onLogout}>
          Ke halaman login sekarang
        </Button>
      }
    >
      <AccessCountdownPanel
        secondsRemaining={secondsRemaining}
        destination="halaman login"
        description="Akses data telah dihentikan. Silakan masuk kembali untuk melanjutkan."
      />
    </AppModal>
  );
}
