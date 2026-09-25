"use client";

import { useState } from "react";
import { Button, Dropdown, Tooltip } from "antd";
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined } from "@ant-design/icons";
import { useMediaQuery } from "@mui/material";
import Notification from "../Notifications/Notification";

export default function TableExportMenu({ enabled = false, onExcel, loading, disabled }) {
  const compact = useMediaQuery("(max-width:1023px)");
  const [notice, setNotice] = useState(false);
  if (!enabled) return null;
  return (
    <>
      <Dropdown
        trigger={["click"]}
        menu={{
          items: [
            { key: "excel", icon: <FileExcelOutlined />, label: "Unduh Excel", disabled: !onExcel },
            { key: "pdf", icon: <FilePdfOutlined />, label: "Unduh PDF — Segera hadir" },
          ],
          onClick: ({ key }) => (key === "excel" ? onExcel?.() : setNotice(true)),
        }}
      >
        <Tooltip title={compact ? "Export" : undefined}>
          <Button
            type="primary"
            icon={<DownloadOutlined style={{ fontSize: 20 }} />}
            aria-label="Export"
            loading={loading}
            disabled={disabled || loading}
            style={{ minWidth: 44, height: 44 }}
          >
            {compact ? null : "Export"}
          </Button>
        </Tooltip>
      </Dropdown>
      <Notification
        open={notice}
        severity="info"
        message="Segera hadir. Ekspor PDF belum tersedia."
        onClose={() => setNotice(false)}
      />
    </>
  );
}
