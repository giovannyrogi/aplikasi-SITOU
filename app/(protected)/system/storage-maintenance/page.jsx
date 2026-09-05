"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Pagination, Skeleton, Table, Tabs } from "antd";
import {
  CheckCircleOutlined,
  DeleteOutlined,
  HistoryOutlined,
  SafetyCertificateOutlined,
  ScanOutlined,
  StopOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Alert, Box, Divider, Paper, useMediaQuery, useTheme } from "@mui/material";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import ModernTableFrame from "@/app/components/data-display/ModernTableFrame";
import EmptyState from "@/app/components/data-display/EmptyState";
import ErrorState from "@/app/components/data-display/ErrorState";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import AppModal from "@/app/components/modals/AppModal";
import Notification from "@/app/components/Notifications/Notification";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import useAppNotification from "@/app/hooks/useAppNotification";

const statusLabels = {
  eligible: "Aman dibersihkan",
  selected: "Sudah dipilih",
  needs_review: "Perlu ditinjau",
  already_absent: "Byte sudah tidak ada",
  queued: "Menunggu proses",
  running: "Sedang diproses",
  processing: "Sedang diproses",
  cleaned: "Berhasil dibersihkan",
  skipped: "Dilewati",
  failed: "Gagal",
  pending_retry: "Menunggu percobaan ulang",
  completed: "Selesai",
  partial: "Selesai sebagian",
  cancelled: "Dibatalkan",
};

const statusTones = {
  eligible: "success",
  completed: "success",
  cleaned: "success",
  selected: "info",
  queued: "info",
  running: "info",
  processing: "info",
  needs_review: "warning",
  already_absent: "neutral",
  skipped: "warning",
  partial: "warning",
  pending_retry: "warning",
  failed: "danger",
  cancelled: "neutral",
};

const formatBytes = (value) => {
  const bytes = Number(value || 0);
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: index ? 1 : 0 }).format(
    bytes / 1024 ** index,
  )} ${units[index]}`;
};

const formatDateTime = (value) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Belum ada";

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Permintaan tidak dapat diproses.");
  return body;
}

function Metric({ icon, label, value, helper, tone = "info" }) {
  const theme = useTheme();
  const colors = {
    info: theme.palette.info.main,
    success: theme.palette.success.main,
    warning: theme.palette.warning.main,
    danger: theme.palette.error.main,
  };
  return (
    <Box sx={{ minWidth: 0, display: "grid", gridTemplateColumns: "36px 1fr", gap: 1.25 }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          display: "grid",
          placeItems: "center",
          borderRadius: 2,
          color: colors[tone],
          bgcolor: `${colors[tone]}12`,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
          {label}
        </FontStyle>
        <FontStyle fontSize={18} fontWeight={700} sx={{ mt: 0.15 }}>
          {value}
        </FontStyle>
        {helper ? (
          <FontStyle fontSize={10.5} sx={{ mt: 0.25, color: theme.ui.mutedText }}>
            {helper}
          </FontStyle>
        ) : null}
      </Box>
    </Box>
  );
}

function FileIdentity({ item }) {
  const theme = useTheme();
  return (
    <Box sx={{ minWidth: 0 }}>
      <FontStyle fontWeight={650} sx={{ overflowWrap: "anywhere" }}>
        {item.original_name || "Nama file tidak tersedia"}
      </FontStyle>
      <FontStyle fontSize={11} sx={{ mt: 0.4, color: theme.ui.mutedText }}>
        {item.organization_name} · {item.employee_name || "Tidak terkait langsung ke profil"}
        {item.employee_no_masked !== "-" ? ` · NIP ${item.employee_no_masked}` : ""}
      </FontStyle>
    </Box>
  );
}

function FileItemsView({
  data,
  loading,
  error,
  pagination,
  onPageChange,
  selected,
  onSelect,
  allowSelection = true,
}) {
  const theme = useTheme();
  const mobile = useMediaQuery("(max-width:767px)");
  const selectable = allowSelection ? data.filter((item) => item.status === "eligible") : [];
  const pageSelected = selectable.filter((item) => selected.has(item.id)).length;
  const allPageSelected = selectable.length > 0 && pageSelected === selectable.length;

  const togglePage = (checked) => {
    for (const item of selectable) onSelect(item, checked);
  };

  if (error)
    return (
      <Box sx={{ p: 2.5 }}>
        <ErrorState message={error} />
      </Box>
    );
  if (loading)
    return (
      <Box sx={{ p: 2.5 }}>
        <Skeleton active paragraph={{ rows: 5 }} />
      </Box>
    );
  if (!data.length)
    return (
      <Box sx={{ p: 3 }}>
        <EmptyState description="Tidak ada file pada bagian ini dari pemeriksaan terakhir." />
      </Box>
    );

  const columns = [
    {
      title: "File dan pegawai",
      key: "file",
      width: 300,
      render: (_, item) => <FileIdentity item={item} />,
    },
    {
      title: "Kategori",
      dataIndex: "category_label",
      width: 170,
      render: (value) => <CompactInfoChip label={value} tone="info" />,
    },
    { title: "Ukuran", dataIndex: "size_bytes", width: 110, render: formatBytes },
    {
      title: "Dinonaktifkan",
      key: "deleted",
      width: 220,
      render: (_, item) => (
        <Box>
          <FontStyle fontSize={10.5} sx={{ mb: 0.35, color: theme.ui.mutedText }}>
            Diunggah {formatDateTime(item.uploaded_at)}
          </FontStyle>
          <FontStyle fontSize={11.5}>{formatDateTime(item.deleted_at)}</FontStyle>
          <FontStyle fontSize={10.5} sx={{ mt: 0.35, color: theme.ui.mutedText }}>
            {item.deletion_reason_label}
          </FontStyle>
        </Box>
      ),
    },
    {
      title: "Hasil pemeriksaan",
      key: "inspection",
      width: 280,
      render: (_, item) => (
        <Box>
          <CompactInfoChip
            label={statusLabels[item.status] || item.status}
            tone={statusTones[item.status] || "neutral"}
          />
          <FontStyle fontSize={10.5} sx={{ mt: 0.55, color: theme.ui.mutedText }}>
            {item.reason_label}
          </FontStyle>
          {item.reference_labels?.length ? (
            <FontStyle fontSize={10.5} sx={{ mt: 0.35, color: theme.palette.warning.dark }}>
              Dirujuk oleh: {item.reference_labels.join(", ")}
            </FontStyle>
          ) : null}
        </Box>
      ),
    },
  ];

  if (!mobile)
    return (
      <Box sx={{ p: { sm: 2.5, lg: 3 } }}>
        <ModernTableFrame>
          <Table
            rowKey="id"
            dataSource={data}
            columns={columns}
            size="middle"
            scroll={{ x: 1080 }}
            pagination={false}
            rowSelection={
              allowSelection
                ? {
                    preserveSelectedRowKeys: true,
                    selectedRowKeys: [...selected],
                    getCheckboxProps: (item) => ({
                      disabled: item.status !== "eligible",
                      "aria-label": `Pilih ${item.original_name}`,
                    }),
                    onSelect,
                    onSelectAll: (checked, _rows, changedRows) =>
                      changedRows.forEach((item) => onSelect(item, checked)),
                  }
                : undefined
            }
          />
        </ModernTableFrame>
        <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
          <Pagination
            current={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            showSizeChanger={false}
            onChange={onPageChange}
          />
        </Box>
      </Box>
    );

  return (
    <Box sx={{ px: 2, pb: 2 }}>
      {selectable.length ? (
        <Box sx={{ py: 1.5 }}>
          <Checkbox
            checked={allPageSelected}
            indeterminate={pageSelected > 0 && !allPageSelected}
            onChange={(event) => togglePage(event.target.checked)}
          >
            Pilih kandidat pada halaman ini
          </Checkbox>
        </Box>
      ) : null}
      <Divider />
      {data.map((item) => (
        <Box key={item.id} sx={{ py: 2 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: allowSelection ? "28px 1fr" : "1fr",
              gap: 1,
            }}
          >
            {allowSelection ? (
              <Checkbox
                checked={selected.has(item.id)}
                disabled={item.status !== "eligible"}
                aria-label={`Pilih ${item.original_name}`}
                onChange={(event) => onSelect(item, event.target.checked)}
              />
            ) : null}
            <Box sx={{ minWidth: 0 }}>
              <FileIdentity item={item} />
              <Box sx={{ mt: 1.25, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                <CompactInfoChip label={item.category_label} tone="info" />
                <CompactInfoChip label={formatBytes(item.size_bytes)} />
                <CompactInfoChip
                  label={statusLabels[item.status] || item.status}
                  tone={statusTones[item.status] || "neutral"}
                />
              </Box>
              <FontStyle fontSize={11} sx={{ mt: 1, color: theme.ui.mutedText }}>
                {item.reason_label}
              </FontStyle>
              {item.reference_labels?.length ? (
                <FontStyle fontSize={11} sx={{ mt: 0.5, color: theme.palette.warning.dark }}>
                  Dirujuk oleh: {item.reference_labels.join(", ")}
                </FontStyle>
              ) : null}
              <FontStyle fontSize={10.5} sx={{ mt: 0.5, color: theme.ui.mutedText }}>
                Dinonaktifkan {formatDateTime(item.deleted_at)} · {item.deletion_reason_label}
              </FontStyle>
            </Box>
          </Box>
          <Divider sx={{ mt: 2 }} />
        </Box>
      ))}
      <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
        <Pagination
          simple
          current={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onChange={onPageChange}
        />
      </Box>
    </Box>
  );
}

export default function StorageMaintenancePage() {
  const theme = useTheme();
  const mobile = useMediaQuery("(max-width:767px)");
  const { notification, showNotification, closeNotification } = useAppNotification();
  const [organization, setOrganization] = useState({ id: null, name: "" });
  const [summary, setSummary] = useState(null);
  const [runs, setRuns] = useState([]);
  const [activeTab, setActiveTab] = useState("candidate");
  const [itemState, setItemState] = useState({
    data: [],
    loading: false,
    error: "",
    page: 1,
    pageSize: 20,
    total: 0,
  });
  const [selectedItems, setSelectedItems] = useState(new Map());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmationAccepted, setConfirmationAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const organizationId = organization.id;
  const latestScanId = summary?.latest_scan_id;
  const activeRun = useMemo(
    () => runs.find((run) => run.status === "queued" || run.status === "running") || null,
    [runs],
  );
  const hasActiveRun = Number(summary?.active_run_count || 0) > 0;
  const activeRunLabel = activeRun?.run_type === "cleanup" ? "Pembersihan" : "Pemeriksaan";

  const refreshOverview = useCallback(async () => {
    if (!organizationId) return;
    const query = `organizationId=${encodeURIComponent(organizationId)}`;
    const [summaryBody, runsBody] = await Promise.all([
      requestJson(`/api/system/storage-maintenance/summary?${query}`),
      requestJson(`/api/system/storage-maintenance/runs?${query}&pageSize=50`),
    ]);
    setSummary(summaryBody.data);
    setRuns(runsBody.data || []);
  }, [organizationId]);

  const loadItems = useCallback(
    async (page = 1) => {
      if (!organizationId || !latestScanId || activeTab === "history") return;
      setItemState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const query = new URLSearchParams({
          organizationId: String(organizationId),
          itemKind: activeTab,
          page: String(page),
          pageSize: "20",
        });
        const body = await requestJson(
          `/api/system/storage-maintenance/runs/${latestScanId}?${query}`,
        );
        setItemState({
          data: body.data.items || [],
          loading: false,
          error: "",
          page,
          pageSize: 20,
          total: body.data.total || 0,
        });
      } catch (error) {
        setItemState((current) => ({ ...current, loading: false, error: error.message }));
      }
    },
    [activeTab, latestScanId, organizationId],
  );

  useEffect(() => {
    setSummary(null);
    setRuns([]);
    setSelectedItems(new Map());
    setItemState({ data: [], loading: false, error: "", page: 1, pageSize: 20, total: 0 });
    if (!organizationId) return undefined;
    let active = true;
    const refresh = () =>
      refreshOverview().catch((error) => {
        if (active) showNotification(error.message, "error");
      });
    refresh();
    const timer = window.setInterval(refresh, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [organizationId, refreshOverview, showNotification]);

  useEffect(() => {
    loadItems(1);
  }, [loadItems, summary?.latest_scan_at, summary?.latest_scan_status]);

  useEffect(() => {
    setSelectedItems(new Map());
  }, [latestScanId]);

  const requestScan = async () => {
    if (!organizationId) return;
    setSubmitting(true);
    try {
      const body = await requestJson("/api/system/storage-maintenance/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      showNotification(body.message, "info");
      setSelectedItems(new Map());
      await refreshOverview();
    } catch (error) {
      showNotification(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleItem = useCallback((item, checked) => {
    setSelectedItems((current) => {
      const next = new Map(current);
      if (checked) next.set(item.id, item);
      else next.delete(item.id);
      return next;
    });
  }, []);

  const selection = useMemo(() => [...selectedItems.values()], [selectedItems]);
  const selectedBytes = selection.reduce((total, item) => total + Number(item.size_bytes || 0), 0);

  const requestCleanup = async () => {
    if (!latestScanId || !selection.length || !confirmationAccepted) return;
    setSubmitting(true);
    try {
      const body = await requestJson(
        `/api/system/storage-maintenance/runs/${latestScanId}/cleanup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId,
            itemIds: selection.map((item) => item.id),
            confirmationAccepted: true,
          }),
        },
      );
      setConfirmOpen(false);
      setConfirmationAccepted(false);
      setSelectedItems(new Map());
      showNotification(body.message, "info");
      await refreshOverview();
      await loadItems(itemState.page);
    } catch (error) {
      showNotification(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRun = async (run) => {
    setSubmitting(true);
    try {
      const body = await requestJson(`/api/system/storage-maintenance/runs/${run.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      showNotification(body.message, "info");
      await refreshOverview();
    } catch (error) {
      showNotification(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const historyColumns = [
    {
      title: "Proses",
      key: "run",
      render: (_, run) => (
        <Box>
          <FontStyle fontWeight={650}>
            {run.run_type === "scan" ? "Pemeriksaan file" : "Pembersihan file"}
          </FontStyle>
          <FontStyle fontSize={10.5} sx={{ mt: 0.35, color: theme.ui.mutedText }}>
            #{run.id} · diminta oleh {run.requested_by_name || "Superadmin"}
          </FontStyle>
        </Box>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (value) => (
        <CompactInfoChip
          label={statusLabels[value] || value}
          tone={statusTones[value] || "neutral"}
        />
      ),
    },
    {
      title: "Ringkasan",
      key: "summary",
      render: (_, run) =>
        run.run_type === "scan"
          ? `${run.candidate_items} aman · ${run.issue_items} perlu ditinjau`
          : `${run.cleaned_items} dibersihkan · ${run.skipped_items} dilewati · ${run.failed_items} gagal`,
    },
    {
      title: "Ukuran",
      key: "bytes",
      render: (_, run) =>
        formatBytes(run.run_type === "scan" ? run.candidate_bytes : run.cleaned_bytes),
    },
    {
      title: "Waktu",
      key: "time",
      render: (_, run) => formatDateTime(run.completed_at || run.created_at),
    },
    {
      title: "Aksi",
      key: "action",
      width: 120,
      render: (_, run) =>
        run.status === "queued" ? (
          <Button
            size="small"
            icon={<StopOutlined />}
            disabled={submitting}
            onClick={() => cancelRun(run)}
          >
            Batalkan
          </Button>
        ) : (
          <FontStyle>-</FontStyle>
        ),
    },
  ];

  const tabItems = [
    {
      key: "candidate",
      label: `Aman dibersihkan${summary ? ` (${summary.candidate_items})` : ""}`,
      children: (
        <FileItemsView
          data={itemState.data}
          loading={itemState.loading}
          error={itemState.error}
          pagination={itemState}
          onPageChange={loadItems}
          selected={new Set(selectedItems.keys())}
          onSelect={toggleItem}
        />
      ),
    },
    {
      key: "issue",
      label: `Perlu ditinjau${summary ? ` (${summary.issue_items})` : ""}`,
      children: (
        <FileItemsView
          data={itemState.data}
          loading={itemState.loading}
          error={itemState.error}
          pagination={itemState}
          onPageChange={loadItems}
          selected={new Set()}
          onSelect={() => {}}
          allowSelection={false}
        />
      ),
    },
    {
      key: "history",
      label: "Riwayat proses",
      children: runs.length ? (
        <Box sx={{ p: { xs: 2, sm: 2.5, lg: 3 } }}>
          <ModernTableFrame>
            <Table
              rowKey="id"
              dataSource={runs}
              columns={historyColumns}
              size="middle"
              scroll={{ x: 850 }}
              pagination={{ pageSize: 10, showSizeChanger: false }}
            />
          </ModernTableFrame>
        </Box>
      ) : (
        <Box sx={{ p: 3 }}>
          <EmptyState description="Belum ada riwayat pemeriksaan atau pembersihan." />
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="Penyimpanan File"
        description="Periksa dan bersihkan byte file profil yang tidak lagi digunakan tanpa menghapus metadata maupun histori audit."
      />

      <Paper
        component="section"
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5, lg: 3 },
          border: `1px solid ${theme.ui.panelBorder}`,
          borderRadius: 2,
          boxShadow: theme.ui.panelShadow,
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(280px, 420px) auto" },
            alignItems: "end",
            gap: 2,
          }}
        >
          <Box>
            <FontStyle fontWeight={700}>Organisasi yang diperiksa</FontStyle>
            <FontStyle fontSize={11.5} sx={{ mt: 0.4, mb: 1, color: theme.ui.mutedText }}>
              Satu pemeriksaan hanya berlaku untuk satu organisasi.
            </FontStyle>
            <OrganizationSelect
              value={organizationId}
              onChange={(value, option) =>
                setOrganization({ id: value || null, name: option?.label || "" })
              }
            />
          </Box>
          <Box sx={{ display: "flex", justifyContent: { xs: "stretch", md: "flex-end" } }}>
            <Button
              type="primary"
              icon={<ScanOutlined />}
              loading={submitting || activeRun?.status === "running"}
              disabled={!organizationId || hasActiveRun}
              onClick={requestScan}
              block={mobile}
            >
              {activeRun?.status === "queued"
                ? "Menunggu worker"
                : activeRun?.status === "running"
                  ? `${activeRunLabel} berjalan`
                  : "Periksa penyimpanan"}
            </Button>
          </Box>
        </Box>
      </Paper>

      {!organizationId ? (
        <DataPanel title="Hasil pemeriksaan" description="Pilih organisasi untuk memulai.">
          <Box sx={{ p: 4 }}>
            <EmptyState description="Belum ada organisasi yang dipilih." />
          </Box>
        </DataPanel>
      ) : (
        <>
          {hasActiveRun ? (
            <Alert severity="info" sx={{ "& .MuiAlert-message": { minWidth: 0, width: "100%" } }}>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", sm: "row" },
                  alignItems: { xs: "stretch", sm: "center" },
                  justifyContent: "space-between",
                  gap: 1.5,
                }}
              >
                <FontStyle>
                  {activeRun?.status === "queued"
                    ? `${activeRunLabel} masih menunggu worker. Pastikan proses sitou-file-cleanup-worker aktif di server.`
                    : `${activeRunLabel} sedang diproses. Daftar diperbarui otomatis setelah proses selesai.`}
                </FontStyle>
                {activeRun?.status === "queued" ? (
                  <Button
                    size="small"
                    icon={<StopOutlined />}
                    disabled={submitting}
                    onClick={() => cancelRun(activeRun)}
                    block={mobile}
                  >
                    Batalkan antrean
                  </Button>
                ) : null}
              </Box>
            </Alert>
          ) : null}

          <Paper
            component="section"
            elevation={0}
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" },
              gap: 0,
              border: `1px solid ${theme.ui.panelBorder}`,
              borderRadius: 2,
              overflow: "hidden",
              boxShadow: theme.ui.panelShadow,
              "& > div": {
                p: { xs: 2, sm: 2.5 },
                borderBottom: { xs: `1px solid ${theme.ui.panelBorderSubtle}`, lg: 0 },
                borderRight: { xs: 0, sm: `1px solid ${theme.ui.panelBorderSubtle}` },
              },
            }}
          >
            <Metric
              icon={<CheckCircleOutlined />}
              label="Kandidat aman"
              value={summary?.candidate_items ?? 0}
              helper="Tanpa referensi aktif"
              tone="success"
            />
            <Metric
              icon={<DeleteOutlined />}
              label="Ruang dapat dibebaskan"
              value={formatBytes(summary?.candidate_bytes)}
              helper="Berdasarkan pemeriksaan terakhir"
              tone="info"
            />
            <Metric
              icon={<WarningOutlined />}
              label="Perlu ditinjau"
              value={summary?.issue_items ?? 0}
              helper="Tidak akan dihapus otomatis"
              tone="warning"
            />
            <Metric
              icon={<HistoryOutlined />}
              label="Pembersihan terakhir"
              value={summary?.latest_cleanup_at ? `${summary.cleaned_items} file` : "Belum ada"}
              helper={formatDateTime(summary?.latest_cleanup_at)}
              tone="info"
            />
          </Paper>

          <DataPanel
            title="Hasil pemeriksaan penyimpanan"
            description={
              summary?.latest_scan_at
                ? `Pemeriksaan terakhir ${formatDateTime(summary.latest_scan_at)}.`
                : "Jalankan pemeriksaan untuk menemukan kandidat yang aman dibersihkan."
            }
            toolbar={
              activeTab === "candidate" ? (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: { xs: "stretch", sm: "center" },
                    justifyContent: "space-between",
                    flexDirection: { xs: "column", sm: "row" },
                    gap: 1.5,
                  }}
                >
                  <FontStyle fontSize={12} sx={{ color: theme.ui.mutedText }}>
                    {selection.length
                      ? `${selection.length} file dipilih · ${formatBytes(selectedBytes)}`
                      : "Pilih file yang akan diproses. Worker akan memeriksa ulang sebelum menghapus byte."}
                  </FontStyle>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    disabled={!selection.length || hasActiveRun}
                    onClick={() => setConfirmOpen(true)}
                  >
                    Bersihkan file terpilih
                  </Button>
                </Box>
              ) : null
            }
          >
            <Tabs
              activeKey={activeTab}
              onChange={(key) => {
                setActiveTab(key);
                setItemState((current) => ({ ...current, page: 1 }));
              }}
              items={tabItems}
              tabBarStyle={{ paddingInline: 24, marginBottom: 0 }}
            />
          </DataPanel>
        </>
      )}

      <AppModal
        open={confirmOpen}
        title="Hapus byte file secara permanen?"
        description="Metadata dan riwayat proses tetap disimpan. Byte file yang berhasil dibersihkan tidak dapat dipulihkan dari SITOU."
        icon={<SafetyCertificateOutlined />}
        size="sm"
        disableClose={submitting}
        onClose={() => {
          setConfirmOpen(false);
          setConfirmationAccepted(false);
        }}
        footer={
          <>
            <Button
              disabled={submitting}
              onClick={() => {
                setConfirmOpen(false);
                setConfirmationAccepted(false);
              }}
            >
              Batal
            </Button>
            <Button
              danger
              type="primary"
              icon={<DeleteOutlined />}
              loading={submitting}
              disabled={!confirmationAccepted}
              onClick={requestCleanup}
            >
              Proses pembersihan
            </Button>
          </>
        }
      >
        <Box sx={{ display: "grid", gap: 2 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(120px, auto) 1fr",
              gap: 1,
              p: 2,
              bgcolor: theme.ui.panelSubtleBg,
              borderRadius: 2,
            }}
          >
            <FontStyle sx={{ color: theme.ui.mutedText }}>Organisasi</FontStyle>
            <FontStyle fontWeight={650}>{organization.name || "-"}</FontStyle>
            <FontStyle sx={{ color: theme.ui.mutedText }}>Jumlah file</FontStyle>
            <FontStyle fontWeight={650}>{selection.length}</FontStyle>
            <FontStyle sx={{ color: theme.ui.mutedText }}>Total ukuran</FontStyle>
            <FontStyle fontWeight={650}>{formatBytes(selectedBytes)}</FontStyle>
          </Box>
          <Alert severity="warning">
            Kondisi setiap file diperiksa ulang tepat sebelum karantina. File yang kembali aktif
            atau memiliki referensi akan dilewati.
          </Alert>
          <Checkbox
            checked={confirmationAccepted}
            onChange={(event) => setConfirmationAccepted(event.target.checked)}
          >
            Saya memahami bahwa byte file yang lolos pemeriksaan akan dihapus permanen.
          </Checkbox>
        </Box>
      </AppModal>

      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
