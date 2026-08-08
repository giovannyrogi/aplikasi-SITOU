"use client";

import React from "react";
import { Backdrop, Box, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useThemeMode } from "../themeprovider/ThemeContext";

const DEFAULT_Z_INDEX_OFFSET = 999999;

/**
 * Resolve zIndex safely for both old and new usages.
 * Existing pages may pass a number or keep the previous callback-style default,
 * so this helper keeps the component backward compatible.
 */
const resolveZIndex = (theme, zIndex) => {
  if (typeof zIndex === "function") {
    return zIndex(theme);
  }

  return zIndex;
};

/**
 * Full-screen loading overlay used across protected pages and login flows.
 * The API intentionally stays small and compatible with existing usages; this
 * component only upgrades the visual layer, not the loading behavior itself.
 */
const LoadingBackdrop = ({
  open = false,
  message = "Loading...",
  color,
  zIndex = (theme) => theme.zIndex.drawer + DEFAULT_Z_INDEX_OFFSET,
  ...props
}) => {
  const theme = useTheme();
  const { themeMode } = useThemeMode();
  const isDark = themeMode === "dark";
  const resolvedZIndex = resolveZIndex(theme, zIndex);
  const logoSrc = "/sewain-s-icon-red.png";
  const accentColor = theme.palette.primary.main;
  const messageColor = color || accentColor;

  return (
    <AnimatePresence>
      {open && (
        <Box
          component={motion.div}
          key="loading-backdrop-wrapper"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: resolvedZIndex,
            pointerEvents: "auto",
          }}
        >
          <Backdrop
            open={open}
            sx={{
              zIndex: resolvedZIndex,
              px: { xs: 2, sm: 3 },
              bgcolor: isDark
                ? "rgba(0, 0, 0, 0.58)"
                : "rgba(255, 255, 255, 0.58)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            {...props}
          >
            <Box
              component={motion.div}
              key="loading-content"
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: { xs: 2, sm: 2.25 },
                pointerEvents: "none",
              }}
            >
              <Box
                component={motion.div}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.86 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                sx={{
                  position: "relative",
                  width: { xs: 124, sm: 148 },
                  height: { xs: 124, sm: 148 },
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                }}
              >
                {/* Rotating ring is custom-built so the spinner remains stable
                    and visually consistent across all pages using this loader. */}
                <Box
                  component={motion.div}
                  aria-hidden="true"
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1.05,
                    ease: "linear",
                    repeat: Infinity,
                  }}
                  sx={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: `3px solid ${alpha(accentColor, isDark ? 0.16 : 0.14)}`,
                    borderTopColor: accentColor,
                    borderRightColor: alpha(accentColor, isDark ? 0.52 : 0.42),
                    boxShadow: `0 0 0 1px ${alpha(accentColor, 0.08)}, 0 18px 48px ${alpha(
                      accentColor,
                      isDark ? 0.18 : 0.12,
                    )}`,
                  }}
                />

                <Box
                  sx={{
                    width: { xs: 86, sm: 100 },
                    height: { xs: 86, sm: 100 },
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isDark ? (
                    <Box
                      role="img"
                      aria-label="SewaIN loading"
                      sx={{
                        width: "82%",
                        height: "82%",
                        bgcolor: accentColor,
                        filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.34))",
                        maskImage: "url('/sewain-s-icon-white.png')",
                        maskRepeat: "no-repeat",
                        maskPosition: "center",
                        maskSize: "contain",
                        WebkitMaskImage: "url('/sewain-s-icon-white.png')",
                        WebkitMaskRepeat: "no-repeat",
                        WebkitMaskPosition: "center",
                        WebkitMaskSize: "contain",
                      }}
                    />
                  ) : (
                    <Image
                      src={logoSrc}
                      alt="SewaIN loading"
                      width={62}
                      height={62}
                      priority
                      style={{
                        width: "82%",
                        height: "82%",
                        objectFit: "contain",
                        filter: "drop-shadow(0 4px 10px rgba(230,9,9,0.16))",
                      }}
                    />
                  )}
                </Box>
              </Box>

              {message ? (
                <Box
                  component={motion.div}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                  sx={{
                    maxWidth: { xs: "min(280px, 88vw)", sm: 420 },
                    px: { xs: 1.5, sm: 2 },
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: { xs: 13, sm: 14 },
                      fontWeight: 800,
                      color: messageColor,
                      textAlign: "center",
                      lineHeight: 1.45,
                      overflowWrap: "anywhere",
                      textShadow: isDark
                        ? "0 2px 12px rgba(0, 0, 0, 0.45)"
                        : "none",
                    }}
                  >
                    {message}
                  </Typography>
                </Box>
              ) : null}
            </Box>
          </Backdrop>
        </Box>
      )}
    </AnimatePresence>
  );
};

export default LoadingBackdrop;
