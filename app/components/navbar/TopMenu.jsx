"use client";

import { useState } from "react";
import { Avatar, Box, IconButton, Menu, MenuItem, Paper, Tooltip, useTheme } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import FontStyle from "../font-style/FontStyle";
import SubscriptionStatus from "../subscription/SubscriptionStatus";

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export default function TopMenu({ user, onBurgerClick, onLogout }) {
  const theme = useTheme();
  const [accountAnchor, setAccountAnchor] = useState(null);
  const actionSx = {
    width: 40,
    height: 40,
    color: theme.palette.primary.main,
    bgcolor: theme.ui.iconButtonBg,
    border: `1px solid ${theme.ui.navUserBorder}`,
    "&:hover": { bgcolor: theme.ui.iconButtonHover },
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

      {/* <Box sx={{ minWidth: 0, flex: 1 }}>
        <FontStyle component="p" fontSize={{ xs: 14, sm: 15 }} fontWeight={600} noWrap>
          Sistem Informasi Tenaga Operasional Unit
        </FontStyle>
      </Box> */}

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

      <Tooltip title="Menu akun">
        <IconButton
          onClick={(event) => setAccountAnchor(event.currentTarget)}
          aria-label="Buka menu akun"
          aria-controls={accountAnchor ? "account-menu" : undefined}
          aria-expanded={accountAnchor ? "true" : undefined}
          sx={{ p: 0.25 }}
        >
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: theme.palette.primary.main,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {getInitials(user?.full_name) || "U"}
          </Avatar>
        </IconButton>
      </Tooltip>

      <Menu
        id="account-menu"
        anchorEl={accountAnchor}
        open={Boolean(accountAnchor)}
        onClose={() => setAccountAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              minWidth: 220,
              border: `1px solid ${theme.ui.navBorder}`,
              boxShadow: theme.ui.shellShadow,
            },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <FontStyle fontSize={13} fontWeight={600} noWrap>
            {user?.full_name || user?.username}
          </FontStyle>
          <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }} noWrap>
            @{user?.username}
          </FontStyle>
        </Box>
        <MenuItem
          onClick={() => {
            setAccountAnchor(null);
            onLogout();
          }}
          sx={{ gap: 1.25, color: theme.palette.error.main }}
        >
          <LogoutRoundedIcon fontSize="small" />
          <FontStyle fontSize={12.5} fontWeight={600} component="span">
            Keluar
          </FontStyle>
        </MenuItem>
      </Menu>
    </Paper>
  );
}
