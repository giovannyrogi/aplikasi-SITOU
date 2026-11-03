"use client";

import { useRef, useState } from "react";
import { Button, TimePicker } from "antd";
import { Box } from "@mui/material";

/** Pilihan jam langsung berlaku; tombol footer hanya menutup panel. */
export default function AppTimePicker({ onOpenChange, style, ...props }) {
  const pickerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const changeOpen = (next) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <TimePicker
      {...props}
      ref={pickerRef}
      format="HH:mm"
      showNow={false}
      needConfirm={false}
      open={open}
      onOpenChange={changeOpen}
      style={{ width: "100%", ...style }}
      renderExtraFooter={() => (
        <Box sx={{ py: 1 }}>
          <Button
            type="primary"
            block
            onClick={() => {
              changeOpen(false);
              pickerRef.current?.focus();
            }}
          >
            Pilih jam
          </Button>
        </Box>
      )}
    />
  );
}
