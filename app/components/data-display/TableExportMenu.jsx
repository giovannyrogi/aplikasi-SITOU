"use client";

import { useState } from "react";
import { Button, Dropdown, Tooltip } from "antd";
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined } from "@ant-design/icons";
import { useMediaQuery } from "@mui/material";
import Notification from "../Notifications/Notification";
import { useLoadingBackdrop } from "../loading/LoadingBackdropProvider";

export default function TableExportMenu({ enabled = false, onExcel, onPdf, loading, disabled }) {
  const compact = useMediaQuery("(max-width:1023px)");
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const [notice, setNotice] = useState(null);

  if (!enabled) return null;

  const download = async (format, handler) => {
    if (!handler || loading || disabled) return;

    try {
      await runWithLoadingBackdrop(() => handler(), {
        message: `Menyiapkan file ${format}...`,
      });
    } catch {
      setNotice({
        severity: "error",
        message: `File ${format} tidak dapat diunduh. Silakan coba kembali.`,
      });
    }
  };

  const handleMenuClick = ({ key }) => {
    if (key === "excel") {
      void download("Excel", onExcel);
      return;
    }

    if (onPdf) {
      void download("PDF", onPdf);
      return;
    }

    setNotice({ severity: "info", message: "Coming soon. Ekspor PDF belum tersedia." });
  };

  return (
    <>
      <Dropdown
        trigger={["click"]}
        disabled={disabled || loading}
        menu={{
          items: [
            { key: "excel", icon: <FileExcelOutlined />, label: "Unduh Excel", disabled: !onExcel },
            { key: "pdf", icon: <FilePdfOutlined />, label: "Unduh PDF" },
          ],
          onClick: handleMenuClick,
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
        open={Boolean(notice)}
        severity={notice?.severity || "info"}
        message={notice?.message || ""}
        onClose={() => setNotice(null)}
      />
    </>
  );
}
