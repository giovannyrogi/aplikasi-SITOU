"use client";

import { useEffect, useId, useRef } from "react";
import { Box, Divider, IconButton, Modal, Tooltip, useTheme } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AppIconTile from "@/app/components/icons/AppIconTile";
import FontStyle from "../font-style/FontStyle";

const SIZE_WIDTH = { sm: 480, md: 720, lg: 960, xl: 1200 };

export default function AppModal({
  open,
  title,
  description,
  descriptionAlign = "justify",
  titleDescription,
  icon = "solar:document-text-bold-duotone",
  size = "md",
  width,
  maxHeight = "calc(100dvh - 32px)",
  contentSx = {},
  paperSx = {},
  footer,
  pagination,
  contentResetKey,
  scrollHeaderWithContent = false,
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
  const contentRef = useRef(null);
  useEffect(() => {
    if (contentResetKey !== undefined && contentRef.current) contentRef.current.scrollTop = 0;
  }, [contentResetKey]);
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
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        placeItems: "center",
        p: { xs: 1, sm: 2 },
      }}
      slotProps={{
        backdrop: { sx: { bgcolor: "rgba(17, 24, 39, 0.38)", backdropFilter: "blur(4px)" } },
      }}
    >
      <Box
        component={component}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={resolvedDescription ? descriptionId : undefined}
        onSubmit={onSubmit}
        sx={{
          width: { xs: "100%", sm: Math.min(width || SIZE_WIDTH[size] || SIZE_WIDTH.md, 1200) },
          maxWidth: "100%",
          maxHeight,
          minWidth: 0,
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
          ref={scrollHeaderWithContent ? contentRef : undefined}
          sx={
            scrollHeaderWithContent
              ? { flex: 1, minHeight: 0, overflowY: "auto" }
              : { display: "contents" }
          }
        >
          <Box
            sx={{
              flexShrink: 0,
              p: { xs: 2, sm: 2.5 },
              display: scrollHeaderWithContent ? { xs: "grid", sm: "flex" } : "flex",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              alignItems: "flex-start",
              gap: 1.5,
            }}
          >
            {icon ? (
              <AppIconTile icon={icon} tone="brand" size={40} iconSize={22} borderRadius={2} />
            ) : null}
            <Box
              sx={{
                minWidth: 0,
                flex: 1,
                ...(scrollHeaderWithContent ? { gridColumn: "1 / -1", gridRow: 2 } : {}),
              }}
            >
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
                  explanation
                  fontSize={12.5}
                  sx={{
                    mt: 0.5,
                    color: theme.ui.mutedText,
                    lineHeight: 1.6,
                    textAlign: descriptionAlign,
                  }}
                >
                  {resolvedDescription}
                </FontStyle>
              ) : null}
            </Box>
            {showCloseButton ? (
              <Tooltip title="Tutup">
                <Box
                  component="span"
                  sx={scrollHeaderWithContent ? { gridColumn: 2, gridRow: 1 } : undefined}
                >
                  <IconButton
                    disabled={disableClose}
                    onClick={(event) => requestClose(event, "closeButton")}
                    aria-label="Tutup modal"
                    sx={{ width: 44, height: 44 }}
                  >
                    <CloseRoundedIcon />
                  </IconButton>
                </Box>
              </Tooltip>
            ) : null}
          </Box>
          <Divider />
          <Box
            ref={scrollHeaderWithContent ? undefined : contentRef}
            sx={{
              flex: scrollHeaderWithContent ? undefined : 1,
              minHeight: 0,
              overflowY: scrollHeaderWithContent ? undefined : "auto",
              p: { xs: 2, sm: 2.5 },
              ...contentSx,
            }}
          >
            {children}
          </Box>
        </Box>
        {pagination ? (
          <>
            <Divider />
            <Box sx={{ flexShrink: 0, minWidth: 0, px: { xs: 2, sm: 2.5 }, py: 1.5 }}>
              {pagination}
            </Box>
          </>
        ) : null}
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
                gap: 1.5,
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
