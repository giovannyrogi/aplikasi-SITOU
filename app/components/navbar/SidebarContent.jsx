"use client";

import { useId, useState } from "react";
import {
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
import FontStyle from "../font-style/FontStyle";
import AppLogo from "../branding/AppLogo";
import AppIconTile from "../icons/AppIconTile";
import SubscriptionAccessCard from "../subscription/SubscriptionAccessCard";
import { sidebarGroups } from "./sidebarGroups.mjs";

const APP_VERSION = "v0.1.0";

const isPathActive = (pathname, path) =>
  Boolean(path) &&
  (pathname === path || (path !== "/dashboard" && pathname.startsWith(`${path}/`)));

export default function SidebarContent({
  menus,
  user,
  pathname,
  onNavigate,
  onRenew,
  compact = false,
}) {
  const theme = useTheme();
  const navigationId = useId();
  const activeParent = menus.find((menu) =>
    menu.submenu?.some((submenu) => isPathActive(pathname, submenu.path)),
  );
  const [dropdownOverride, setDropdownOverride] = useState(null);
  const openDropdown =
    dropdownOverride?.pathname === pathname ? dropdownOverride.value : activeParent?.value || null;

  const menuButtonSx = (active, nested = false) => ({
    minHeight: nested ? 44 : 46,
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

  const renderSubmenu = (submenu) => {
    const active = isPathActive(pathname, submenu.path);
    return (
      <ListItem disablePadding key={submenu.value}>
        <ListItemButton
          selected={active}
          aria-current={active ? "page" : undefined}
          onClick={() => onNavigate(submenu.path)}
          sx={menuButtonSx(active, true)}
        >
          {submenu.showIcon ? <ListItemIcon>{submenu.icon}</ListItemIcon> : null}
          <ListItemText
            primary={
              <FontStyle
                component="span"
                fontSize={12}
                fontWeight={active ? 600 : 500}
                sx={{ lineHeight: 1.45, overflowWrap: "anywhere" }}
              >
                {submenu.label}
              </FontStyle>
            }
          />
        </ListItemButton>
      </ListItem>
    );
  };

  return (
    <Box
      sx={{
        height: "100%",
        minHeight: 0,
        overflowY: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        "&::-webkit-scrollbar": { display: "none", width: 0, height: 0 },
        overscrollBehaviorY: "contain",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          minHeight: 58,
          flexShrink: 0,
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
          flexShrink: 0,
          display: "flex",
          gap: 1.5,
          alignItems: "center",
          p: 2,
          mb: 2,
          borderRadius: 2,
          border: "1px solid",
          borderColor: theme.ui.panelBorderSubtle,
          bgcolor: theme.ui.panelSubtleBg,
        }}
      >
        <AppIconTile icon="navigation:organization" size={36} iconSize={18} />
        <Box sx={{ minWidth: 0, display: "grid", alignContent: "center", gap: 0.25 }}>
          <FontStyle
            fontSize={12}
            fontWeight={700}
            sx={{ lineHeight: 1.35, overflowWrap: "anywhere" }}
          >
            {user?.organization_name || "Administrasi SITOU"}
          </FontStyle>
          <FontStyle
            fontSize={11}
            sx={{ lineHeight: 1.35, color: "text.secondary", overflowWrap: "anywhere" }}
          >
            {user?.location_name ||
              (user?.organization_id ? "Ruang kerja organisasi" : "Pengelolaan platform")}
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

      <Box
        component="nav"
        className="hide-scrollbar"
        aria-label="Navigasi utama"
        sx={{
          flex: "1 0 auto",
          minHeight: 0,
          overflow: "visible",
          pr: 0.25,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          "&::-webkit-scrollbar": { display: "none", width: 0, height: 0 },
        }}
      >
        <List disablePadding>
          {menus.map((menu) => {
            const active = menu.submenu
              ? menu.submenu.some((submenu) => isPathActive(pathname, submenu.path))
              : isPathActive(pathname, menu.path);
            const expanded = openDropdown === menu.value;
            const submenuId = `${navigationId}-${menu.value}`;
            const groups = menu.submenu ? sidebarGroups(menu.submenu) : [];
            const showGroups = new Set(groups.map((group) => group.label)).size > 1;

            return (
              <Box component="li" key={menu.value} sx={{ listStyle: "none" }}>
                <ListItem component="div" disablePadding>
                  <ListItemButton
                    selected={active}
                    aria-expanded={menu.submenu ? expanded : undefined}
                    aria-controls={menu.submenu && expanded ? submenuId : undefined}
                    aria-current={!menu.submenu && active ? "page" : undefined}
                    onClick={() =>
                      menu.submenu
                        ? setDropdownOverride({ pathname, value: expanded ? null : menu.value })
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
                  <Collapse id={submenuId} in={expanded} timeout={180} unmountOnExit>
                    <List
                      disablePadding
                      aria-label={menu.label}
                      sx={{ ml: 1.5, pl: 1.25, borderLeft: `1px solid ${theme.ui.navSubmenuLine}` }}
                    >
                      {showGroups
                        ? groups.map((group, index) => (
                            <Box
                              component="li"
                              key={`${group.label}-${index}`}
                              sx={{ listStyle: "none" }}
                            >
                              <FontStyle
                                component="div"
                                fontSize={10.5}
                                fontWeight={600}
                                sx={{
                                  color: theme.palette.text.secondary,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                  mx: 1.25,
                                  pt: 1.5,
                                  pb: 0.75,
                                  ...(index
                                    ? {
                                        mt: 1,
                                        borderTop: `1px solid ${theme.ui.panelBorderSubtle}`,
                                      }
                                    : {}),
                                }}
                              >
                                {group.label}
                              </FontStyle>
                              <List disablePadding aria-label={`${menu.label} — ${group.label}`}>
                                {group.items.map(renderSubmenu)}
                              </List>
                            </Box>
                          ))
                        : menu.submenu.map(renderSubmenu)}
                    </List>
                  </Collapse>
                ) : null}
              </Box>
            );
          })}
        </List>
      </Box>
      <Box sx={{ mt: "auto", pt: 2, flexShrink: 0 }}>
        <SubscriptionAccessCard user={user} onRenew={onRenew} />
      </Box>
    </Box>
  );
}
