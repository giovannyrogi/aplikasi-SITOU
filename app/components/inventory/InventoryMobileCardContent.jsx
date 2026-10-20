"use client";

import { Button } from "antd";
import AppIcon from "@/app/components/icons/AppIcon";
import { Box, Divider, useTheme } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";

/** Susunan kartu mobile Inventaris bersama; bingkai, nomor, dan pagination dari ResponsiveDataView. */
export default function InventoryMobileCardContent({
  identity,
  status,
  facts = [],
  quantities = [],
  quantityLabel = "Jumlah barang",
  quantityFooter,
  children,
  people,
  action,
}) {
  const theme = useTheme();
  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
      <Box sx={{ display: "grid", gap: 2, minWidth: 0 }}>
        {identity}
        {status ? <Box sx={{ display: "flex", justifyContent: "flex-start" }}>{status}</Box> : null}
      </Box>
      {facts.length ? (
        <Box
          component="dl"
          sx={{ m: 0, display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 2 }}
        >
          {facts.map(({ label, value, fullWidth }) => (
            <Box key={label} sx={{ minWidth: 0, gridColumn: fullWidth ? "1 / -1" : undefined }}>
              <FontStyle component="dt" fontSize={12} sx={{ color: "text.secondary", mb: 1 }}>
                {label}
              </FontStyle>
              <FontStyle
                component="dd"
                fontSize={13.5}
                fontWeight={600}
                sx={{ m: 0, overflowWrap: "anywhere" }}
              >
                {value ?? "Tidak tersedia"}
              </FontStyle>
            </Box>
          ))}
        </Box>
      ) : null}
      {children}
      {people ? <Box sx={{ display: "grid", gap: 2 }}>{people}</Box> : null}
      {quantities.length ? (
        <Box
          component="dl"
          aria-label={quantityLabel}
          sx={{
            m: 0,
            p: 2,
            borderRadius: 2,
            bgcolor: theme.ui.panelSubtleBg,
            display: "grid",
            gap: 2,
          }}
        >
          {quantities.map(
            ({ key: quantityKey, label, value, emphasis, secondary, stacked, separate }) => (
              <Box
                key={quantityKey || label}
                sx={{
                  display: "grid",
                  gridTemplateColumns: stacked ? "minmax(0,1fr)" : "minmax(0,1fr) fit-content(60%)",
                  gap: 1,
                  ...(emphasis || separate
                    ? { pt: 2, borderTop: `1px solid ${theme.ui.panelBorderSubtle}` }
                    : {}),
                }}
              >
                <FontStyle
                  component="dt"
                  fontSize={13}
                  fontWeight={emphasis ? 700 : 500}
                  sx={{ alignSelf: "center" }}
                >
                  {label}
                </FontStyle>
                <Box component="dd" sx={{ m: 0, minWidth: 0, textAlign: "right" }}>
                  <FontStyle
                    component="span"
                    fontSize={emphasis ? 16 : 13.5}
                    fontWeight={emphasis ? 700 : 600}
                    sx={{
                      m: 0,
                      display: "block",
                      textAlign: "right",
                      overflowWrap: "anywhere",
                      fontVariantNumeric: "tabular-nums",
                      color: emphasis ? theme.status.info.text : "text.primary",
                    }}
                  >
                    {value}
                  </FontStyle>
                  {secondary ? (
                    <FontStyle
                      component="span"
                      fontSize={12}
                      sx={{
                        display: "block",
                        mt: 0.5,
                        color: "text.secondary",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {secondary}
                    </FontStyle>
                  ) : null}
                </Box>
              </Box>
            ),
          )}
        </Box>
      ) : null}
      {quantityFooter}
      {action ? (
        <Box sx={{ display: "grid", gap: 3 }}>
          <Divider />
          {action}
        </Box>
      ) : null}
    </Box>
  );
}

/** Aksi kartu dengan label yang jelas, target sentuh aman, dan nama aksesibel sesuai datanya. */
export function InventoryCardAction({ label, ariaLabel, icon, onClick, loading, disabled }) {
  return (
    <Button
      block
      aria-label={ariaLabel || label}
      icon={typeof icon === "string" ? <AppIcon icon={icon} width={18} /> : icon}
      onClick={onClick}
      loading={loading}
      disabled={disabled}
      style={{
        width: "100%",
        minHeight: 44,
        height: "auto",
        padding: "10px 12px",
        whiteSpace: "normal",
        lineHeight: 1.5,
      }}
    >
      {label}
    </Button>
  );
}

/** Ikon dan pasangan nama/metadata sejajar pada satu identitas kartu. */
export function InventoryCardIdentity({ icon, title, children }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
      {icon}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <FontStyle
          component="h3"
          fontSize={14}
          fontWeight={700}
          sx={{ lineHeight: 1.4, overflowWrap: "anywhere" }}
        >
          {title}
        </FontStyle>
        {children ? (
          <Box
            sx={{
              mt: 1,
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 1,
              minWidth: 0,
            }}
          >
            {children}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
