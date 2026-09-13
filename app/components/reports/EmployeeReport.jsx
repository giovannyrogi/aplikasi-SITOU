"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Box, Typography } from "@mui/material";
import { Alert, Button, DatePicker, Input, Select, Tooltip } from "antd";
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
import {
  REPORT_TITLES,
  DEFAULT_REPORT_PAGE_SIZE,
  changeReportFilters,
  validDate,
} from "@/lib/reports/policy.mjs";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import {
  ReportIdentity,
  ReportRemaining,
  ReportCardFields,
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
  const dateErrors = {};
  if (period === "custom") {
    if (input.startDate && !validDate(input.startDate))
      dateErrors.startDate = "Tanggal awal tidak valid.";
    if (input.endDate && !validDate(input.endDate))
      dateErrors.endDate = "Tanggal akhir tidak valid.";
    if (validDate(input.startDate) && validDate(input.endDate) && input.startDate > input.endDate)
      dateErrors.endDate = "Tanggal akhir tidak boleh sebelum tanggal awal.";
  }
  const waitingForDates = period === "custom" && (!input.startDate || !input.endDate);
  const dateBlocked = waitingForDates || Object.keys(dateErrors).length > 0;

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
    if (!organizationId || dateBlocked) return;
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
  }, [kind, queryString, organizationId, reload, dateBlocked]);

  const report = !dateBlocked && state.query === queryString ? state.data : null;
  const pending = !dateBlocked && (state.loading || state.query !== queryString);
  const currentError = !dateBlocked && state.query === queryString ? state.error : null;
  const fieldErrors = { ...currentError?.fieldErrors, ...dateErrors };
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
                  validDate(input.startDate) &&
                  validDate(input.endDate) &&
                  input.startDate <= input.endDate
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
            label: "Kontrak berikutnya",
            control: select(
              "successor",
              [
                { value: "all", label: "Semua" },
                { value: "yes", label: "Sudah tercatat" },
                { value: "no", label: "Belum tercatat" },
              ],
              "Semua kontrak berikutnya",
            ),
          },
        ]
      : []),
  ].map((item) => ({
    ...item,
    control: (
      <>
        {item.control}
        {(fieldErrors[item.key] || (item.key === "startDate" && fieldErrors.endDate)) && (
          <Typography role="alert" color="error" variant="caption">
            {fieldErrors[item.key] || fieldErrors.endDate}
          </Typography>
        )}
      </>
    ),
  }));
  const filterOrder = [
    "organizationId",
    "search",
    "period",
    "startDate",
    "locationId",
    "organizationUnitId",
    "positionId",
    "employmentTypeId",
    "group",
    "successor",
  ];
  items.sort((a, b) => filterOrder.indexOf(a.key) - filterOrder.indexOf(b.key));

  /** Unduhan mengambil seluruh hasil filter; cursor halaman tidak dikirim. */
  async function exportExcel() {
    if (dateBlocked || pending || currentError) return;
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
  const detailAction = (row) => (
    <Tooltip title={retirement ? "Lihat pegawai" : "Lihat kontrak"}>
      <Button
        aria-label={`Lihat detail ${row.full_name}`}
        icon={<EyeOutlined style={{ fontSize: 20 }} />}
        onClick={() => detail(row)}
        style={{ width: 44, height: 44, flexShrink: 0 }}
      />
    </Tooltip>
  );
  const successorChip = (row) => (
    <Tooltip
      title={
        row.successor_start_date
          ? "Kontrak berikutnya sudah tercatat di sistem. Ini bukan perpanjangan otomatis."
          : "Kontrak berikutnya belum tercatat di sistem. HRD perlu meninjau kelanjutannya."
      }
    >
      <span tabIndex={0}>
        <CompactInfoChip
          label={row.successor_start_date ? "Sudah tercatat" : "Belum tercatat"}
          tone={row.successor_start_date ? "success" : "warning"}
        />
      </span>
    </Tooltip>
  );
  const columns = [
    {
      key: "employee",
      title: "Pegawai",
      width: 230,
      render: (_, row) => <ReportIdentity row={row} onPreview={setPhotoPreview} />,
    },
    {
      key: "location",
      title: "Lokasi",
      width: 170,
      render: (_, row) => row.location_name || "Belum ditempatkan",
    },
    {
      key: "unit",
      title: "Divisi & Unit",
      width: 190,
      render: (_, row) => row.unit_name || "Belum ditentukan",
    },
    {
      key: "position",
      title: "Jabatan",
      width: 160,
      render: (_, row) => row.position_name || "Belum ditentukan",
    },
    {
      key: "employment",
      title: "Jenis kepegawaian",
      width: 150,
      render: (_, row) => (
        <CompactInfoChip label={row.employment_type_name || "Belum ditentukan"} tone="neutral" />
      ),
    },
    ...(retirement
      ? [
          {
            key: "birthDate",
            title: "Tanggal lahir",
            width: 150,
            render: (_, row) => reportDate(row.birth_date),
          },
          {
            key: "age",
            title: "Usia",
            width: 100,
            render: (_, row) => (row.age == null ? "Perlu diperiksa" : `${row.age} tahun`),
          },
        ]
      : []),
    {
      key: "date",
      title: retirement ? "Proyeksi pensiun" : "Tanggal akhir",
      width: 150,
      render: (_, row) => reportDate(row.due_date),
    },
    {
      key: "remaining",
      title: "Sisa waktu",
      width: 165,
      render: (_, row) => <ReportRemaining row={row} />,
    },
    ...(!retirement
      ? [
          {
            key: "successor",
            title: "Kontrak berikutnya",
            width: 150,
            render: (_, row) => successorChip(row),
          },
        ]
      : []),
  ];
  columns.push({
    key: "action",
    title: "Aksi",
    fixed: "right",
    width: 70,
    align: "center",
    render: (_, row) => detailAction(row),
  });

  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
      <PageHeader
        title={REPORT_TITLES[kind]}
        description={
          retirement
            ? "Proyeksi usia pensiun 58 tahun untuk persiapan regenerasi. Status pegawai tetap dikelola melalui proses HRD."
            : "Pantau tanggal akhir kontrak dan apakah kontrak berikutnya sudah tercatat di sistem."
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
            ) : dateBlocked ? (
              "Lengkapi rentang tanggal pada filter laporan."
            ) : (
              "Memuat hasil laporan…"
            )
          }
          exportConfig={{
            enabled: true,
            onExcel: exportExcel,
            loading: exporting,
            disabled: dateBlocked || pending || !!currentError,
          }}
        >
          {dateBlocked ? (
            <Box
              role="status"
              sx={{ p: { xs: 2, sm: 2.5, lg: 3 }, color: "text.secondary", fontSize: 13 }}
            >
              {Object.keys(dateErrors).length
                ? "Periksa kembali rentang tanggal pada filter laporan."
                : "Pilih tanggal awal dan akhir untuk menampilkan laporan."}
            </Box>
          ) : (
            <ResponsiveDataView
              data={report?.rows || []}
              columns={columns}
              loading={pending && !currentError}
              error={currentError?.message}
              onRetry={() => {
                navigate({ ...input, cursor: undefined });
                setHistory([]);
                setReload((value) => value + 1);
              }}
              pagination={false}
              rowOffset={report?.rowOffset || 0}
              scrollX={1450}
              emptyDescription="Tidak ada data yang sesuai filter laporan."
              renderCard={(row) => (
                <Box>
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <ReportIdentity row={row} onPreview={setPhotoPreview} />
                    </Box>
                    {detailAction(row)}
                  </Box>
                  <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                    <CompactInfoChip
                      label={row.employment_type_name || "Belum ditentukan"}
                      tone="neutral"
                    />
                    <ReportRemaining row={row} />
                  </Box>
                  <ReportCardFields
                    fields={[
                      ["Lokasi", row.location_name || "Belum ditempatkan"],
                      ["Divisi & Unit", row.unit_name || "Belum ditentukan"],
                      ["Jabatan", row.position_name || "Belum ditentukan"],
                    ]}
                  />
                  <ReportCardFields
                    fields={
                      retirement
                        ? [
                            ["Tanggal lahir", reportDate(row.birth_date)],
                            [
                              "Usia",
                              row.age == null
                                ? "Tanggal lahir perlu diperiksa"
                                : `${row.age} tahun`,
                            ],
                            ["Proyeksi pensiun", reportDate(row.due_date)],
                          ]
                        : [
                            ["Tanggal akhir", reportDate(row.due_date)],
                            ["Kontrak berikutnya", successorChip(row)],
                          ]
                    }
                  />
                </Box>
              )}
            />
          )}
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
              disabled={dateBlocked || pending || !input.cursor}
              onClick={() => {
                const previous = history.at(-1);
                setHistory(history.slice(0, -1));
                navigate({ ...input, cursor: previous });
              }}
            >
              Sebelumnya
            </Button>
            <Button
              disabled={dateBlocked || pending || !report?.nextCursor || !!currentError}
              onClick={() => {
                setHistory([...history, input.cursor]);
                navigate({ ...input, cursor: report.nextCursor });
              }}
            >
              Berikutnya
            </Button>
            <Select
              aria-label="Jumlah baris per halaman"
              disabled={dateBlocked}
              value={Number(input.pageSize || DEFAULT_REPORT_PAGE_SIZE)}
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
