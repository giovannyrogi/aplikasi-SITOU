"use client";
import { Button, Tooltip } from "antd";

/** Compact actions retain a named 44px target and hover/keyboard help. */
export default function IconActionButton({ label, icon, disabled = false, ...props }) {
  return (
    <Tooltip title={label} trigger={["hover", "focus"]}>
      <span style={{ display: "inline-flex", flexShrink: 0 }}>
        <Button
          {...props}
          icon={icon}
          aria-label={label}
          disabled={disabled}
          style={{ minWidth: 44, width: 44, minHeight: 44, padding: 0 }}
        />
      </span>
    </Tooltip>
  );
}
