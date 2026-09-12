"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Box, Typography } from "@mui/material";
import { Alert, Button, DatePicker, Input, Select } from "antd";
import dayjs from "dayjs";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import OperationalFilterSection from "@/app/components/filters/OperationalFilterSection";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { readApiResponse, normalizeRequestError } from "@/lib/api/clientError";
import { REPORT_TITLES, changeReportFilters } from "@/lib/reports/policy.mjs";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import {
  ReportIdentity,
  ReportPlacement,
  ReportEmployment,
  ReportDeadline,
  reportDate,
} from "./ReportEmployeeFields";
import { EyeOutlined } from "@ant-design/icons";

/** Dua laporan memakai interaksi filter, daftar, dan ekspor yang sama. */
export default function EmployeeReport({ kind }) {
  const user = useAuthenticatedUser();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { startNavigationLoading } = useLoadingBackdrop();
  const retirement = kind === "retirements";
  const organizationId =
    user.role_code === "superadmin" ? params.get("organizationId") : String(user.organization_id);
  const input = Object.fromEntries(params);
  const group = input.group || "upcoming";
  const period =
    input.period || (["overdue", "invalid"].includes(group) ? "none" : retirement ? "12m" : "30d");
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [references, setReferences] = useState({});
  const [referenceError, setReferenceError] = useState("");
  const [reload, setReload] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const query = new URLSearchParams(params.toString());
  if (organizationId) query.set("organizationId", organizationId);
  const queryString = query.toString();

  /** URL menjadi sumber filter agar navigasi kembali dan bookmark tetap konsisten. */
  function navigate(values) {
    const next = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") next.set(key, String(value));
    });
    window.history.replaceState(null, "", `${pathname}?${next}`);
  }
  function change(key, value) {
    const next = changeReportFilters(input, key, value, kind);
    if (key === "organizationId")
      ["locationId", "organizationUnitId", "positionId", "employmentTypeId"].forEach(
        (k) => delete next[k],
      );
    if (key === "locationId") delete next.organizationUnitId;
    setHistory([]);
    navigate(next);
  }

  useEffect(() => {
    if (!organizationId) return;
    const controller = new AbortController();
    fetch(`/api/employees/reference-options?organizationId=${organizationId}`, {
      signal: controller.signal,
    })
      .then(readApiResponse)
      .then((body) => {
        setReferences(body.data || {});
        setReferenceError("");
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setReferences({});
          setReferenceError(normalizeRequestError(error).message);
        }
      });
    return () => controller.abort();
  }, [organizationId, reload]);

  useEffect(() => {
    if (!organizationId) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState((current) => ({ ...current, loading: true, error: null }));
      fetch(`/api/reports/${kind}?${queryString}`, { signal: controller.signal })
        .then(readApiResponse)
        .then((body) =>
          setState({ loading: false, data: body.data, error: null, query: queryString }),
        )
        .catch((error) => {
          if (error.name !== "AbortError")
            setState({
              loading: false,
              data: null,
              error: normalizeRequestError(error),
              query: queryString,
            });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [kind, queryString, organizationId, reload]);

  const report = state.query === queryString ? state.data : null;
  const pending = state.loading || state.query !== queryString;
  const fieldErrors = state.error?.fieldErrors || {};
  const select = (key, options, placeholder) => (
    <Select
      aria-label={placeholder}
      status={fieldErrors[key] ? "error" : undefined}
      value={input[key] || undefined}
      allowClear
      showSearch
      optionFilterProp="label"
      placeholder={placeholder}
      options={options}
      onChange={(value) => change(key, value)}
    />
  );
  const options = (key) =>
    (references[key] || []).map((item) => ({ value: String(item.id), label: item.name }));
  const items = [
    ...(user.role_code === "superadmin"
      ? [
          {
            key: "organizationId",
            label: "Organisasi",
            control: (
              <OrganizationSelect
                value={organizationId}
                onChange={(value) => change("organizationId", value)}
              />
            ),
          },
        ]
      : []),
    {
      key: "search",
      label: "Cari pegawai",
      control: (
        <Input
          aria-label="Cari nama atau NIP"
          value={input.search || ""}
          onChange={(event) => change("search", event.target.value)}
          placeholder="Nama atau NIP"
          style={{ minHeight: 44 }}
        />
      ),
    },
    ...[
      ["locationId", "Lokasi", "locations"],
      ["organizationUnitId", "Divisi & Unit", "organizationUnits"],
      ["positionId", "Jabatan", "positions"],
      ["employmentTypeId", "Jenis kepegawaian", "employmentTypes"],
    ].map(([key, label, source]) => ({
      key,
      label,
      control: select(key, options(source), `Semua ${label.toLowerCase()}`),
    })),
    {
      key: "group",
      label: "Kelompok",
      control: (
        <Select
          aria-label="Kelompok laporan"
          value={group}
          onChange={(value) => change("group", value)}
          options={[
            {
              value: "upcoming",
              label: retirement ? "Akan mencapai usia pensiun" : "Akan berakhir",
            },
            {
              value: "overdue",
              label: retirement ? "Sudah mencapai usia pensiun" : "Sudah lewat tanggal akhir",
            },
            { value: "all", label: "Semua dalam periode" },
            ...(retirement ? [{ value: "invalid", label: "Tanggal lahir perlu diperiksa" }] : []),
          ]}
        />
      ),
    },
    {
      key: "period",
      label: "Periode",
      control: (
        <Select
          aria-label="Periode laporan"
          value={period}
          disabled={group === "invalid"}
          onChange={(value) => change("period", value)}
          options={[
            ...(group === "overdue" || group === "invalid"
              ? [
                  {
                    value: "none",
                    label: group === "invalid" ? "Tidak memakai periode" : "Seluruh yang terlewat",
                  },
                ]
              : []),
            ...(retirement
              ? [3, 6, 12, 24].map((n) => ({ value: `${n}m`, label: `${n} bulan ke depan` }))
              : [30, 60, 90].map((n) => ({ value: `${n}d`, label: `${n} hari ke depan` }))),
            ...(retirement ? [{ value: "year", label: "Tahun ini" }] : []),
            { value: "custom", label: "Rentang tanggal sendiri" },
          ]}
        />
      ),
    },
    ...(period === "custom"
      ? [
          {
            key: "startDate",
            label: "Rentang tanggal",
            control: (
              <DatePicker.RangePicker
                aria-label="Rentang tanggal laporan"
                status={fieldErrors.startDate || fieldErrors.endDate ? "error" : undefined}
                value={
                  input.startDate && input.endDate
                    ? [dayjs(input.startDate), dayjs(input.endDate)]
                    : null
                }
                format="DD MMM YYYY"
                onChange={(dates) => {
                  setHistory([]);
                  navigate({
                    ...input,
                    cursor: undefined,
                    startDate: dates?.[0]?.format("YYYY-MM-DD"),
                    endDate: dates?.[1]?.format("YYYY-MM-DD"),
                  });
                }}
              />
            ),
          },
        ]
      : []),
    ...(!retirement
      ? [
          {
            key: "successor",
            label: "Kontrak lanjutan",
            control: select(
              "successor",
              [
                { value: "all", label: "Semua" },
                { value: "yes", label: "Sudah tercatat" },
                { value: "no", label: "Belum tercatat" },
              ],
              "Semua kontrak lanjutan",
            ),
          },
        ]
      : []),
  ].map((item) => ({
    ...item,
    control: (
      <>
        {item.control}
        {fieldErrors[item.key] && (
          <Typography role="alert" color="error" variant="caption">
            {fieldErrors[item.key]}
          </Typography>
        )}
      </>
    ),
  }));

  /** Unduhan mengambil seluruh hasil filter; cursor halaman tidak dikirim. */
  async function exportExcel() {
    setExporting(true);
    setExportError("");
    try {
      const exportQuery = new URLSearchParams(queryString);
      exportQuery.delete("cursor");
      const response = await fetch(`/api/reports/${kind}/export?${exportQuery}`);
      if (!response.ok) await readApiResponse(response);
      if (!response.headers.get("content-type")?.includes("spreadsheetml"))
        throw new Error("Unduhan tidak tersedia. Periksa sesi login lalu coba kembali.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `sitou-${kind}-${report?.asOf || "laporan"}.xlsx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(normalizeRequestError(error).message);
    } finally {
      setExporting(false);
    }
  }
  function detail(row) {
    startNavigationLoading();
    router.push(
      `/employees/${row.employee_id}?organizationId=${organizationId}&tab=${retirement ? "summary" : "contracts"}`,
    );
  }
  const columns = [
    {
      key: "employee",
      title: "Pegawai",
      width: 230,
      render: (_, row) => <ReportIdentity row={row} onPreview={setPhotoPreview} />,
    },
    {
      key: "placement",
      title: "Penempatan",
      width: 190,
      render: (_, row) => <ReportPlacement row={row} />,
    },
    {
      key: "employment",
      title: retirement ? "Usia & masa kerja" : "Kontrak",
      width: 200,
      render: (_, row) => <ReportEmployment row={row} retirement={retirement} />,
    },
    {
      key: "deadline",
      title: retirement ? "Proyeksi pensiun" : "Batas waktu",
      width: 185,
      render: (_, row) => <ReportDeadline row={row} retirement={retirement} />,
    },
  ];
  columns.push({
    key: "action",
    title: "Aksi",
    fixed: "right",
    width: 70,
    align: "center",
    render: (_, row) => (
      <Button
        title={retirement ? "Lihat pegawai" : "Lihat kontrak"}
        onClick={() => detail(row)}
        aria-label={`Lihat detail ${row.full_name}`}
      >
        <EyeOutlined style={{ fontSize: 20 }} />
      </Button>
    ),
  });

  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
      <PageHeader
        title={REPORT_TITLES[kind]}
        description={
          retirement
            ? "Proyeksi usia pensiun 58 tahun untuk persiapan regenerasi. Status pegawai tetap dikelola melalui proses HRD."
            : "Pantau akhir kontrak dan kesiapan kontrak lanjutan pegawai."
        }
      />
      <OperationalFilterSection
        title="Filter laporan"
        description="Sesuaikan periode dan kelompok untuk melihat yang akan datang atau sudah terlewat."
        items={items}
        wideColumns={4}
        onReset={() => {
          setHistory([]);
          navigate({ organizationId });
        }}
      />
      {referenceError && <Alert type="error" title={referenceError} showIcon />}
      {exportError && <Alert type="error" title={exportError} showIcon />}
      {!organizationId ? (
        <Alert type="info" title="Pilih organisasi untuk menampilkan laporan." showIcon />
      ) : (
        <DataPanel
          title="Hasil laporan"
          description={
            report ? (
              <Box
                component="span"
                sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}
              >
                <CompactInfoChip
                  label={`${report.total} ${retirement ? "pegawai" : "kontrak"}`}
                  tone="info"
                />
                {!retirement ? (
                  <CompactInfoChip label={`${report.employeeCount} pegawai unik`} tone="neutral" />
                ) : null}
                <span>
                  {report.filters.startDate
                    ? `${reportDate(report.filters.startDate)} - ${reportDate(report.filters.endDate)}`
                    : "Tanpa batas periode"}
                </span>
                <span>Acuan {reportDate(report.asOf)}</span>
                <span>Diperbarui {dayjs(report.generatedAt).format("DD MMM YYYY, HH:mm")}</span>
              </Box>
            ) : (
              "Memuat hasil laporan…"
            )
          }
          exportConfig={{
            enabled: true,
            onExcel: exportExcel,
            loading: exporting,
            disabled: pending || !!state.error,
          }}
        >
          <ResponsiveDataView
            data={report?.rows || []}
            columns={columns}
            loading={pending && !state.error}
            error={state.error?.message}
            onRetry={() => {
              navigate({ ...input, cursor: undefined });
              setHistory([]);
              setReload((value) => value + 1);
            }}
            pagination={false}
            rowOffset={report?.rowOffset || 0}
            scrollX={920}
            emptyDescription="Tidak ada data yang sesuai filter laporan."
            renderCard={(row) => (
              <Box sx={{ display: "grid", gap: 2 }}>
                <ReportIdentity row={row} onPreview={setPhotoPreview} />
                <ReportDeadline row={row} retirement={retirement} />
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" },
                  }}
                >
                  <ReportPlacement row={row} />
                  <ReportEmployment row={row} retirement={retirement} />
                </Box>
                <Button onClick={() => detail(row)}>
                  {retirement ? "Lihat pegawai" : "Lihat kontrak"}
                </Button>
              </Box>
            )}
          />
          <Box
            sx={{
              display: "flex",
              gap: 1,
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "flex-end",
              p: 2,
            }}
          >
            <Button
              disabled={pending || !input.cursor}
              onClick={() => {
                const previous = history.at(-1);
                setHistory(history.slice(0, -1));
                navigate({ ...input, cursor: previous });
              }}
            >
              Sebelumnya
            </Button>
            <Button
              disabled={pending || !report?.nextCursor || !!state.error}
              onClick={() => {
                setHistory([...history, input.cursor]);
                navigate({ ...input, cursor: report.nextCursor });
              }}
            >
              Berikutnya
            </Button>
            <Select
              aria-label="Jumlah baris per halaman"
              value={Number(input.pageSize || 20)}
              onChange={(value) => change("pageSize", value)}
              options={[10, 20, 50].map((value) => ({ value, label: `${value} / halaman` }))}
            />
          </Box>
        </DataPanel>
      )}
      <ImagePreviewModal
        open={Boolean(photoPreview)}
        onClose={() => setPhotoPreview(null)}
        imageUrl={photoPreview?.imageUrl}
        alt={photoPreview?.alt}
        title={photoPreview?.title}
      />
    </Box>
  );
}
