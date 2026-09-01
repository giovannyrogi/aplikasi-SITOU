"use client";

import { Button, Dropdown } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import { Box, useTheme } from "@mui/material";

export default function RowActionMenu({ items }) {
  const theme = useTheme();
  const menuItems = (items || []).flatMap((item, index) => {
    const previous = items[index - 1];
    const needsDangerDivider =
      item?.danger && index > 0 && !previous?.danger && previous?.type !== "divider";
    return needsDangerDivider
      ? [{ type: "divider", key: `danger-divider-${item.key || index}` }, item]
      : [item];
  });

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={["click"]}
      placement="bottomRight"
      popupRender={(menu) => (
        <Box
          sx={{
            "& .ant-dropdown-menu": {
              minWidth: 208,
              p: 0.75,
              border: `1px solid ${theme.ui.panelBorder}`,
              borderRadius: 1,
              bgcolor: theme.ui.menuPaperBg,
              boxShadow: theme.ui.panelShadow,
            },
            "& .ant-dropdown-menu-item": {
              minHeight: 40,
              px: 1.25,
              py: 0.875,
              gap: 1.25,
              borderRadius: 0.75,
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.45,
            },
            "& .ant-dropdown-menu-item + .ant-dropdown-menu-item": { mt: 0.25 },
            "& .ant-dropdown-menu-item-icon": {
              minWidth: 20,
              fontSize: 18,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            },
            "& .ant-dropdown-menu-item-icon svg": { width: 18, height: 18 },
            "& .ant-dropdown-menu-item-divider": {
              my: 0.75,
              mx: 0.5,
              borderColor: theme.ui.panelBorder,
            },
          }}
        >
          {menu}
        </Box>
      )}
    >
      <Button
        icon={<MenuOutlined style={{ fontSize: 20 }} />}
        aria-label="Buka menu aksi"
        aria-haspopup="menu"
        title="Menu aksi"
        style={{ width: 36, height: 36, padding: 0 }}
      />
    </Dropdown>
  );
}
