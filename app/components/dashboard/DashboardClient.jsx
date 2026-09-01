"use client";

import { readApiResponse } from "@/lib/api/clientError";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Alert, DatePicker } from "antd";
import dayjs from "dayjs";
import { Box, Button, Paper, useTheme } from "@mui/material";
import { ROLES } from "@/app/constants/roles";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import ErrorState from "@/app/components/data-display/ErrorState";
import FontStyle from "@/app/components/font-style/FontStyle";
import PageHeader from "@/app/components/layout/PageHeader";
import Notification from "@/app/components/Notifications/Notification";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import useAppNotification from "@/app/hooks/useAppNotification";
import AreaTrendChart from "./AreaTrendChart";
import DashboardActivityList from "./DashboardActivityList";
import DashboardAttentionList from "./DashboardAttentionList";
import DashboardChart from "./DashboardChart";
import DashboardMetric from "./DashboardMetric";
import DonutChart from "./DonutChart";
import EmployeeCompositionSummary from "./EmployeeCompositionSummary";
import HorizontalBarChart from "./HorizontalBarChart";
import StackedBarChart from "./StackedBarChart";

const { RangePicker } = DatePicker;
const DEFAULT_RANGE = [dayjs().startOf("year"), dayjs()];

const generatedAtFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Membuat label rentang yang ringkas dan tetap mudah dipahami pengguna. */
function formatSelectedRange(range) {
  if (!range?.[0] || !range?.[1]) return "Rentang belum dipilih";
  return `${range[0].format("DD MMM YYYY")} - ${range[1].format("DD MMM YYYY")}`;
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
function buildChartDefinitions(data) {
  if (!data) return [];
  if (data.scope === "platform") {
    return [
      {
        key: "growth",
        title: "Pertumbuhan organisasi",
        description: "Perkembangan organisasi aktif dalam periode terpilih.",
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
      description: "Perbandingan pegawai yang mulai bergabung dan keluar pada setiap bulan.",
      icon: "solar:chart-2-bold-duotone",
      Component: AreaTrendChart,
    },
    {
      key: "locations",
      title: "Sebaran per lokasi",
      description: "Distribusi pegawai aktif pada lokasi yang dapat dikelola.",
      icon: "solar:map-point-wave-bold-duotone",
      Component: HorizontalBarChart,
    },
    {
      key: "units",
      title: "Distribusi Divisi & Unit",
      description: "Sebaran pegawai aktif pada struktur organisasi saat ini.",
      icon: "solar:structure-bold-duotone",
      Component: HorizontalBarChart,
    },
    {
      key: "contracts",
      title: "Kontrak dalam periode",
      description: "Kontrak yang berakhir serta riwayat kontrak pada rentang terpilih.",
      icon: "solar:document-text-bold-duotone",
      Component: StackedBarChart,
    },
    {
      key: "completeness",
      title: "Kelengkapan data pegawai",
      description: "Kondisi profil, kontak, pas foto, dan penempatan aktif.",
      icon: "solar:clipboard-check-bold-duotone",
      Component: DonutChart,
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
  const [dateRange, setDateRange] = useState(DEFAULT_RANGE);
  const [organizationId, setOrganizationId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const { notification, showNotification, closeNotification } = useAppNotification();

  const loadDashboard = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    setReloadKey((value) => value + 1);
  }, []);

  /** Menampilkan feedback loading sejak pengguna mengganti rentang pemantauan. */
  const changeDateRange = useCallback(
    (value) => {
      if (!value?.[0] || !value?.[1]) return;
      const [start, end] = value;
      if (end.isBefore(start, "day")) {
        showNotification("Tanggal akhir tidak boleh lebih awal dari tanggal awal.", "error");
        return;
      }
      const maximumEnd = start.add(24, "month").subtract(1, "day");
      if (end.isAfter(maximumEnd, "day")) {
        showNotification("Rentang tanggal dashboard maksimal 24 bulan.", "warning");
        return;
      }
      setState((current) => ({ ...current, loading: true, error: "" }));
      setDateRange(value);
    },
    [showNotification],
  );

  /** Mengganti scope organisasi Superadmin sebelum data baru diminta ke server. */
  const changeOrganization = useCallback((value) => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    setOrganizationId(value || null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      startDate: dateRange[0].format("YYYY-MM-DD"),
      endDate: dateRange[1].format("YYYY-MM-DD"),
    });
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
  }, [dateRange, isSuperadmin, organizationId, reloadKey]);

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
      <Notification
        open={notification.open}
        message={notification.message}
        severity={notification.severity}
        onClose={closeNotification}
      />
      <PageHeader
        title="Dashboard monitoring"
        description={pageDescription}
        metadata={
          <>
            <CompactInfoChip label={`Periode ${formatSelectedRange(dateRange)}`} tone="info" />
            {state.data?.generatedAt ? (
              <CompactInfoChip
                label={`Diperbarui ${generatedAtFormatter.format(new Date(state.data.generatedAt))}`}
                tone="neutral"
              />
            ) : null}
          </>
        }
        action={
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: isSuperadmin ? "minmax(230px, 1fr) minmax(280px, 1.2fr)" : "minmax(280px, 1fr)",
              },
              gap: 1,
              minWidth: { md: isSuperadmin ? 530 : 280 },
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
            <RangePicker
              aria-label="Rentang tanggal dashboard"
              value={dateRange}
              onChange={changeDateRange}
              allowClear={false}
              format="DD MMM YYYY"
              placeholder={["Tanggal awal", "Tanggal akhir"]}
              style={{ width: "100%", minHeight: 44 }}
            />
          </Box>
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
                <Icon
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
                  {attentionCount ? `${attentionCount} hal perlu ditinjau` : "Operasional stabil"}
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
              startIcon={<Icon icon="solar:refresh-linear" />}
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

          {state.data?.role === ROLES.LEADER ? (
            <Alert
              type="info"
              showIcon
              title="Dashboard Pimpinan bersifat hanya-baca"
              description="Data tindakan disiplin berstatus draft tidak disertakan dalam ringkasan ini."
            />
          ) : null}
        </>
      )}
    </Box>
  );
}
