"use client";
import { Button } from "antd";
import { Box } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";

export default function CatalogDocument({ catalog, organizationId }) {
  if (!catalog?.document) return null;
  const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
  const url = `/api/holiday-catalogs/${catalog.id}/document${query}`;
  return (
    <Box sx={{ display: "grid", gap: 1.5, minWidth: 0 }}>
      <FontStyle fontWeight={600}>
        Dokumen SKB · {catalog.year} · Revisi {catalog.revision}
      </FontStyle>
      <FontStyle sx={{ overflowWrap: "anywhere" }}>
        {catalog.document.original_name} ·{" "}
        {(Number(catalog.document.size_bytes) / 1024 / 1024).toFixed(1)} MB
      </FontStyle>
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        <Button href={url} target="_blank" rel="noopener noreferrer">
          Lihat PDF
        </Button>
        <Button
          href={`${url}${query ? "&" : "?"}download=1`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Unduh PDF
        </Button>
      </Box>
    </Box>
  );
}
