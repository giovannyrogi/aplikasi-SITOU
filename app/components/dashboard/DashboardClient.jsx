"use client";
import {
  dashboardMetricCards,
  ORGANIZATION_CHART_SECTIONS,
  ORGANIZATION_CHART_SHAPES,
} from "@/lib/dashboard/cardCatalog.mjs";

import { readApiResponse } from "@/lib/api/clientError";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppIcon from "@/app/components/icons/AppIcon";
import { Box, Button, Paper, useTheme } from "@mui/material";
import { ROLES } from "@/app/constants/roles";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import ErrorState from "@/app/components/data-display/ErrorState";
import FontStyle from "@/app/components/font-style/FontStyle";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import CategoryPieSummary from "./CategoryPieSummary";
import ContractEndingSummary from "./ContractEndingSummary";
import AreaTrendChart from "./AreaTrendChart";
import DashboardActivityList from "./DashboardActivityList";
import DashboardAttentionList from "./DashboardAttentionList";
import DashboardChart from "./DashboardChart";
import DashboardMetric from "./DashboardMetric";
import DashboardCardPlaceholder from "./DashboardCardPlaceholder";
import RetirementSummary from "./RetirementSummary";
import EmployeeCompositionSummary from "./EmployeeCompositionSummary";
import HorizontalBarChart from "./HorizontalBarChart";
import StackedBarChart from "./StackedBarChart";
import BirthdaySpotlight from "./BirthdaySpotlight";
import DashboardWorkspace from "./DashboardWorkspace";
import EmployeeDashboard from "./EmployeeDashboard";

/** Workspace dasar dan Inventaris memakai sumber data serta izin terpisah. */
export default function DashboardClient({ view }) {
  return <DashboardWorkspace view={view}>
    {view === "personal" ? <EmployeeDashboard /> : view === "staff" ? <OrganizationDashboard /> : null}
  </DashboardWorkspace>;
}

/** Memastikan panel grafik tidak menggambar canvas kosong saat dataset bernilai nol. */
function hasChartValues(chart) {
  const series = chart?.series || [];
  return series.some((item) => {
    if (typeof item === "number") return item > 0;
    return (item.data || []).some((value) => Number(value) > 0);
  });
}

/** Menentukan grafik operasional berdasarkan scope tanpa membedakan data non-sensitif per role. */
function buildChartDefinitions(data, showLocked = false) {
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
      title: "Jadwal Kontrak Berakhir",
      description:
        "Kontrak aktif yang akan berakhir, mulai hari ini selama 12 bulan ke depan.",
      icon: "solar:document-text-bold-duotone",
      Component: ContractEndingSummary,
    },
    {
      key: "leave",
      title: "Cuti & Izin tahun ini",
      description: "Jumlah cuti dan izin yang disetujui per jenis tahun ini.",
      icon: "navigation:leave",
      Component: CategoryPieSummary,
    },
    {
      key: "sanctions",
      title: "Sanksi tahun ini",
      description: "Jumlah sanksi yang diterbitkan tahun ini, menurut jenisnya.",
      icon: "navigation:disciplinary-report",
      Component: HorizontalBarChart,
      props: { integer: true, scrollable: true },
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
  ].filter(
    (chart) =>
      showLocked ||
      (chart.key === "retirement"
        ? Boolean(data.retirementSummary)
        : chart.key === "discipline"
          ? Array.isArray(data.recentDiscipline)
          : Object.hasOwn(data.charts || {}, chart.key)),
  );
}

/** Membagi sisa satu baris KPI secara merata tanpa mengubah urutan bacaan. */
function metricSpan(index, count, columns) {
  if (columns === 1) return 1;
  const rest = count % columns;
  return rest && index >= count - rest ? columns / rest : 1;
}

/** Dashboard utama yang mengubah data dan hierarchy visual berdasarkan role session. */
function OrganizationDashboard() {
  const theme = useTheme();
  const user = useAuthenticatedUser();
  const isSuperadmin = user.role_code === ROLES.SUPERADMIN;
  const isHrd = user.role_code === ROLES.HRD;
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
    let inFlight = false;
    const refresh = async () => {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/dashboard/summary?${query}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const body = await readApiResponse(response, "Dashboard belum dapat dimuat.");
        if (!controller.signal.aborted) {
          setState({ loading: false, data: body.data, error: "" });
        }
      } catch (error) {
        if (!controller.signal.aborted && error.name !== "AbortError") {
          // Jangan mempertahankan data lama bila izin berubah atau sesi berakhir.
          setState({ loading: false, data: null, error: error.message });
        }
      } finally {
        inFlight = false;
      }
    };
    void refresh();
    return () => {
      controller.abort();
    };
  }, [isHrd, isSuperadmin, organizationId, reloadKey]);

  const charts = useMemo(() => buildChartDefinitions(state.data, isHrd), [state.data, isHrd]);
  const sections = new Set(state.data?.sections || []);
  const restricted = isHrd && !state.loading && !sections.size;
  const metricCards =
    !state.loading && isHrd
      ? dashboardMetricCards(state.data)
      : state.loading
        ? Array.from({ length: isSuperadmin && !organizationId ? 5 : 6 }, (_, index) => ({
            key: `loading-${index}`,
          }))
        : (state.data?.metrics || []).map((metric) => ({ key: metric.key, metric }));
  const attentionCount = state.data?.attentionItems?.length || 0;
  return (
    <Box sx={{ minWidth: 0, display: "grid", gap: { xs: 2, md: 3 } }}>
      {restricted || isSuperadmin ? (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
          {restricted ? <CompactInfoChip label="Akses dashboard terbatas" tone="warning" /> : null}
          {isSuperadmin ? (
            <Box sx={{ width: { xs: "100%", sm: 280 } }}>
              <OrganizationSelect
                allowClear
                value={organizationId}
                onChange={changeOrganization}
                placeholder="Semua organisasi"
                style={{ width: "100%", minHeight: 44 }}
              />
            </Box>
          ) : null}
        </Box>
      ) : null}
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
              border: `1px solid ${restricted || attentionCount ? theme.status.warning.border : theme.status.success.border}`,
              borderRadius: "8px",
              bgcolor:
                restricted || attentionCount
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
                  color:
                    restricted || attentionCount
                      ? theme.status.warning.main
                      : theme.status.success.main,
                }}
              >
                <AppIcon
                  icon={
                    restricted
                      ? "solar:lock-password-bold-duotone"
                      : attentionCount
                        ? "solar:danger-triangle-bold-duotone"
                        : "solar:shield-check-bold-duotone"
                  }
                  width={24}
                />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <FontStyle component="h2" fontSize={15} fontWeight={700}>
                  {restricted
                    ? "Akses dashboard terbatas"
                    : attentionCount
                      ? `${attentionCount} prioritas ditampilkan`
                      : "Operasional stabil"}
                </FontStyle>
                <FontStyle
                  fontSize={11.5}
                  sx={{ mt: 0.35, color: theme.ui.mutedText, lineHeight: 1.55 }}
                >
                  {restricted
                    ? "Data operasional tidak ditampilkan karena akun ini belum memiliki akses fitur terkait."
                    : attentionCount
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
                md: "repeat(6, minmax(0, 1fr))",
              },
              gap: { xs: 1.5, md: 2 },
            }}
          >
            {metricCards.map((card, index) => (
              <Box
                key={card.key}
                sx={{
                  minWidth: 0,
                  gridColumn: {
                    xs: "span 1",
                    sm: `span ${metricSpan(index, metricCards.length, 2)}`,
                    md: `span ${metricSpan(index, metricCards.length, 3) * 2}`,
                  },
                }}
              >
                {card.locked || (!state.loading && !card.metric) ? (
                  <DashboardCardPlaceholder title={card.label} kind="metric" locked={card.locked} />
                ) : (
                  <DashboardMetric metric={card.metric} loading={state.loading} />
                )}
              </Box>
            ))}
          </Box>

          {state.loading || isHrd || state.data?.birthdaySummary ? (
            isHrd && !state.loading && !sections.has("employees") ? (
              <DashboardCardPlaceholder title="Ulang tahun pegawai" kind="birthday" />
            ) : (
              <BirthdaySpotlight data={state.data?.birthdaySummary} loading={state.loading} />
            )
          ) : null}

          {state.loading || isHrd || state.data?.employeeSummary ? (
            isHrd && !state.loading && !sections.has("employees") ? (
              <DashboardCardPlaceholder title="Ringkasan komposisi pegawai" kind="composition" />
            ) : (
              <EmployeeCompositionSummary
                data={state.data?.employeeSummary}
                loading={state.loading}
              />
            )
          ) : null}

          <Box
            component="section"
            aria-label="Visualisasi monitoring"
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" },
              gap: { xs: 2, md: 3 },
              alignItems: "stretch",
              "& > :last-child": { gridColumn: { lg: charts.length % 2 ? "1 / -1" : "auto" } },
            }}
          >
            {(state.loading
              ? Array.from({ length: isSuperadmin && !organizationId ? 4 : 6 }, (_, index) => ({
                  key: index,
                }))
              : charts
            ).map((chart, index) => {
              if (isHrd && !state.loading && !sections.has(ORGANIZATION_CHART_SECTIONS[chart.key]))
                return (
                  <DashboardCardPlaceholder
                    key={chart.key}
                    title={
                      chart.key === "retirement"
                        ? "Proyeksi pensiun"
                        : chart.key === "discipline"
                          ? "Kasus disiplin terbaru"
                          : chart.title
                    }
                    kind={ORGANIZATION_CHART_SHAPES[chart.key]}
                  />
                );
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
                  empty={!state.loading && !["leave", "contracts"].includes(chart.key) && !hasChartValues(chartData)}
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
            {state.loading || isHrd || state.data?.attentionItems ? (
              restricted ? (
                <DashboardCardPlaceholder title="Perlu ditinjau" kind="list" />
              ) : (
                <DashboardAttentionList
                  items={state.data?.attentionItems}
                  loading={state.loading}
                  organizationId={organizationId}
                  isSuperadmin={isSuperadmin}
                />
              )
            ) : null}
            {state.loading || isHrd || state.data?.activities ? (
              restricted ? (
                <DashboardCardPlaceholder title="Aktivitas terbaru" kind="list" />
              ) : (
                <DashboardActivityList items={state.data?.activities} loading={state.loading} />
              )
            ) : null}
          </Box>
        </>
      )}
    </Box>
  );
}
