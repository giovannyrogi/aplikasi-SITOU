"use client";
import { Box } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";

export default function ScheduleChoiceOption({ option }) {
  return (
    <Box sx={{ minWidth: 0, py: 0.5 }}>
      <FontStyle fontSize={14} color="inherit">
        {option.data.displayName}
      </FontStyle>
      {option.data.disabled && (
        <FontStyle fontSize={13} color="text.secondary" sx={{ mt: 0.5 }}>
          {option.data.disabledReason || "Tidak dapat dipilih"}
        </FontStyle>
      )}
    </Box>
  );
}
