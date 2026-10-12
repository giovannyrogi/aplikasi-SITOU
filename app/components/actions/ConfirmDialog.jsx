"use client";

import { Button } from "antd";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import AppModal from "../modals/AppModal";
import FontStyle from "../font-style/FontStyle";

export default function ConfirmDialog({
  open,
  title,
  message,
  messageAlign = "justify",
  illustration,
  heading,
  children,
  confirmText = "Konfirmasi",
  danger = false,
  loading = false,
  fullWidthMobile = false,
  onConfirm,
  onClose,
}) {
  const theme = useTheme();
  const mobile = useMediaQuery("(max-width:599px)");
  const mobileButtonStyle = { minHeight: 44, width: fullWidthMobile && mobile ? "100%" : undefined };
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
          <Button onClick={onClose} disabled={loading} style={mobileButtonStyle}>
            Batal
          </Button>
          <Button
            type="primary"
            danger={danger}
            data-action-tone={danger ? "danger" : undefined}
            loading={loading}
            onClick={onConfirm}
            style={mobileButtonStyle}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <Box sx={{ display: "grid", gap: 2, minWidth: 0 }}>
        {illustration ? (
          <Box
            aria-hidden="true"
            sx={{
              display: "grid",
              placeItems: "center",
              mx: "auto",
              width: 72,
              height: 72,
              borderRadius: "50%",
              bgcolor: danger ? theme.status.danger.background : theme.status.info.background,
              color: danger ? theme.status.danger.main : theme.status.info.main,
              "& svg": { fontSize: 36 },
            }}
          >
            {illustration}
          </Box>
        ) : null}
        {heading ? (
          <FontStyle component="h3" fontSize={18} fontWeight={700} sx={{ textAlign: "center" }}>
            {heading}
          </FontStyle>
        ) : null}
        {message ? (
          <FontStyle explanation fontSize={14} sx={{ lineHeight: 1.7, textAlign: messageAlign }}>
            {message}
          </FontStyle>
        ) : null}
        {children}
      </Box>
    </AppModal>
  );
}
