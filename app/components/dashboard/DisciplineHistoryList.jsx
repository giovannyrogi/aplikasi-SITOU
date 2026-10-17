"use client";
import { Box, ButtonBase, useTheme } from "@mui/material";
import dayjs from "dayjs";
import AppIcon from "@/app/components/icons/AppIcon";
import AppIconTile from "@/app/components/icons/AppIconTile";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import { ACTION_STATUS } from "@/app/components/discipline/disciplineLabels";

export default function DisciplineHistoryList({ items, onOpen, opening, buttonRefs }) {
  const theme = useTheme();
  if (!items.length)
    return (
      <FontStyle fontSize={13} sx={{ p: 3, color: "text.secondary", textAlign: "center" }}>
        Belum ada sanksi atau teguran yang tercatat.
      </FontStyle>
    );
  return (
    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
      {items.map((row) => {
        const status = ACTION_STATUS[row.status] || [row.status, "neutral"];
        return (
          <Box component="li" key={row.id} sx={{ borderTop: "1px solid", borderColor: "divider", "&:first-of-type": { borderTop: 0 } }}>
            <ButtonBase
              ref={(node) => {
                if (buttonRefs) buttonRefs.current[row.id] = node;
              }}
              disabled={opening}
              onClick={() => onOpen(row)}
              aria-label={`Rincian ${row.name}, ${status[0]}`}
              sx={{
                width: "100%",
                p: { xs: 2, sm: 3 },
                display: "grid",
                gridTemplateColumns: "40px minmax(0,1fr) auto 18px",
                alignItems: "center",
                gap: 1.5,
                textAlign: "left",
                "&:hover": { bgcolor: theme.ui.panelSubtleBg },
                "&.Mui-focusVisible": {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: -2,
                },
              }}
            >
              <AppIconTile icon="solar:shield-check-bold-duotone" tone="brand" />
              <Box sx={{ minWidth: 0 }}>
                <FontStyle fontSize={14} fontWeight={600} sx={{ overflowWrap: "anywhere" }}>
                  {row.name}
                </FontStyle>
                <FontStyle fontSize={12} sx={{ mt: 1, color: "text.secondary" }}>
                  {dayjs(row.start_date).format("D MMM YYYY")} –{" "}
                  {row.end_date ? dayjs(row.end_date).format("D MMM YYYY") : "Tanpa batas waktu"}
                </FontStyle>
              </Box>
              <Box sx={{ justifySelf: "center" }}>
                <CompactInfoChip label={status[0]} tone={status[1]} />
              </Box>
              <Box sx={{ color: "primary.main", display: "flex" }}>
                <AppIcon icon="action:chevron-right" width={18} />
              </Box>
            </ButtonBase>
          </Box>
        );
      })}
    </Box>
  );
}
