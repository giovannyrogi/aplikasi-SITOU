"use client";

import { useState } from "react";
import {
  Avatar,
  ButtonBase,
  Box,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Tooltip,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import FontStyle from "../font-style/FontStyle";
import AppIcon from "../icons/AppIcon";
import { actorDisplayName } from "@/lib/identity/actorPresentation.mjs";
import { ROLE_LABELS } from "@/app/constants/roles";

export default function TopMenu({ user, onBurgerClick, onProfile, onLogout }) {
  const theme = useTheme();
  const [settingsAnchor, setSettingsAnchor] = useState(null);
  const settingsOpen = Boolean(settingsAnchor);
  const name = actorDisplayName(
    ["employee", "platform"].includes(user?.identity_source) ? user?.display_name : null,
    user?.username,
  );
  const position = user?.position_name || ROLE_LABELS[user?.role_code] || "Pengguna";
  const photo =
    user?.identity_source === "employee" && user?.profile_photo_file_id
      ? user.role_code === "employee"
        ? `/api/uploads/profile_self?photoVersion=${encodeURIComponent(user.profile_photo_file_id)}`
        : `/api/uploads/${encodeURIComponent(user.profile_photo_file_id)}?organizationId=${encodeURIComponent(user.organization_id)}`
      : undefined;
  const actionSx = {
    width: 44,
    height: 44,
    color: theme.palette.primary.main,
    bgcolor: theme.ui.iconButtonBg,
    border: `1px solid ${theme.ui.navUserBorder}`,
    "&:hover": { bgcolor: theme.ui.iconButtonHover },
  };
  const menuItemSx = {
    minHeight: 44,
    px: 1,
    py: 0.75,
    gap: 1.25,
    borderRadius: 0.75,
  };
  const closeAndRun = (action) => {
    setSettingsAnchor(null);
    action();
  };

  return (
    <Paper
      component="header"
      square
      elevation={0}
      sx={{
        position: "sticky",
        top: 0,
        zIndex: theme.zIndex.appBar,
        flexShrink: 0,
        minHeight: 68,
        px: { xs: 1.5, sm: 2.5, lg: 3 },
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        width: "100%",
        minWidth: 0,
        overflow: "hidden",
        bgcolor: theme.ui.topbarBg,
        borderBottom: `1px solid ${theme.ui.topbarBorder}`,
        backdropFilter: "blur(14px)",
      }}
    >
      <IconButton
        onClick={onBurgerClick}
        aria-label="Buka menu navigasi"
        sx={{ ...actionSx, display: { xs: "inline-flex", lg: "none" } }}
      >
        <MenuIcon />
      </IconButton>
      <Box sx={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
        <FontStyle
          fontSize={12}
          fontWeight={600}
          noWrap
          sx={{ display: { xs: "none", sm: "block" }, color: "text.secondary" }}
        >
          Ruang kerja SITOU
        </FontStyle>
      </Box>
      <Tooltip title="Notifikasi belum tersedia">
        <IconButton aria-label="Notifikasi belum tersedia" aria-disabled="true" sx={actionSx}>
          <AppIcon icon="account:notifications" fontSize={22} aria-hidden="true" />
        </IconButton>
      </Tooltip>
      <Tooltip title={`${name} · ${position}`}>
        <ButtonBase
          onClick={(event) => setSettingsAnchor(event.currentTarget)}
          aria-label={`Buka menu akun ${name}`}
          aria-controls={settingsOpen ? "settings-menu" : undefined}
          aria-haspopup="menu"
          aria-expanded={settingsOpen ? "true" : undefined}
          sx={{
            minHeight: 48,
            maxWidth: { xs: 212, sm: 300 },
            minWidth: 0,
            p: 0.5,
            gap: 1.5,
            borderRadius: 2,
            textAlign: "left",
            "&:hover": { bgcolor: theme.ui.navItemHover },
            "&.Mui-focusVisible": {
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: 2,
            },
          }}
        >
          <Avatar
            src={photo}
            alt={name}
            sx={{
              width: 40,
              height: 40,
              bgcolor: theme.ui.navUserBg,
              color: "primary.main",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {name
              .split(/\s+/)
              .map((word) => word[0])
              .slice(0, 2)
              .join("")}
          </Avatar>
          <Box
            sx={{
              minWidth: 0,
              height: 40,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: "2px",
              overflow: "hidden",
            }}
          >
            <FontStyle
              fontSize={12}
              fontWeight={700}
              noWrap
              sx={{
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {name}
            </FontStyle>
            <FontStyle
              fontSize={11}
              noWrap
              sx={{
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: "text.secondary",
              }}
            >
              {position}
            </FontStyle>
          </Box>
          <ExpandMoreRoundedIcon sx={{ fontSize: 18, flexShrink: 0 }} />
        </ButtonBase>
      </Tooltip>
      <Menu
        id="settings-menu"
        anchorEl={settingsAnchor}
        open={settingsOpen}
        onClose={() => setSettingsAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              mt: 1,
              width: 224,
              maxWidth: "calc(100vw - 24px)",
              p: 0.75,
              bgcolor: theme.ui.menuPaperBg,
              border: `1px solid ${theme.ui.panelBorder}`,
              borderRadius: 1,
              boxShadow: theme.ui.panelShadow,
            },
          },
          list: { sx: { p: 0 } },
        }}
      >
        <MenuItem
          onClick={() => closeAndRun(onProfile)}
          sx={{
            ...menuItemSx,
            color: theme.palette.text.primary,
            "&:hover": { bgcolor: theme.ui.navItemHover },
          }}
        >
          <Box
            component="span"
            sx={{
              width: 34,
              height: 34,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              borderRadius: 1.75,
              color: theme.palette.primary.main,
              bgcolor: theme.ui.iconButtonBg,
            }}
          >
            <AppIcon icon="account:profile" fontSize={20} aria-hidden="true" />
          </Box>
          <FontStyle component="span" fontSize={12.5} fontWeight={600}>
            Profil
          </FontStyle>
        </MenuItem>
        <Divider sx={{ my: 0.75, mx: 0.5, borderColor: theme.ui.panelBorder }} />
        <MenuItem
          onClick={() => closeAndRun(onLogout)}
          sx={{
            ...menuItemSx,
            color: theme.status.danger.text,
            "&:hover": { bgcolor: theme.status.danger.background },
          }}
        >
          <Box
            component="span"
            sx={{
              width: 34,
              height: 34,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              borderRadius: 1.75,
              color: theme.status.danger.main,
              bgcolor: theme.status.danger.background,
            }}
          >
            <AppIcon icon="account:logout" fontSize={20} aria-hidden="true" />
          </Box>
          <FontStyle component="span" fontSize={12.5} fontWeight={600}>
            Keluar
          </FontStyle>
        </MenuItem>
      </Menu>
    </Paper>
  );
}
