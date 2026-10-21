"use client";

import { Box, useTheme } from "@mui/material";
import { IdcardOutlined } from "@ant-design/icons";
import FontStyle from "@/app/components/font-style/FontStyle";
import AppIconTile from "@/app/components/icons/AppIconTile";

/** Field ringkasan membedakan label dan nilai serta menjaga teks panjang tetap terbaca. */
export function InfoField({ label, value, valueContent, icon, readable = false, sx }) {
  const theme = useTheme();
  return (
    <Box component="dl" sx={{ m: 0, minWidth: 0, ...sx }}>
      <Box
        component="dt"
        sx={{ m: 0, display: "flex", alignItems: "center", gap: 0.75, color: theme.ui.mutedText }}
      >
        {icon}
        <FontStyle
          component="span"
          fontSize={readable ? 12 : 11.5}
          fontWeight={readable ? 500 : 600}
        >
          {label}
        </FontStyle>
      </Box>
      {valueContent ? (
        <Box component="dd" sx={{ m: 0, mt: readable ? 1 : 0.65 }}>
          {valueContent}
        </Box>
      ) : (
        <FontStyle
          component="dd"
          fontSize={readable ? 14 : 13}
          fontWeight={600}
          sx={{
            m: 0,
            mt: readable ? 1 : 0.65,
            lineHeight: readable ? 1.6 : 1.55,
            overflowWrap: "anywhere",
          }}
        >
          {value || (readable ? "Belum diisi" : "Belum ditentukan")}
        </FontStyle>
      )}
    </Box>
  );
}

/** Section ringkasan mengelompokkan data berdasarkan kebutuhan pengguna. */
export function SummarySection({ icon, title, action, children, contentSx, panel = false, sx }) {
  const theme = useTheme();
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{
        minWidth: 0,
        ...(panel
          ? {
              p: { xs: 2, sm: 3 },
              border: `1px solid ${theme.ui.panelBorderSubtle}`,
              borderRadius: 2,
              background: theme.ui.employeeSummary.panelBackground,
              boxShadow: theme.ui.employeeSummary.panelShadow,
            }
          : {}),
        ...sx,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
          pb: 1.25,
          borderBottom: `1px solid ${theme.ui.panelBorderSubtle}`,
        }}
      >
        <AppIconTile
          icon={icon}
          size={36}
          iconSize={18}
          sx={{
            ...(panel ? { boxShadow: theme.ui.employeeSummary.iconShadow } : {}),
            "& .anticon": { fontSize: 18, lineHeight: 0 },
          }}
        />
        <FontStyle component="h3" fontSize={14} fontWeight={700} sx={{ minWidth: 0 }}>
          {title}
        </FontStyle>
        {action ? (
          <Box
            sx={{
              ml: "auto",
              flexShrink: 0,
              ...(panel
                ? {
                    width: { xs: "100%", sm: "auto" },
                    mt: { xs: 1, sm: 0 },
                    "& .ant-btn": { minHeight: 44, width: { xs: "100%", sm: "auto" } },
                  }
                : {}),
            }}
          >
            {action}
          </Box>
        ) : null}
      </Box>
      <Box
        sx={{
          mt: 2,
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
          gap: panel ? 3 : 2.25,
          ...contentSx,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

/** Bukti visual menampilkan thumbnail privat dan membuka gambar melalui preview reusable. */
export function VisualIdentity({
  title,
  file,
  aspectRatio,
  frameWidth,
  emptyText,
  organizationId,
  onPreview,
  objectFit = "contain",
  frameless = false,
  sx,
}) {
  const theme = useTheme();
  const fileId = file?.id || file?.document_file_id;
  const imageUrl = fileId
    ? `/api/uploads/${fileId}?organizationId=${encodeURIComponent(organizationId)}`
    : null;

  return (
    <Box sx={{ minWidth: 0, ...sx }}>
      <FontStyle fontSize={11.5} fontWeight={700} sx={{ mb: 1 }}>
        {title}
      </FontStyle>
      {imageUrl ? (
        <Box
          component="button"
          type="button"
          onClick={() => onPreview({ title, imageUrl, alt: `${title} pegawai` })}
          aria-label={`Perbesar ${title.toLowerCase()}`}
          sx={{
            width: "100%",
            maxWidth: frameWidth,
            aspectRatio,
            p: 0,
            display: "block",
            overflow: "hidden",
            cursor: "zoom-in",
            bgcolor: frameless ? "transparent" : theme.ui.panelSubtleBg,
            border: frameless ? "none" : `1px solid ${theme.ui.panelBorder}`,
            borderRadius: "8px",
            transition: frameless ? "opacity 160ms ease" : "border-color 160ms ease",
            "&:hover": frameless ? { opacity: 0.94 } : { borderColor: theme.ui.panelBorder },
            "&:focus-visible": {
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: 3,
            },
            "&:focus:not(:focus-visible)": {
              outline: "none",
            },
          }}
        >
          {/* Endpoint privat tidak kompatibel dengan optimasi next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={title}
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              objectFit,
            }}
          />
        </Box>
      ) : (
        <Box
          sx={{
            width: "100%",
            maxWidth: frameWidth,
            aspectRatio,
            display: "grid",
            placeItems: "center",
            px: 2,
            textAlign: "center",
            bgcolor: theme.ui.panelSubtleBg,
            border: `1px dashed ${theme.ui.panelBorder}`,
            borderRadius: "8px",
          }}
        >
          <Box>
            <IdcardOutlined style={{ color: theme.ui.mutedText, fontSize: 24 }} />
            <FontStyle fontSize={11.5} sx={{ mt: 1, color: theme.ui.mutedText }}>
              {emptyText}
            </FontStyle>
          </Box>
        </Box>
      )}
    </Box>
  );
}
