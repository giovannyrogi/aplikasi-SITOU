"use client";

import { Box, useTheme } from "@mui/material";
import AppIcon from "@/app/components/icons/AppIcon";
import FontStyle from "@/app/components/font-style/FontStyle";

const icons = {
  info: "solar:info-circle-bold",
  warning: "solar:danger-triangle-bold",
  success: "solar:check-circle-bold",
  danger: "solar:close-circle-bold",
};

/** Informasi menetap pada halaman/modal; toast sementara tetap memakai Notification. */
export default function AppNotice({
  tone = "info",
  title,
  description,
  children,
  action,
  compact = false,
  descriptionAlign = "justify",
  sx,
  style,
  className,
  role,
  descriptionId,
}) {
  const theme = useTheme();
  const palette = theme.status[tone] || theme.status.info;

  return (
    <Box
      role={role || (tone === "danger" ? "alert" : "status")}
      aria-label={role === "group" ? title : undefined}
      className={className}
      style={style}
      sx={[
        {
          display: "flex",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: compact ? 1 : 1.5,
          minWidth: 0,
          p: compact ? 1.5 : 2,
          border: "1px solid",
          borderColor: palette.border,
          borderRadius: 1,
          bgcolor: palette.background,
          color: "text.primary",
          overflowWrap: "anywhere",
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <AppIcon
        icon={icons[tone] || icons.info}
        fontSize={compact ? "18px" : "22px"}
        style={{ color: palette.main, flexShrink: 0, marginTop: compact ? 1 : 2 }}
        aria-hidden="true"
      />
      <Box
        sx={{
          display: "grid",
          gap: compact ? 0.5 : 0.75,
          flex: compact ? "1 1 0" : "1 1 180px",
          minWidth: 0,
        }}
      >
        {title ? (
          <FontStyle fontSize={compact ? 12 : 13.5} fontWeight={700} sx={{ lineHeight: 1.5 }}>
            {title}
          </FontStyle>
        ) : null}
        {description || children ? (
          <FontStyle
            id={descriptionId}
            explanation
            component="div"
            fontSize={compact ? 12 : 13}
            sx={{ lineHeight: 1.6, textAlign: descriptionAlign }}
          >
            {description || children}
          </FontStyle>
        ) : null}
      </Box>
      {action ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            minHeight: 44,
            minWidth: 0,
            ml: "auto",
            flexShrink: 0,
          }}
        >
          {action}
        </Box>
      ) : null}
    </Box>
  );
}
