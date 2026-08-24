"use client";

import { useState } from "react";
import {
  Avatar,
  Box,
  Collapse,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
} from "@mui/material";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { ROLE_LABELS } from "@/app/constants/roles";
import FontStyle from "../font-style/FontStyle";
import AppLogo from "../branding/AppLogo";

const APP_VERSION = "v0.1.0";

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

const isPathActive = (pathname, path) =>
  Boolean(path) &&
  (pathname === path || (path !== "/dashboard" && pathname.startsWith(`${path}/`)));

export default function SidebarContent({ menus, user, pathname, onNavigate, compact = false }) {
  const theme = useTheme();
  const activeParent = menus.find((menu) =>
    menu.submenu?.some((submenu) => isPathActive(pathname, submenu.path)),
  );
  const [openDropdown, setOpenDropdown] = useState(activeParent?.value || null);

  const menuButtonSx = (active, nested = false) => ({
    minHeight: nested ? 42 : 46,
    my: 0.35,
    px: nested ? 1.25 : 1.4,
    borderRadius: 2,
    color: active ? theme.palette.primary.main : theme.palette.text.primary,
    bgcolor: active ? theme.ui.navItemActive : "transparent",
    border: `1px solid ${active ? theme.ui.navUserBorder : "transparent"}`,
    transition: "background-color 180ms ease, border-color 180ms ease",
    "&:hover": {
      bgcolor: theme.ui.navItemHover,
      borderColor: theme.ui.navUserBorder,
    },
    "& .MuiListItemIcon-root": {
      minWidth: nested ? 38 : 42,
      color: active ? theme.palette.primary.main : theme.ui.navIconColor,
    },
  });

  return (
    <Box sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          minHeight: 58,
          px: compact ? 0.5 : 1,
          pb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <AppLogo
          variant="full"
          alt="SITOU"
          width={164}
          height={58}
          priority
          style={{ width: compact ? 145 : 158, height: "auto", objectFit: "contain" }}
        />
        <FontStyle fontSize={10} fontWeight={600} sx={{ color: theme.palette.primary.main }}>
          {APP_VERSION}
        </FontStyle>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "42px minmax(0, 1fr)",
          gap: 1.25,
          alignItems: "center",
          p: 1.25,
          mb: 2,
          borderRadius: 2,
          bgcolor: theme.ui.navUserBg,
          border: `1px solid ${theme.ui.navUserBorder}`,
        }}
      >
        <Avatar
          sx={{
            width: 42,
            height: 42,
            color: theme.palette.primary.main,
            bgcolor: theme.ui.iconButtonBg,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {getInitials(user?.display_name) || "U"}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <FontStyle fontSize={12.5} fontWeight={600} noWrap title={user?.display_name || ""}>
            {user?.display_name || user?.username || "Pengguna"}
          </FontStyle>
          <FontStyle
            fontSize={11}
            fontWeight={500}
            noWrap
            sx={{ mt: 0.25, color: theme.palette.primary.main }}
          >
            {ROLE_LABELS[user?.role_code] || user?.role_code || "-"}
          </FontStyle>
        </Box>
      </Box>

      <Divider sx={{ mb: 2, borderColor: theme.ui.navDivider }} />
      <FontStyle
        fontSize={10.5}
        fontWeight={600}
        sx={{ px: 0.5, mb: 0.75, color: theme.ui.mutedText, textTransform: "uppercase" }}
      >
        Navigasi
      </FontStyle>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 0.25 }}>
        <List disablePadding>
          {menus.map((menu) => {
            const active = menu.submenu
              ? menu.submenu.some((submenu) => isPathActive(pathname, submenu.path))
              : isPathActive(pathname, menu.path);
            const expanded = openDropdown === menu.value;

            return (
              <Box component="li" key={menu.value} sx={{ listStyle: "none" }}>
                <ListItem component="div" disablePadding>
                  <ListItemButton
                    selected={active}
                    onClick={() =>
                      menu.submenu
                        ? setOpenDropdown(expanded ? null : menu.value)
                        : onNavigate(menu.path)
                    }
                    sx={menuButtonSx(active)}
                  >
                    <ListItemIcon>{menu.icon}</ListItemIcon>
                    <ListItemText
                      primary={
                        <FontStyle
                          component="span"
                          fontSize={12.5}
                          fontWeight={active ? 600 : 500}
                          noWrap
                        >
                          {menu.label}
                        </FontStyle>
                      }
                    />
                    {menu.submenu ? (
                      expanded ? (
                        <ExpandLessRoundedIcon />
                      ) : (
                        <ExpandMoreRoundedIcon />
                      )
                    ) : null}
                  </ListItemButton>
                </ListItem>

                {menu.submenu ? (
                  <Collapse in={expanded} timeout={180} unmountOnExit>
                    <List
                      disablePadding
                      sx={{ ml: 1.5, pl: 1.25, borderLeft: `1px solid ${theme.ui.navSubmenuLine}` }}
                    >
                      {menu.submenu.map((submenu) => {
                        const submenuActive = isPathActive(pathname, submenu.path);
                        return (
                          <ListItem disablePadding key={submenu.value}>
                            <ListItemButton
                              selected={submenuActive}
                              onClick={() => onNavigate(submenu.path)}
                              sx={menuButtonSx(submenuActive, true)}
                            >
                              {submenu.showIcon ? (
                                <ListItemIcon>{submenu.icon}</ListItemIcon>
                              ) : null}
                              <ListItemText
                                primary={
                                  <FontStyle
                                    component="span"
                                    fontSize={12}
                                    fontWeight={submenuActive ? 600 : 500}
                                    noWrap
                                  >
                                    {submenu.label}
                                  </FontStyle>
                                }
                              />
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                    </List>
                  </Collapse>
                ) : null}
              </Box>
            );
          })}
        </List>
      </Box>
    </Box>
  );
}
