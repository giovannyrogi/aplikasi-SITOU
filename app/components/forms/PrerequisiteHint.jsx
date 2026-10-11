"use client";
import { Box, Link } from "@mui/material";
import AppNotice from "@/app/components/data-display/AppNotice";
/** Arahan dekat field; navigasi diserahkan kepada pemilik form untuk menjaga isian. */
export default function PrerequisiteHint({ text, href, onNavigate, linkLabel }) {
  return (
    <AppNotice compact tone="warning" title="Prasyarat belum tersedia">
      <Box sx={{ display: "grid", gap: 1, minWidth: 0 }}>
        <Box component="span" data-prerequisite-text>
          {text}
        </Box>
        {href && onNavigate ? (
          <Link
            component="button"
            type="button"
            onClick={() => onNavigate(href)}
            sx={{
              justifySelf: "start",
              textAlign: "left",
              fontSize: 12,
              minHeight: 44,
              minWidth: 44,
              py: 0.75,
            }}
          >
            {linkLabel}
          </Link>
        ) : null}
      </Box>
    </AppNotice>
  );
}
