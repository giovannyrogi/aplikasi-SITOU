"use client";

import { Drawer, useTheme } from "@mui/material";
import { usePathname } from "next/navigation";
import SidebarContent from "./SidebarContent";

export default function MobileLeftNavBar({ menus, user, open, onClose, onNavigate }) {
  const theme = useTheme();
  const pathname = usePathname();

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      slotProps={{
        paper: {
          sx: {
            width: { xs: 292, sm: 320 },
            maxWidth: "88vw",
            p: 2,
            bgcolor: theme.ui.navBg,
            borderRight: `1px solid ${theme.ui.navBorder}`,
          },
        },
      }}
    >
      <SidebarContent
        menus={menus}
        user={user}
        pathname={pathname}
        onNavigate={(path) => {
          onClose();
          onNavigate(path);
        }}
        compact
      />
    </Drawer>
  );
}
