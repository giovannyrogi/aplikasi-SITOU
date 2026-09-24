"use client";

import { readApiResponse } from "@/lib/api/clientError";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppIcon from "@/app/components/icons/AppIcon";
import { Box, Button, Paper, useTheme } from "@mui/material";
import { ROLES } from "@/app/constants/roles";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import ErrorState from "@/app/components/data-display/ErrorState";
import FontStyle from "@/app/components/font-style/FontStyle";
import PageHeader from "@/app/components/layout/PageHeader";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import AreaTrendChart from "./AreaTrendChart";
import DashboardActivityList from "./DashboardActivityList";
import DashboardAttentionList from "./DashboardAttentionList";
import DashboardChart from "./DashboardChart";
import DashboardMetric from "./DashboardMetric";
import RetirementSummary from "./RetirementSummary";
import EmployeeCompositionSummary from "./EmployeeCompositionSummary";
import HorizontalBarChart from "./HorizontalBarChart";
import StackedBarChart from "./StackedBarChart";
import BirthdaySpotlight from "./BirthdaySpotlight";

const generatedAtFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Memastikan panel grafik tidak menggambar canvas kosong saat dataset bernilai nol. */
function hasChartValues(chart) {
  const series = chart?.series || [];
  return series.some((item) => {
    if (typeof item === "number") return item > 0;
    return (item.data || []).some((value) => Number(value) > 0);
  });
}

/** Menentukan grafik operasional berdasarkan scope tanpa membedakan data non-sensitif per role. */
function buildChartDefinitions(data) {
  if (!data) return [];
  if (data.scope === "platform") {
    return [
      {
        key: "growth",
        title: "Pertumbuhan organisasi",
        description: "Perkembangan organisasi aktif dalam 12 bulan terakhir.",
        icon: "solar:chart-2-bold-duotone",
        Component: AreaTrendChart,
      },
      {
        key: "access",
        title: "Status masa akses",
        description: "Komposisi status langganan organisasi saat ini.",
        icon: "solar:calendar-date-bold-duotone",
        Component: StackedBarChart,
      },
      {
        key: "topOrganizations",
        title: "Organisasi dengan pegawai terbanyak",
        description: "Sepuluh organisasi berdasarkan jumlah pegawai aktif.",
        icon: "solar:buildings-2-bold-duotone",
        Component: HorizontalBarChart,
      },
      {
        key: "readiness",
        title: "Kesiapan organisasi",
        description: "Kelengkapan lokasi, HRD, struktur, dan data pegawai.",
        icon: "solar:checklist-minimalistic-bold-duotone",
        Component: HorizontalBarChart,
        props: { percent: true },
      },
    ];
  }
  return [
    {
      key: "growth",
      title: "Perkembangan pegawai",
      description:
        "Pegawai bergabung dan keluar per bulan selama 12 bulan terakhir, hingga hari ini.",
      icon: "solar:chart-2-bold-duotone",
      Component: AreaTrendChart,
    },
    {
      key: "locations",
      title: "Sebaran per lokasi",
      description: "Distribusi pegawai aktif pada lokasi yang dapat dikelola.",
      icon: "solar:map-point-wave-bold-duotone",
      Component: HorizontalBarChart,
      props: { scrollable: true },
    },
    {
      key: "units",
      title: "Distribusi Divisi & Unit",
      description: "Sebaran pegawai aktif pada struktur organisasi saat ini.",
      icon: "solar:structure-bold-duotone",
      Component: HorizontalBarChart,
      props: { scrollable: true },
    },
    {
      key: "contracts",
      title: "Kontrak berakhir per bulan",
      description:
        "Tanggal akhir kontrak selama 12 bulan terakhir hingga hari ini, menurut status saat ini.",
      icon: "solar:document-text-bold-duotone",
      Component: StackedBarChart,
    },
    {
      key: "retirement",
    },
    {
      key: "discipline",
      title: "Kasus disiplin resmi",
      description:
        "Kasus dengan tindakan resmi berdasarkan tingkat pelanggaran; draft tidak disertakan.",
      icon: "solar:shield-warning-bold-duotone",
      Component: HorizontalBarChart,
    },
  ];
}

/** Dashboard utama yang mengubah data dan hierarchy visual berdasarkan role session. */
export default function DashboardClient() {
  const theme = useTheme();
  const user = useAuthenticatedUser();
  const isSuperadmin = user.role_code === ROLES.SUPERADMIN;
  const [organizationId, setOrganizationId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: "" });

  const loadDashboard = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    setReloadKey((value) => value + 1);
  }, []);

  /** Mengganti scope organisasi Superadmin sebelum data baru diminta ke server. */
  const changeOrganization = useCallback((value) => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    setOrganizationId(value || null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams();
    if (isSuperadmin && organizationId) query.set("organizationId", organizationId);
    fetch(`/api/dashboard/summary?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await readApiResponse(response, "Dashboard belum dapat dimuat.");
        return body.data;
      })
      .then((data) => setState({ loading: false, data, error: "" }))
      .catch((error) => {
        if (error.name !== "AbortError") {
          setState({ loading: false, data: null, error: error.message });
        }
      });
    return () => controller.abort();
  }, [isSuperadmin, organizationId, reloadKey]);

  const charts = useMemo(() => buildChartDefinitions(state.data), [state.data]);
  const attentionCount = state.data?.attentionItems?.length || 0;
  const pageDescription = isSuperadmin
    ? organizationId
      ? "Pantau kesiapan dan kondisi operasional organisasi yang dipilih."
      : "Pantau pertumbuhan, masa akses, dan kesiapan seluruh organisasi SITOU."
    : user.role_code === ROLES.LEADER
      ? "Ringkasan organisasi untuk membantu pemantauan dan pengambilan keputusan."
      : "Pantau kondisi kepegawaian dan prioritas administrasi dari satu tempat.";

  return (
    <Box sx={{ minWidth: 0, display: "grid", gap: { xs: 2, md: 3 } }}>
      <PageHeader
        title="Dashboard monitoring"
        description={pageDescription}
        metadata={
          <>
            <CompactInfoChip label="Kondisi operasional saat ini" tone="info" />
            {state.data?.generatedAt ? (
              <CompactInfoChip
                label={`Diperbarui ${generatedAtFormatter.format(new Date(state.data.generatedAt))}`}
                tone="neutral"
              />
            ) : null}
          </>
        }
        action={
          isSuperadmin ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "minmax(230px, 1fr)",
                },
                gap: 1,
                minWidth: { md: 280 },
              }}
            >
              {isSuperadmin ? (
                <OrganizationSelect
                  allowClear
                  value={organizationId}
                  onChange={changeOrganization}
                  placeholder="Semua organisasi"
                  style={{ width: "100%", minHeight: 44 }}
                />
              ) : null}
            </Box>
          ) : null
        }
      />

      {state.error ? (
        <Paper elevation={0} sx={{ borderRadius: "8px", overflow: "hidden" }}>
          <ErrorState message={state.error} onRetry={loadDashboard} />
        </Paper>
      ) : (
        <>
          <Paper
            component="section"
            elevation={0}
            sx={{
              p: { xs: 2, sm: 2.5 },
              border: `1px solid ${attentionCount ? theme.status.warning.border : theme.status.success.border}`,
              borderRadius: "8px",
              bgcolor: attentionCount
                ? theme.status.warning.background
                : theme.status.success.background,
              display: "flex",
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
              flexDirection: { xs: "column", sm: "row" },
              gap: 2,
            }}
          >
            <Box sx={{ display: "flex", gap: 1.5, minWidth: 0 }}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: "8px",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  bgcolor: theme.ui.panelBg,
                  color: attentionCount ? theme.status.warning.main : theme.status.success.main,
                }}
              >
                <AppIcon
                  icon={
                    attentionCount
                      ? "solar:danger-triangle-bold-duotone"
                      : "solar:shield-check-bold-duotone"
                  }
                  width={24}
                />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <FontStyle component="h2" fontSize={15} fontWeight={700}>
                  {attentionCount
                    ? `${attentionCount} prioritas ditampilkan`
                    : "Operasional stabil"}
                </FontStyle>
                <FontStyle
                  fontSize={11.5}
                  sx={{ mt: 0.35, color: theme.ui.mutedText, lineHeight: 1.55 }}
                >
                  {attentionCount
                    ? "Periksa daftar prioritas agar administrasi penting dapat segera ditindaklanjuti."
                    : "Belum ada kondisi mendesak pada data yang dapat Anda akses saat ini."}
                </FontStyle>
              </Box>
            </Box>
            <Button
              variant="outlined"
              startIcon={<AppIcon icon="solar:refresh-linear" />}
              onClick={loadDashboard}
              disabled={state.loading}
              sx={{ minHeight: 44, bgcolor: theme.ui.panelBg, flexShrink: 0 }}
            >
              Muat ulang
            </Button>
          </Paper>

          <Box
            component="section"
            aria-label="Indikator utama"
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                md: "repeat(3, minmax(0, 1fr))",
              },
              gap: { xs: 1.5, md: 2 },
            }}
          >
            {(state.loading
              ? Array.from({ length: 6 }, (_, index) => ({ key: index }))
              : state.data?.metrics || []
            ).map((metric) => (
              <DashboardMetric key={metric.key} metric={metric} loading={state.loading} />
            ))}
          </Box>

          {!isSuperadmin || organizationId ? (
            <BirthdaySpotlight data={state.data?.birthdaySummary} loading={state.loading} />
          ) : null}

          <EmployeeCompositionSummary data={state.data?.employeeSummary} loading={state.loading} />

          <Box
            component="section"
            aria-label="Visualisasi monitoring"
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" },
              gap: { xs: 2, md: 3 },
              alignItems: "stretch",
            }}
          >
            {(state.loading
              ? Array.from({ length: isSuperadmin && !organizationId ? 4 : 6 }, (_, index) => ({
                  key: index,
                }))
              : charts
            ).map((chart, index) => {
              if (chart.key === "discipline")
                return (
                  <DashboardAttentionList
                    key={chart.key}
                    title="Kasus disiplin terbaru"
                    description="Maksimal lima kasus terbaru dengan tindakan resmi, tanpa draft."
                    emptyMessage="Belum ada kasus dengan tindakan resmi."
                    showPriority={false}
                    items={state.data?.recentDiscipline}
                    loading={state.loading}
                    organizationId={organizationId}
                    isSuperadmin={isSuperadmin}
                  />
                );
              if (chart.key === "retirement")
                return (
                  <RetirementSummary
                    key={chart.key}
                    data={state.data?.retirementSummary}
                    loading={state.loading}
                  />
                );
              const Component = chart.Component;
              const chartData = state.data?.charts?.[chart.key];
              return (
                <DashboardChart
                  key={chart.key}
                  title={chart.title || "Memuat visualisasi"}
                  description={chart.description || "Data dashboard sedang disiapkan."}
                  icon={chart.icon || "solar:chart-bold-duotone"}
                  loading={state.loading}
                  empty={!state.loading && !hasChartValues(chartData)}
                >
                  {Component ? <Component data={chartData} {...chart.props} /> : null}
                </DashboardChart>
              );
            })}
          </Box>

          <Box
            component="section"
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" },
              gap: { xs: 2, md: 3 },
            }}
          >
            <DashboardAttentionList
              items={state.data?.attentionItems}
              loading={state.loading}
              organizationId={organizationId}
              isSuperadmin={isSuperadmin}
            />
            <DashboardActivityList items={state.data?.activities} loading={state.loading} />
          </Box>
        </>
      )}
    </Box>
  );
}
