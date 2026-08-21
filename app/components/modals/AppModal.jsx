"use client";

import { useId } from "react";
import { Box, Divider, IconButton, Modal, Tooltip, useTheme } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Icon } from "@iconify/react";
import FontStyle from "../font-style/FontStyle";

const SIZE_WIDTH = { sm: 480, md: 720, lg: 960, xl: 1200 };

export default function AppModal({
  open,
  title,
  description,
  titleDescription,
  icon = "solar:document-text-bold-duotone",
  size = "md",
  width,
  maxHeight = "calc(100dvh - 32px)",
  contentSx = {},
  paperSx = {},
  footer,
  showCloseButton = true,
  disableClose = false,
  closeOnBackdrop = true,
  closeOnEscape = true,
  component = "section",
  onSubmit,
  onClose,
  children,
}) {
  const theme = useTheme();
  const titleId = useId();
  const descriptionId = useId();
  const resolvedDescription = description || titleDescription;

  const requestClose = (event, reason) => {
    if (disableClose) return;
    if (reason === "backdropClick" && !closeOnBackdrop) return;
    if (reason === "escapeKeyDown" && !closeOnEscape) return;
    onClose?.(event, reason);
  };

  return (
    <Modal
      open={open}
      onClose={requestClose}
      aria-labelledby={titleId}
      aria-describedby={resolvedDescription ? descriptionId : undefined}
      sx={{ display: "grid", placeItems: "center", p: { xs: 1, sm: 2 } }}
      slotProps={{
        backdrop: { sx: { bgcolor: "rgba(17, 24, 39, 0.38)", backdropFilter: "blur(4px)" } },
      }}
    >
      <Box
        component={component}
        onSubmit={onSubmit}
        sx={{
          width: { xs: "100%", sm: Math.min(width || SIZE_WIDTH[size] || SIZE_WIDTH.md, 1200) },
          maxWidth: "100%",
          maxHeight,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          bgcolor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          border: `1px solid ${theme.ui.border}`,
          borderRadius: 2,
          boxShadow: "0 24px 64px rgba(17, 24, 39, 0.22)",
          outline: "none",
          ...paperSx,
        }}
      >
        <Box
          sx={{
            flexShrink: 0,
            p: { xs: 2, sm: 2.5 },
            display: "flex",
            alignItems: "flex-start",
            gap: 1.5,
          }}
        >
          {icon ? (
            <Box
              sx={{
                width: 40,
                height: 40,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                borderRadius: 2,
                color: theme.palette.primary.main,
                bgcolor: theme.ui.iconButtonBg,
              }}
            >
              <Icon icon={icon} fontSize={22} />
            </Box>
          ) : null}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <FontStyle
              id={titleId}
              component="h2"
              fontSize={{ xs: 17, sm: 19 }}
              fontWeight={700}
              sx={{ lineHeight: 1.35 }}
            >
              {title}
            </FontStyle>
            {resolvedDescription ? (
              <FontStyle
                id={descriptionId}
                fontSize={12.5}
                sx={{ mt: 0.5, color: theme.ui.mutedText, lineHeight: 1.6 }}
              >
                {resolvedDescription}
              </FontStyle>
            ) : null}
          </Box>
          {showCloseButton ? (
            <Tooltip title="Tutup">
              <span>
                <IconButton
                  disabled={disableClose}
                  onClick={(event) => requestClose(event, "closeButton")}
                  aria-label="Tutup modal"
                  sx={{ width: 44, height: 44 }}
                >
                  <CloseRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
          ) : null}
        </Box>
        <Divider />
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: { xs: 2, sm: 2.5 }, ...contentSx }}>
          {children}
        </Box>
        {footer ? (
          <>
            <Divider />
            <Box
              sx={{
                flexShrink: 0,
                p: { xs: 2, sm: 2.5 },
                pt: { xs: 1.5, sm: 2 },
                display: "flex",
                justifyContent: "flex-end",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              {footer}
            </Box>
          </>
        ) : null}
      </Box>
    </Modal>
  );
}
