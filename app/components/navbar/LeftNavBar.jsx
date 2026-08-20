"use client";

import { Paper, useTheme } from "@mui/material";
import { usePathname } from "next/navigation";
import SidebarContent from "./SidebarContent";

export default function LeftNavBar({ menus, user, onNavigate }) {
  const theme = useTheme();
  const pathname = usePathname();

  return (
    <Paper
      component="aside"
      square
      elevation={0}
      sx={{
        width: 280,
        height: "100dvh",
        p: 2.25,
        bgcolor: theme.ui.navBg,
        borderRight: `1px solid ${theme.ui.navBorder}`,
      }}
    >
      <SidebarContent menus={menus} user={user} pathname={pathname} onNavigate={onNavigate} />
    </Paper>
  );
}
