"use client";
import AppIconTile from "@/app/components/icons/AppIconTile";
import { Box, Skeleton, useTheme } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";

/** Waktu mengikuti organisasi agar konsisten meskipun perangkat berada di zona berbeda. */
function formatActivityTime(item) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: item.timezone || "Asia/Makassar",
  }).format(new Date(item.occurredAt));
}

/** Baris bersama ringkasan dan modal, hanya menampilkan metadata publik terpilih. */
export default function DashboardActivityRows({ items = [], loading, spacing = 2 }) {
  const theme = useTheme();
  return (
    <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0, mt: spacing }}>
      {loading ? (
        [1, 2, 3].map((item) => (
          <Box component="li" key={item} sx={{ py: 1.5 }}>
            <Skeleton />
            <Skeleton width="58%" />
          </Box>
        ))
      ) : items.length ? (
        items.map((item) => (
          <Box
            component="li"
            key={item.id}
            sx={{
              py: 1.75,
              borderTop: `1px solid ${theme.ui.panelBorderSubtle}`,
              display: "grid",
              gridTemplateColumns: "36px minmax(0, 1fr)",
              gap: 1.5,
            }}
          >
            <AppIconTile
              icon={item.icon || "activity:history"}
              tone={item.tone || "neutral"}
              size={36}
              iconSize={20}
              borderRadius={2}
            />
            <Box sx={{ minWidth: 0 }}>
              <FontStyle fontSize={13} fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
                {item.label}
              </FontStyle>
              {item.subject ? (
                <FontStyle
                  fontSize={12}
                  sx={{ mt: 0.5, overflowWrap: "anywhere", lineHeight: 1.6 }}
                >
                  {item.subject}
                </FontStyle>
              ) : null}
              <Box
                sx={{ display: "flex", flexWrap: "wrap", columnGap: 1.5, rowGap: 0.5, mt: 0.75 }}
              >
                <FontStyle
                  fontSize={11.5}
                  fontWeight={600}
                  sx={{ color: theme.ui.mutedText, overflowWrap: "anywhere" }}
                >
                  {item.actor}
                </FontStyle>
                <FontStyle
                  component="time"
                  dateTime={item.occurredAt}
                  fontSize={11.5}
                  sx={{ color: theme.ui.mutedText, overflowWrap: "anywhere" }}
                >
                  {formatActivityTime(item)}
                </FontStyle>
              </Box>
            </Box>
          </Box>
        ))
      ) : (
        <Box component="li" sx={{ py: 4, textAlign: "center" }}>
          <FontStyle fontSize={12} sx={{ color: theme.ui.mutedText }}>
            Belum ada aktivitas yang dapat ditampilkan.
          </FontStyle>
        </Box>
      )}
    </Box>
  );
}
