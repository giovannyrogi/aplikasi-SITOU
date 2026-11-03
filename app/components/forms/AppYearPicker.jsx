"use client";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { GlobalStyles } from "@mui/material";
import { useState } from "react";

/** Numeric year contract for forms; calendar selection without manual typing. */
export default function AppYearPicker({ value, onChange, minYear, maxYear = 2200, ...props }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <GlobalStyles
        styles={{
          ".sitou-year-picker-popup": { maxWidth: "calc(100vw - 32px)" },
          ".sitou-year-picker-popup.sitou-year-picker-popup.sitou-year-picker-popup .ant-picker-panel-container":
            {
              maxHeight: "calc(100dvh - 32px)",
              overflowY: "auto",
            },
          ".sitou-year-picker-popup.sitou-year-picker-popup.sitou-year-picker-popup .ant-picker-year-panel, .sitou-year-picker-popup.sitou-year-picker-popup.sitou-year-picker-popup .ant-picker-decade-panel":
            { width: "min(280px, calc(100vw - 32px))" },
          ".sitou-year-picker-popup.sitou-year-picker-popup.sitou-year-picker-popup .ant-picker-content":
            {
              width: "100%",
              height: "auto",
              tableLayout: "fixed",
            },
          ".sitou-year-picker-popup.sitou-year-picker-popup.sitou-year-picker-popup .ant-picker-cell":
            { padding: "6px 4px" },
          ".sitou-year-picker-popup.sitou-year-picker-popup.sitou-year-picker-popup .ant-picker-cell-inner":
            {
              width: "100%",
              height: 44,
              lineHeight: "44px",
            },
          ".sitou-year-picker-popup.sitou-year-picker-popup.sitou-year-picker-popup .ant-picker-header button":
            { minWidth: 44, minHeight: 44 },
        }}
      />
      <DatePicker
        {...props}
        picker="year"
        onOpenChange={setOpen}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) event.stopPropagation();
        }}
        classNames={{ popup: { root: "sitou-year-picker-popup" } }}
        format="YYYY"
        value={value ? dayjs(`${value}-01-01`) : null}
        onChange={(date) => onChange?.(date?.year() ?? null)}
        inputReadOnly
        allowClear={false}
        placeholder="Pilih tahun"
        disabledDate={(date) => (minYear != null && date.year() < minYear) || date.year() > maxYear}
        maxDate={dayjs(`${maxYear}-12-31`)}
        style={{ width: "100%", maxWidth: 280 }}
      />
    </>
  );
}
