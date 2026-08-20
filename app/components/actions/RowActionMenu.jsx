"use client";

import { Button, Dropdown } from "antd";
import { MoreOutlined } from "@ant-design/icons";

export default function RowActionMenu({ items }) {
  return (
    <Dropdown menu={{ items }} trigger={["click"]}>
      <Button type="text" icon={<MoreOutlined />} aria-label="Buka menu tindakan" />
    </Dropdown>
  );
}
