"use client";

import { Icon } from "@iconify/react";
import { EyeOutlined } from "@ant-design/icons";
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
  title = "Perlu ditinjau",
  description = "Maksimal lima prioritas yang membutuhkan tindak lanjut.",
  emptyMessage = "Tidak ada prioritas mendesak saat ini.",
  showPriority = true,
}) {
  const theme = useTheme();
  const router = useRouter();
  const { startNavigationLoading } = useLoadingBackdrop();

  /** Membuka histori terkait dan mempertahankan scope organisasi Superadmin. */
  const openEmployeeHistory = (item) => {
    const query = new URLSearchParams({
      tab: item.type === "contract" ? "contracts" : "discipline",
    });
    if (isSuperadmin && organizationId) query.set("organizationId", organizationId);
    startNavigationLoading();
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
          {title}
        </FontStyle>
      </Box>
      <FontStyle fontSize={11.5} sx={{ mt: 0.5, color: theme.ui.mutedText }}>
        {description}
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
              key={`${item.type}-${item.caseId || item.id}`}
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
                  {showPriority ? (
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
                  ) : null}
                </Box>
                <FontStyle
                  fontSize={10.8}
                  sx={{ mt: 0.35, color: theme.ui.mutedText, lineHeight: 1.5 }}
                >
                  {item.description}
                </FontStyle>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                {["discipline", "contract"].includes(item.type) ? (
                  <Tooltip
                    title={item.type === "contract" ? "Lihat kontrak" : "Lihat detail sanksi"}
                    arrow
                  >
                    <IconButton
                      aria-label={`${item.type === "contract" ? "Lihat kontrak" : "Lihat detail sanksi"} ${item.title}`}
                      onClick={() => openEmployeeHistory(item)}
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
                      <EyeOutlined style={{ fontSize: 20 }} />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Box>
            </Box>
          ))
        ) : (
          <Box component="li" sx={{ py: 4, textAlign: "center" }}>
            <FontStyle fontSize={12} sx={{ color: theme.ui.mutedText }}>
              {emptyMessage}
            </FontStyle>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
