"use client";

import { Button } from "antd";
import AppModal from "../modals/AppModal";
import FontStyle from "../font-style/FontStyle";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Konfirmasi",
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}) {
  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={title}
      description="Pastikan tindakan ini memang diperlukan."
      icon="solar:danger-triangle-bold-duotone"
      size="sm"
      disableClose={loading}
      footer={
        <>
          <Button onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button type="primary" danger={danger} loading={loading} onClick={onConfirm}>
            {confirmText}
          </Button>
        </>
      }
    >
      <FontStyle fontSize={13} sx={{ lineHeight: 1.7 }}>
        {message}
      </FontStyle>
    </AppModal>
  );
}
