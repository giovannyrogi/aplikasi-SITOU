"use client";

import { Icon } from "@iconify/react";
import { Box, IconButton, Paper, Skeleton, Tooltip, useTheme } from "@mui/material";
import { useRouter } from "next/navigation";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";

/** Daftar prioritas yang mengarahkan perhatian pengguna tanpa membanjiri dashboard. */
export default function DashboardAttentionList({
  items = [],
  loading,
  organizationId,
  isSuperadmin,
}) {
  const theme = useTheme();
  const router = useRouter();
  const { startNavigationLoading } = useLoadingBackdrop();

  /** Membuka histori disiplin pegawai dan mempertahankan scope organisasi Superadmin. */
  const openDiscipline = (item) => {
    const query = new URLSearchParams({ tab: "discipline" });
    if (isSuperadmin && organizationId) query.set("organizationId", organizationId);
    startNavigationLoading({ message: "Membuka histori sanksi pegawai..." });
    router.push(`/employees/${item.id}?${query.toString()}`);
  };
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{
        height: "100%",
        p: { xs: 2, sm: 2.5 },
        border: `1px solid ${theme.ui.dashboardCardBorder}`,
        borderRadius: "8px",
        bgcolor: theme.ui.dashboardCardBg,
        boxShadow: theme.ui.dashboardCardShadow,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Icon icon="solar:bell-bing-bold-duotone" width={22} color={theme.status.warning.main} />
        <FontStyle component="h2" fontSize={15} fontWeight={700}>
          Perlu ditinjau
        </FontStyle>
      </Box>
      <FontStyle fontSize={11.5} sx={{ mt: 0.5, color: theme.ui.mutedText }}>
        Prioritas yang membutuhkan pemeriksaan atau tindak lanjut.
      </FontStyle>
      <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0, mt: 2 }}>
        {loading ? (
          [1, 2, 3].map((item) => (
            <Box component="li" key={item} sx={{ py: 1.5 }}>
              <Skeleton />
              <Skeleton width="65%" />
            </Box>
          ))
        ) : items.length ? (
          items.map((item) => (
            <Box
              component="li"
              key={`${item.type}-${item.id}`}
              sx={{
                py: 1.4,
                borderTop: `1px solid ${theme.ui.panelBorderSubtle}`,
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) auto",
                gap: 1.25,
                alignItems: "center",
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    columnGap: 1,
                    rowGap: 0.75,
                    minWidth: 0,
                  }}
                >
                  <FontStyle fontSize={12.5} fontWeight={600} sx={{ overflowWrap: "anywhere" }}>
                    {item.title}
                  </FontStyle>
                  <CompactInfoChip
                    label={
                      item.priority === 1
                        ? "Mendesak"
                        : item.priority === 2
                          ? "Perhatian"
                          : "Tinjau"
                    }
                    tone={item.priority === 1 ? "danger" : "warning"}
                  />
                </Box>
                <FontStyle
                  fontSize={10.8}
                  sx={{ mt: 0.35, color: theme.ui.mutedText, lineHeight: 1.5 }}
                >
                  {item.description}
                </FontStyle>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                {item.type === "discipline" ? (
                  <Tooltip title="Lihat detail sanksi" arrow>
                    <IconButton
                      aria-label={`Lihat detail sanksi ${item.title}`}
                      onClick={() => openDiscipline(item)}
                      sx={{
                        width: 44,
                        height: 44,
                        border: `1px solid ${theme.status.danger.border}`,
                        color: theme.status.danger.main,
                        bgcolor: theme.status.danger.background,
                        "&:hover": {
                          bgcolor: theme.status.danger.background,
                          borderColor: theme.status.danger.main,
                        },
                      }}
                    >
                      <Icon icon="solar:eye-linear" width={20} />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Box>
            </Box>
          ))
        ) : (
          <Box component="li" sx={{ py: 4, textAlign: "center" }}>
            <FontStyle fontSize={12} sx={{ color: theme.ui.mutedText }}>
              Tidak ada prioritas mendesak saat ini.
            </FontStyle>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
