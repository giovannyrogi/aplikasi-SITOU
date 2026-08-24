"use client";

import { useState } from "react";
import { Box, IconButton, Menu, MenuItem, Paper, Tooltip, useTheme } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import FontStyle from "../font-style/FontStyle";
import SubscriptionStatus from "../subscription/SubscriptionStatus";

export default function TopMenu({ user, onBurgerClick, onProfile, onLogout }) {
  const theme = useTheme();
  const [settingsAnchor, setSettingsAnchor] = useState(null);
  const settingsOpen = Boolean(settingsAnchor);
  const actionSx = {
    width: 40,
    height: 40,
    color: theme.palette.primary.main,
    bgcolor: theme.ui.iconButtonBg,
    border: `1px solid ${theme.ui.navUserBorder}`,
    "&:hover": { bgcolor: theme.ui.iconButtonHover },
  };
  const menuItemSx = {
    minHeight: 46,
    px: 1.25,
    py: 0.75,
    gap: 1.25,
    borderRadius: 2,
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
        <SubscriptionStatus
          status={user?.organization_subscription_status}
          endsOn={user?.organization_subscription_ends_on}
          graceEndsOn={user?.organization_subscription_grace_ends_on}
          daysRemaining={user?.organization_days_remaining}
        />
      </Box>
      <Tooltip title="Notifikasi belum tersedia">
        <IconButton aria-label="Notifikasi belum tersedia" aria-disabled="true" sx={actionSx}>
          <NotificationsNoneRoundedIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Pengaturan">
        <IconButton
          onClick={(event) => setSettingsAnchor(event.currentTarget)}
          aria-label="Buka pengaturan"
          aria-controls={settingsOpen ? "settings-menu" : undefined}
          aria-haspopup="menu"
          aria-expanded={settingsOpen ? "true" : undefined}
          sx={actionSx}
        >
          <SettingsRoundedIcon />
        </IconButton>
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
              width: 216,
              maxWidth: "calc(100vw - 24px)",
              p: 0.5,
              bgcolor: theme.ui.menuPaperBg,
              border: `1px solid ${theme.ui.panelBorder}`,
              borderRadius: 2.5,
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
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              borderRadius: 1.75,
              color: theme.palette.primary.main,
              bgcolor: theme.ui.iconButtonBg,
            }}
          >
            <PersonOutlineRoundedIcon sx={{ fontSize: 18 }} />
          </Box>
          <FontStyle component="span" fontSize={12.5} fontWeight={600}>
            Profil
          </FontStyle>
        </MenuItem>
        <MenuItem
          onClick={() => closeAndRun(onLogout)}
          sx={{
            ...menuItemSx,
            mt: 0.25,
            color: theme.status.danger.text,
            "&:hover": { bgcolor: theme.status.danger.background },
          }}
        >
          <Box
            component="span"
            sx={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              borderRadius: 1.75,
              color: theme.status.danger.main,
              bgcolor: theme.status.danger.background,
            }}
          >
            <LogoutRoundedIcon sx={{ fontSize: 18 }} />
          </Box>
          <FontStyle component="span" fontSize={12.5} fontWeight={600}>
            Keluar
          </FontStyle>
        </MenuItem>
      </Menu>
    </Paper>
  );
}