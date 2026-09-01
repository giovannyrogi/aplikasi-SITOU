"use client";

import { Icon } from "@iconify/react";
import { Box, Paper, Skeleton, useTheme } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";
import DonutChart from "./DonutChart";
import HorizontalBarChart from "./HorizontalBarChart";
import StackedBarChart from "./StackedBarChart";

/** Mengubah dataset kategori tunggal menjadi seri bertumpuk untuk komposisi status. */
function buildStatusChart(data) {
  const categories = data?.categories || [];
  const values = data?.series?.[0]?.data || [];
  return {
    categories: ["Pegawai aktif saat ini"],
    series: categories.map((label, index) => ({ name: label, data: [values[index] || 0] })),
  };
}

/** Memeriksa apakah ringkasan komposisi memiliki nilai yang dapat divisualisasikan. */
function hasValues(data) {
  return (data?.series || []).some((series) =>
    (series?.data || []).some((value) => Number(value) > 0),
  );
}

/** Panel snapshot komposisi pegawai yang memakai satu paper tanpa kartu bertumpuk. */
export default function EmployeeCompositionSummary({ data, loading }) {
  const theme = useTheme();
  const statusData = buildStatusChart(data?.status);
  const charts = [
    {
      key: "gender",
      title: "Jenis kelamin",
      description: "Komposisi data jenis kelamin pegawai aktif.",
      icon: "solar:users-group-rounded-bold-duotone",
      content: (
        <DonutChart
          data={{
            labels: data?.gender?.categories || [],
            series: data?.gender?.series?.[0]?.data || [],
          }}
          colors={[
            theme.status.info.main,
            theme.palette.primary.main,
            theme.status.warning.main,
            theme.status.neutral.main,
          ]}
        />
      ),
      empty: !hasValues(data?.gender),
    },
    {
      key: "status",
      title: "Status pegawai",
      description: "Pegawai aktif, masa percobaan, dan cuti saat ini.",
      icon: "solar:user-check-rounded-bold-duotone",
      content: (
        <StackedBarChart
          data={statusData}
          horizontal
          colors={[theme.status.success.main, theme.status.info.main, theme.status.warning.main]}
        />
      ),
      empty: !hasValues(data?.status),
    },
    {
      key: "tenure",
      title: "Masa kerja",
      description: "Sebaran masa kerja berdasarkan tanggal bergabung.",
      icon: "solar:calendar-search-bold-duotone",
      content: <HorizontalBarChart data={data?.tenure} colors={[theme.status.info.main]} />,
      empty: !hasValues(data?.tenure),
    },
    {
      key: "employmentType",
      title: "Jenis kepegawaian",
      description: "Hubungan kerja aktif yang tercatat pada kontrak pegawai.",
      icon: "solar:case-round-bold-duotone",
      content: (
        <HorizontalBarChart data={data?.employmentType} colors={[theme.palette.primary.main]} />
      ),
      empty: !hasValues(data?.employmentType),
    },
  ];

  return (
    <Paper
      component="section"
      elevation={0}
      aria-labelledby="employee-composition-title"
      sx={{
        minWidth: 0,
        p: { xs: 2, sm: 2.5 },
        border: `1px solid ${theme.ui.dashboardCardBorder}`,
        borderRadius: "8px",
        bgcolor: theme.ui.dashboardCardBg,
        boxShadow: theme.ui.dashboardCardShadow,
      }}
    >
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: "8px",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            color: theme.palette.primary.main,
            bgcolor: theme.ui.panelAccentBg,
          }}
        >
          <Icon icon="solar:chart-square-bold-duotone" width={21} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <FontStyle id="employee-composition-title" component="h2" fontSize={15} fontWeight={700}>
            Ringkasan komposisi pegawai
          </FontStyle>
          <FontStyle fontSize={11.5} sx={{ mt: 0.35, color: theme.ui.mutedText, lineHeight: 1.55 }}>
            Snapshot kondisi hubungan kerja pegawai saat ini. Cuti dan izin ditampilkan sebagai
            indikator terpisah.
          </FontStyle>
        </Box>
      </Box>

      <Box
        sx={{
          mt: 2.5,
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
          borderTop: `1px solid ${theme.ui.panelBorderSubtle}`,
        }}
      >
        {charts.map((chart, index) => (
          <Box
            key={chart.key}
            component="section"
            sx={{
              minWidth: 0,
              py: { xs: 2.25, md: 2.5 },
              px: { xs: 0, md: index % 2 === 0 ? "0" : 2.5 },
              pr: { md: index % 2 === 0 ? 2.5 : 0 },
              borderBottom: {
                xs: index < charts.length - 1 ? `1px solid ${theme.ui.panelBorderSubtle}` : "none",
                md: index < 2 ? `1px solid ${theme.ui.panelBorderSubtle}` : "none",
              },
              borderLeft: { md: index % 2 ? `1px solid ${theme.ui.panelBorderSubtle}` : "none" },
            }}
          >
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
              <Icon icon={chart.icon} width={19} color={theme.palette.primary.main} />
              <Box sx={{ minWidth: 0 }}>
                <FontStyle component="h3" fontSize={13} fontWeight={700}>
                  {chart.title}
                </FontStyle>
                <FontStyle fontSize={10.8} sx={{ mt: 0.25, color: theme.ui.mutedText }}>
                  {chart.description}
                </FontStyle>
              </Box>
            </Box>
            <Box sx={{ mt: 1.5, minHeight: 260, minWidth: 0 }}>
              {loading ? (
                <Skeleton variant="rounded" height={260} />
              ) : chart.empty ? (
                <Box
                  sx={{ height: 260, display: "grid", placeItems: "center", textAlign: "center" }}
                >
                  <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
                    Belum ada data untuk komposisi ini.
                  </FontStyle>
                </Box>
              ) : (
                chart.content
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
