"use client";

import GlobalStyles from "@mui/material/GlobalStyles";
import { ThemeProvider, createTheme } from "@mui/material/styles";

export const BRAND_COLORS = Object.freeze({
  primary: "#EE0014",
  primaryDark: "#D90010",
  primaryStrong: "#ED0717",
  primarySoft: "#FF2C2F",
  primaryHover: "#F04853",
  onPrimary: "#FFFFFF",
  iconMuted: "#64748B",
});

export const STATUS_TONES = Object.freeze({
  success: {
    main: "#16803C",
    text: "#166534",
    background: "#F0FDF4",
    border: "#BBF7D0",
  },
  warning: {
    main: "#B45309",
    text: "#92400E",
    background: "#FFFBEB",
    border: "#FDE68A",
  },
  info: {
    main: "#2563EB",
    text: "#1D4ED8",
    background: "#EFF6FF",
    border: "#BFDBFE",
  },
  danger: {
    main: "#C62828",
    text: "#B42318",
    background: "#FEF3F2",
    border: "#FECDCA",
  },
  neutral: {
    main: "#667085",
    text: "#475467",
    background: "#F2F4F7",
    border: "#D0D5DD",
  },
});

export const UI_TOKENS = Object.freeze({
  pageBg: "#F7F7F8",
  surface: "#FFFFFF",
  surfaceSubtle: "#F8F9FB",
  surfaceAccent: "#FFF7F7",
  text: "#232323",
  textMuted: "#5F6B7A",
  border: "#D8DEE8",
  borderSubtle: "#E8EBF0",
  rowHover: "#FFF7F7",
  scrollbarTrack: "rgba(238, 0, 20, 0.10)",
  scrollbarBorder: "rgba(255, 255, 255, 0.92)",
  panelShadow: "0 8px 24px rgba(17, 24, 39, 0.06)",
});

export const appTheme = createTheme({
  typography: {
    fontFamily: '"Poppins", sans-serif',
    letterSpacing: "0.4px",
    fontWeightRegular: 500,
    fontWeightMedium: 600,
    fontWeightBold: 700,
    button: {
      fontFamily: '"Poppins", sans-serif',
      letterSpacing: "0.4px",
      textTransform: "none",
    },
  },
  palette: {
    mode: "light",
    primary: { main: BRAND_COLORS.primary, dark: BRAND_COLORS.primaryDark },
    secondary: { main: "#CB3CFF" },
    inactiveColor: { main: STATUS_TONES.danger.main },
    background: { default: UI_TOKENS.surface, paper: UI_TOKENS.surface },
    text: { primary: UI_TOKENS.text, secondary: UI_TOKENS.textMuted },
    error: { main: STATUS_TONES.danger.main },
    success: { main: STATUS_TONES.success.main },
    info: { main: STATUS_TONES.info.main },
    warning: { main: STATUS_TONES.warning.main },
  },
  brand: BRAND_COLORS,
  status: STATUS_TONES,
  ui: {
    pageBg: UI_TOKENS.pageBg,
    panelBg: UI_TOKENS.surface,
    panelSubtleBg: UI_TOKENS.surfaceSubtle,
    panelAccentBg: UI_TOKENS.surfaceAccent,
    panelBorder: UI_TOKENS.border,
    panelBorderSubtle: UI_TOKENS.borderSubtle,
    panelShadow: UI_TOKENS.panelShadow,
    tableHeaderBg: UI_TOKENS.surfaceSubtle,
    tableHeaderText: "#374151",
    tableRowHover: UI_TOKENS.rowHover,
    pageGradient:
      "linear-gradient(135deg, rgba(230, 9, 9, 0.10) 0%, transparent 34%), linear-gradient(315deg, rgba(255, 152, 0, 0.12) 0%, transparent 34%)",
    gridColor: "rgba(17, 24, 39, 0.10)",
    gridOpacity: 0.16,
    shellBg: "rgba(255, 255, 255, 0.72)",
    shellShadow: "0 28px 80px rgba(17, 24, 39, 0.14)",
    featurePanelBg: "linear-gradient(145deg, rgba(239, 29, 36, 0.95), rgba(159, 17, 23, 0.96))",
    featureCardBg: "rgba(255, 255, 255, 0.18)",
    featureBorder: "rgba(255, 255, 255, 0.28)",
    featureRingBorder: "rgba(255, 255, 255, 0.10)",
    featureText: BRAND_COLORS.onPrimary,
    featureMuted: "rgba(255, 255, 255, 0.88)",
    surfaceBg: "rgba(255, 255, 255, 0.88)",
    fieldBg: "rgba(17, 24, 39, 0.03)",
    border: "rgba(17, 24, 39, 0.10)",
    mutedText: "rgba(17, 24, 39, 0.58)",
    accent: BRAND_COLORS.primary,
    loadingText: BRAND_COLORS.onPrimary,
    buttonShadow: "0 12px 26px rgba(230, 9, 9, 0.28)",
    buttonHoverShadow: "0 14px 30px rgba(230, 9, 9, 0.34)",
    navBg: "rgba(255, 255, 255, 0.92)",
    navBorder: "rgba(17, 24, 39, 0.10)",
    navItemHover: "rgba(230, 9, 9, 0.08)",
    navItemActive: "rgba(230, 9, 9, 0.12)",
    navUserBg: "rgba(230, 9, 9, 0.10)",
    navUserBorder: "rgba(230, 9, 9, 0.18)",
    navUserShadow: "0 12px 28px rgba(230, 9, 9, 0.08)",
    navIconBg: "rgba(17, 24, 39, 0.06)",
    navIconColor: "rgba(17, 24, 39, 0.72)",
    navDivider: "rgba(17, 24, 39, 0.14)",
    navSubmenuLine: "rgba(230, 9, 9, 0.20)",
    topbarBg: "rgba(255, 255, 255, 0.82)",
    topbarBorder: "rgba(17, 24, 39, 0.10)",
    iconButtonBg: "rgba(230, 9, 9, 0.10)",
    iconButtonHover: "rgba(230, 9, 9, 0.16)",
    menuPaperBg: "rgba(255, 255, 255, 0.96)",
    dashboardCardBg: "rgba(255, 255, 255, 0.92)",
    dashboardCardBorder: "rgba(17, 24, 39, 0.11)",
    dashboardCardShadow: "0 12px 34px rgba(17, 24, 39, 0.12)",
    dashboardCardHoverShadow: "0 18px 44px rgba(17, 24, 39, 0.16)",
    notificationBg: "rgba(255, 255, 255, 0.96)",
    notificationBorder: "rgba(17, 24, 39, 0.10)",
    notificationShadow: "0 18px 48px rgba(17, 24, 39, 0.16)",
    login: {
      panelBackground: "linear-gradient(145deg, #D90010 0%, #ED0717 44%, #FF2C2F 100%)",
      patternBackground:
        "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.10) 0 1px, transparent 1px 80px)",
      illustrationLayer: "rgba(255,255,255,0.18)",
      illustrationLayerStrong: "rgba(255,255,255,0.20)",
      illustrationWindow: "rgba(255,255,255,0.36)",
      illustrationBase: "rgba(255,255,255,0.60)",
      statisticBadgeBg: "rgba(255,255,255,0.14)",
      buttonShadow: "0 10px 26px rgba(238,0,20,0.24)",
    },
  },
});

export default function AppThemeProvider({ children }) {
  return (
    <ThemeProvider theme={appTheme}>
      <GlobalStyles
        styles={{
          ":root": {
            "--sitou-scrollbar-thumb": BRAND_COLORS.primary,
            "--sitou-scrollbar-thumb-soft": BRAND_COLORS.primarySoft,
            "--sitou-scrollbar-thumb-hover": BRAND_COLORS.primaryHover,
            "--sitou-scrollbar-thumb-dark": BRAND_COLORS.primaryDark,
            "--sitou-scrollbar-track": UI_TOKENS.scrollbarTrack,
            "--sitou-scrollbar-border": UI_TOKENS.scrollbarBorder,
          },
        }}
      />
      {children}
    </ThemeProvider>
  );
}
