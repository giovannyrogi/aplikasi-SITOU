"use client";

import { Button, Dropdown } from "antd";
import { MenuOutlined } from "@ant-design/icons";

export default function RowActionMenu({ items }) {
  return (
    <Dropdown menu={{ items }} trigger={["click"]}>
      <Button
        icon={<MenuOutlined style={{ fontSize: 18 }} />}
        aria-label="Buka menu aksi"
        aria-haspopup="menu"
        title="Menu aksi"
        style={{ width: 36, height: 36, padding: 0 }}
      />
    </Dropdown>
  );
}
