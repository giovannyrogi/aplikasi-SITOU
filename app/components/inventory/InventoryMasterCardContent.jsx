"use client";
import { Box } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import AppIconTile from "@/app/components/icons/AppIconTile";
import InventoryMobileCardContent, { InventoryCardIdentity } from "./InventoryMobileCardContent";
/** Identitas master memakai ikon semantik; aksi dan detail mengikuti kartu laporan Inventaris. */
export default function InventoryMasterCardContent({ name, code, active, action, icon, children }) {
  return (
    <InventoryMobileCardContent
      identity={
        <InventoryCardIdentity
          icon={<AppIconTile icon={icon} size={48} iconSize={24} />}
          title={name}
        >
          {code ? <CompactInfoChip label={code} tone="info" /> : null}
          <CompactInfoChip status={active ? "active" : "inactive"} />
        </InventoryCardIdentity>
      }
      action={action}
    >
      {children}
    </InventoryMobileCardContent>
  );
}
export function InventoryMasterCardField({ label, children, explanation = false }) {
  return (
    <Box component="dl" sx={{ m: 0, minWidth: 0 }}>
      <FontStyle component="dt" fontSize={12} sx={{ color: "text.secondary", mb: 1 }}>
        {label}
      </FontStyle>
      <Box component="dd" sx={{ m: 0, minWidth: 0 }}>
        {typeof children === "string" ? (
          <FontStyle
            explanation={explanation}
            fontSize={13.5}
            fontWeight={explanation ? 400 : 600}
            sx={{ lineHeight: 1.6, overflowWrap: "anywhere" }}
          >
            {children}
          </FontStyle>
        ) : (
          children
        )}
      </Box>
    </Box>
  );
}
