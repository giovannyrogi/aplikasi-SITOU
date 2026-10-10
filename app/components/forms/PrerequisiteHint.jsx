"use client";
import { Box, Link } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";
/** Arahan dekat field; navigasi diserahkan kepada pemilik form untuk menjaga isian. */
export default function PrerequisiteHint({ text, href, onNavigate, linkLabel }) {
  return (
    <Box sx={{ display: "grid", gap: 1, minWidth: 0 }}>
      <FontStyle explanation fontSize={12} sx={{ color: "text.secondary", lineHeight: 1.6 }}>
        {text}
      </FontStyle>
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
  );
}
