"use client";

import { useEffect, useId, useRef } from "react";
import { Box, Divider, IconButton, Modal, Tooltip, useTheme } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AppIconTile from "@/app/components/icons/AppIconTile";
import FontStyle from "../font-style/FontStyle";

const SIZE_WIDTH = { sm: 480, md: 720, lg: 960, xl: 1200 };

export default function AppModal({
  open,
  keepMounted = false,
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
  const titleColumn = icon ? 2 : 1;
  const desktopControlRow = resolvedDescription ? "1 / span 2" : 1;

  const requestClose = (event, reason) => {
    if (disableClose) return;
    if (reason === "backdropClick" && !closeOnBackdrop) return;
    if (reason === "escapeKeyDown" && !closeOnEscape) return;
    onClose?.(event, reason);
  };

  return (
    <Modal
      open={open}
      keepMounted={keepMounted}
      onClose={requestClose}
      aria-labelledby={titleId}
      aria-describedby={resolvedDescription ? descriptionId : undefined}
      sx={{
        display: open ? "grid" : "none",
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
          // Hide scrollbars throughout the shared shell, while preserving native scrolling.
          "&, & *": {
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            "&::-webkit-scrollbar": { display: "none", width: 0, height: 0 },
          },
        }}
      >
        <Box
          component="header"
          className="app-modal-header"
          sx={{
            flexShrink: 0,
            p: { xs: 2, sm: 2.5 },
            display: "grid",
            gridTemplateColumns: [
              icon ? "40px" : null,
              "minmax(0, 1fr)",
              showCloseButton ? "44px" : null,
            ]
              .filter(Boolean)
              .join(" "),
            alignItems: "start",
            columnGap: 1.5,
            rowGap: 0.5,
            minWidth: 0,
            maxHeight: "40dvh",
            overflowY: "auto",
          }}
        >
          {icon ? (
            <Box sx={{ gridColumn: 1, gridRow: { xs: 1, sm: desktopControlRow } }}>
              <AppIconTile icon={icon} tone="brand" size={40} iconSize={22} borderRadius={2} />
            </Box>
          ) : null}
          <FontStyle
            id={titleId}
            component="h2"
            fontSize={{ xs: 17, sm: 19 }}
            fontWeight={700}
            sx={{
              gridColumn: titleColumn,
              gridRow: 1,
              alignSelf: { xs: "center", sm: "start" },
              minWidth: 0,
              lineHeight: 1.35,
            }}
          >
            {title}
          </FontStyle>
          {resolvedDescription ? (
            <FontStyle
              id={descriptionId}
              explanation
              fontSize={12.5}
              sx={{
                gridColumn: { xs: "1 / -1", sm: titleColumn },
                gridRow: 2,
                minWidth: 0,
                color: theme.ui.mutedText,
                lineHeight: 1.6,
                textAlign: descriptionAlign,
              }}
            >
              {resolvedDescription}
            </FontStyle>
          ) : null}
          {showCloseButton ? (
            <Tooltip title="Tutup">
              <Box
                component="span"
                sx={{ gridColumn: titleColumn + 1, gridRow: { xs: 1, sm: desktopControlRow } }}
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
          className="app-modal-body"
          ref={contentRef}
          tabIndex={0}
          role="region"
          aria-label="Isi modal"
          sx={{
            flex: 1,
            minHeight: "min(64px, 10dvh)",
            overflowY: "auto",
            p: { xs: 2, sm: 2.5 },
            ...contentSx,
          }}
        >
          {children}
        </Box>
        {pagination ? (
          <>
            <Divider />
            <Box
              className="app-modal-pagination"
              sx={{
                flexShrink: 1,
                minWidth: 0,
                minHeight: "min(72px, 15dvh)",
                overflowY: "auto",
                px: { xs: 2, sm: 2.5 },
                py: 1.5,
              }}
            >
              {pagination}
            </Box>
          </>
        ) : null}
        {footer ? (
          <>
            <Divider />
            <Box
              component="footer"
              className="app-modal-footer"
              sx={{
                flexShrink: 0,
                p: { xs: 2, sm: 2.5 },
                pt: { xs: 1.5, sm: 2 },
                display: "flex",
                justifyContent: "flex-end",
                flexWrap: "wrap",
                gap: 1.5,
                [theme.breakpoints.down("sm")]: {
                  flexDirection: "column",
                  alignItems: "stretch",
                  "& > *": { width: "100%", minWidth: 0 },
                  "& > .MuiBox-root, & > .MuiStack-root": {
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr)",
                    gap: 1.5,
                    alignItems: "stretch",
                  },
                  "& .ant-space": {
                    width: "100%",
                    flexDirection: "column",
                    alignItems: "stretch",
                    gap: "12px !important",
                  },
                  "& .ant-space-item": { width: "100%", minWidth: 0 },
                  "& .ant-btn, & .MuiButton-root": {
                    width: "100%",
                    minHeight: 44,
                    height: "auto",
                    whiteSpace: "normal",
                  },
                },
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
