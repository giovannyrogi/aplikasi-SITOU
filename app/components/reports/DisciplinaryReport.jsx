"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Box, Typography } from "@mui/material";
import { Alert, Button, DatePicker, Input, Select, Tooltip } from "antd";
import { HistoryOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import OperationalFilterSection from "@/app/components/filters/OperationalFilterSection";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { readApiResponse, normalizeRequestError } from "@/lib/api/clientError";
import { validDate } from "@/lib/reports/policy.mjs";
import {
  OFFICIAL_ACTION_STATUSES,
  DISCIPLINE_SEVERITIES,
  changeDisciplinaryReportFilters,
} from "@/lib/reports/disciplinaryPolicy.mjs";
import { ACTION_STATUS, SEVERITY } from "@/app/components/discipline/disciplineLabels";
import { formatDisciplinaryValidityPeriod } from "@/lib/discipline/presentation.mjs";
import { EMPLOYEE_STATUS_PRESENTATION } from "@/app/components/employees/employeeStatus";
import { ReportIdentity, ReportCardFields, reportDate } from "./ReportEmployeeFields";
import DisciplinaryHistoryModal from "./DisciplinaryHistoryModal";

const ALL = "all";

export default function DisciplinaryReport() {
  const user = useAuthenticatedUser();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { startNavigationLoading } = useLoadingBackdrop();
  const organizationId =
    user.role_code === "superadmin" ? params.get("organizationId") : String(user.organization_id);
  const input = Object.fromEntries(params);
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [references, setReferences] = useState({});
  const [referenceError, setReferenceError] = useState("");
  const [reload, setReload] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);
  const [historyEmployee, setHistoryEmployee] = useState(null);
  const [cursorHistory, setCursorHistory] = useState([]);
  const query = new URLSearchParams(params.toString());
  if (organizationId) query.set("organizationId", organizationId);
  const queryString = query.toString();
  const dateErrors = {};
  if (!!input.startDate !== !!input.endDate)
    dateErrors[input.startDate ? "endDate" : "startDate"] = "Pilih tanggal awal dan akhir.";
  if (input.startDate && !validDate(input.startDate))
    dateErrors.startDate = "Tanggal awal tidak valid.";
  if (input.endDate && !validDate(input.endDate)) dateErrors.endDate = "Tanggal akhir tidak valid.";
  if (validDate(input.startDate) && validDate(input.endDate) && input.startDate > input.endDate)
    dateErrors.endDate = "Tanggal akhir tidak boleh sebelum tanggal awal.";
  const dateBlocked = Object.keys(dateErrors).length > 0;

  function navigate(values) {
    const next = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "" && value !== ALL)
        next.set(key, String(value));
    });
    window.history.replaceState(null, "", `${pathname}?${next}`);
  }
  function change(key, value) {
    const next = changeDisciplinaryReportFilters(input, key, value);
    if (key === "organizationId") {
      delete next.locationId;
      delete next.organizationUnitId;
      delete next.positionId;
    }
    if (key === "locationId") delete next.organizationUnitId;
    setCursorHistory([]);
    navigate(next);
  }

  useEffect(() => {
    if (!organizationId) return;
    const controller = new AbortController();
    Promise.all([
      fetch(`/api/employees/reference-options?organizationId=${organizationId}`, {
        signal: controller.signal,
      }).then(readApiResponse),
      fetch(
        `/api/discipline/action-types?options=true&activeOnly=false&organizationId=${organizationId}`,
        { signal: controller.signal },
      ).then(readApiResponse),
    ])
      .then(([referenceBody, actionTypeBody]) => {
        setReferences({ ...(referenceBody.data || {}), actionTypes: actionTypeBody.data || [] });
        setReferenceError("");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setReferenceError(normalizeRequestError(error).message);
      });
    return () => controller.abort();
  }, [organizationId, reload]);

  useEffect(() => {
    if (!organizationId || dateBlocked) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState((current) => ({ ...current, loading: true, error: null }));
      fetch(`/api/reports/disciplinary-actions?${queryString}`, { signal: controller.signal })
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
  }, [organizationId, queryString, reload, dateBlocked]);

  const report = !dateBlocked && state.query === queryString ? state.data : null;
  const pending = !dateBlocked && (state.loading || state.query !== queryString);
  const currentError = !dateBlocked && state.query === queryString ? state.error : null;
  const fieldErrors = { ...currentError?.fieldErrors, ...dateErrors };
  const options = (key) =>
    (references[key] || []).map((item) => ({ value: String(item.id), label: item.name }));
  const select = (key, selectOptions, placeholder) => (
    <Select
      aria-label={placeholder}
      value={input[key] || ALL}
      status={fieldErrors[key] ? "error" : undefined}
      showSearch
      optionFilterProp="label"
      options={[{ value: ALL, label: placeholder }, ...selectOptions]}
      onChange={(value) => change(key, value)}
    />
  );
  const filters = [
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
      label: "Cari",
      control: (
        <Input
          allowClear
          aria-label="Cari nama, NIP, nomor kasus, atau nomor surat"
          value={input.search || ""}
          placeholder="Nama, NIP, kasus, atau surat"
          onChange={(event) => change("search", event.target.value)}
        />
      ),
    },
    {
      key: "dateRange",
      label: "Tanggal penerbitan",
      control: (
        <DatePicker.RangePicker
          allowClear
          aria-label="Rentang tanggal penerbitan sanksi"
          status={fieldErrors.startDate || fieldErrors.endDate ? "error" : undefined}
          value={
            validDate(input.startDate) && validDate(input.endDate)
              ? [dayjs(input.startDate), dayjs(input.endDate)]
              : null
          }
          format="DD MMM YYYY"
          presets={[
            {
              label: "3 bulan terakhir",
              value: [dayjs().subtract(3, "month").startOf("day"), dayjs()],
            },
            {
              label: "6 bulan terakhir",
              value: [dayjs().subtract(6, "month").startOf("day"), dayjs()],
            },
            { label: "Tahun ini", value: [dayjs().startOf("year"), dayjs().endOf("year")] },
          ]}
          onChange={(dates) => {
            setCursorHistory([]);
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
    {
      key: "locationId",
      label: "Lokasi",
      control: select("locationId", options("locations"), "Semua lokasi"),
    },
    {
      key: "organizationUnitId",
      label: "Divisi & Unit",
      control: select("organizationUnitId", options("organizationUnits"), "Semua Divisi & Unit"),
    },
    {
      key: "positionId",
      label: "Jabatan",
      control: select("positionId", options("positions"), "Semua jabatan"),
    },
    {
      key: "employmentStatus",
      label: "Status pegawai",
      control: select(
        "employmentStatus",
        Object.entries(EMPLOYEE_STATUS_PRESENTATION).map(([value, [label]]) => ({ value, label })),
        "Semua status pegawai",
      ),
    },
    {
      key: "severity",
      label: "Tingkat pelanggaran",
      control: select(
        "severity",
        DISCIPLINE_SEVERITIES.map((value) => ({ value, label: SEVERITY[value][0] })),
        "Semua tingkat",
      ),
    },
    {
      key: "actionTypeId",
      label: "Jenis sanksi",
      control: select(
        "actionTypeId",
        (references.actionTypes || []).map((item) => ({ value: item.id, label: item.name })),
        "Semua jenis sanksi",
      ),
    },
    {
      key: "actionStatus",
      label: "Status tindakan",
      control: select(
        "actionStatus",
        OFFICIAL_ACTION_STATUSES.map((value) => ({ value, label: ACTION_STATUS[value][0] })),
        "Semua status tindakan",
      ),
    },
  ].map((item) => ({
    ...item,
    control: (
      <>
        {item.control}
        {fieldErrors[item.key] ||
        (item.key === "dateRange" && (fieldErrors.startDate || fieldErrors.endDate)) ? (
          <Typography role="alert" color="error" variant="caption">
            {fieldErrors[item.key] || fieldErrors.startDate || fieldErrors.endDate}
          </Typography>
        ) : null}
      </>
    ),
  }));

  async function exportExcel() {
    if (dateBlocked || pending || currentError) return;
    setExporting(true);
    setExportError("");
    try {
      const exportQuery = new URLSearchParams(queryString);
      exportQuery.delete("cursor");
      const response = await fetch(`/api/reports/disciplinary-actions/export?${exportQuery}`);
      if (!response.ok) await readApiResponse(response);
      if (!response.headers.get("content-type")?.includes("spreadsheetml"))
        throw new Error("Unduhan tidak tersedia. Periksa sesi lalu coba kembali.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `sitou-disciplinary-actions-${report?.asOf || "laporan"}.xlsx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(normalizeRequestError(error).message);
    } finally {
      setExporting(false);
    }
  }
  function openEmployee(row) {
    setHistoryEmployee(null);
    startNavigationLoading();
    router.push(`/employees/${row.employee_id}?organizationId=${organizationId}&tab=discipline`);
  }
  const actionButton = (row) => (
    <Tooltip title="Lihat histori sanksi">
      <Button
        aria-label={`Lihat histori sanksi ${row.full_name}`}
        icon={<HistoryOutlined />}
        onClick={() => setHistoryEmployee(row)}
        style={{ width: 44, height: 44 }}
      />
    </Tooltip>
  );
  const columns = [
    {
      key: "employee",
      title: "Pegawai",
      width: 230,
      render: (_, row) => {
        const employment = EMPLOYEE_STATUS_PRESENTATION[row.employment_status] || [
          row.employment_status,
          "neutral",
        ];
        return (
          <Box>
            <ReportIdentity row={row} onPreview={setPhotoPreview} />
            <Box sx={{ mt: 1 }}>
              <CompactInfoChip label={employment[0]} tone={employment[1]} />
            </Box>
          </Box>
        );
      },
    },
    {
      key: "placement",
      title: "Penempatan",
      width: 220,
      render: (_, row) => (
        <Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>
            {row.location_name || "Belum ditempatkan"}
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: "text.secondary", mt: 0.4 }}>
            {row.unit_name || "Unit belum ditentukan"} ·{" "}
            {row.position_name || "Jabatan belum ditentukan"}
          </Typography>
        </Box>
      ),
    },
    {
      key: "sanction",
      title: "Sanksi terbaru",
      width: 190,
      render: (_, row) => (
        <Box sx={{ display: "grid", gap: 0.75, justifyItems: "start" }}>
          <CompactInfoChip
            label={row.action_name_snapshot}
            tone="danger"
          />
          <CompactInfoChip
            label={ACTION_STATUS[row.action_status]?.[0] || row.action_status}
            tone={ACTION_STATUS[row.action_status]?.[1] || "neutral"}
          />
          {row.direct_escalation ? (
            <CompactInfoChip label="Eskalasi langsung" tone="warning" />
          ) : null}
        </Box>
      ),
    },
    {
      key: "severity",
      title: "Tingkat",
      width: 110,
      render: (_, row) => (
        <CompactInfoChip
          label={SEVERITY[row.severity]?.[0] || row.severity}
          tone={SEVERITY[row.severity]?.[1] || "neutral"}
        />
      ),
    },
    {
      key: "caseNumber",
      title: "Nomor kasus",
      width: 165,
      render: (_, row) => row.case_no,
    },
    {
      key: "incidentDate",
      title: "Tanggal kejadian",
      width: 145,
      render: (_, row) => reportDate(row.incident_date),
    },
    {
      key: "letterNumber",
      title: "Nomor surat",
      width: 155,
      render: (_, row) =>
        row.letter_no ||
        (!row.requires_document_snapshot ? "Tidak memerlukan surat" : "Belum tersedia"),
    },
    {
      key: "issuedDate",
      title: "Tanggal terbit",
      width: 140,
      render: (_, row) => reportDate(row.issued_date),
    },
    {
      key: "validity",
      title: "Masa berlaku",
      width: 250,
      render: (_, row) =>
        formatDisciplinaryValidityPeriod(row.effective_from, row.effective_until, reportDate),
    },
    {
      key: "issuer",
      title: "Penerbit",
      width: 170,
      render: (_, row) => row.issued_by_name || "Belum tersedia",
    },
    {
      key: "counts",
      title: "Ringkasan",
      width: 170,
      render: (_, row) => (
        <Box sx={{ display: "grid", gap: 0.7 }}>
          <CompactInfoChip label={`${row.matched_action_count} sesuai filter`} tone="info" />
          <CompactInfoChip label={`${row.total_official_actions} total riwayat`} tone="neutral" />
          <Tooltip title="Tindakan yang masih aktif atau sedang dalam proses banding.">
            <span tabIndex={0}>
              <CompactInfoChip
                label={`${row.active_or_appealed_count} belum selesai`}
                tone={row.active_or_appealed_count ? "warning" : "neutral"}
              />
            </span>
          </Tooltip>
        </Box>
      ),
    },
    {
      key: "action",
      title: "Aksi",
      fixed: "right",
      width: 70,
      align: "center",
      render: (_, row) => actionButton(row),
    },
  ];

  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
      <PageHeader
        title="Sanksi Pegawai"
        description="Pantau pegawai yang memiliki tindakan disiplin resmi. Laporan ini tidak menerbitkan atau mengubah keputusan sanksi."
      />
      <OperationalFilterSection
        title="Filter laporan"
        description="Filter diterapkan pada tindakan resmi; setiap pegawai ditampilkan satu kali dengan sanksi terbaru dari hasil filter."
        items={filters}
        wideColumns={4}
        onReset={() => {
          setCursorHistory([]);
          navigate({ organizationId });
        }}
      />
      {referenceError ? <Alert type="error" title={referenceError} showIcon /> : null}
      {exportError ? <Alert type="error" title={exportError} showIcon /> : null}
      {!organizationId ? (
        <Alert type="info" title="Pilih organisasi untuk menampilkan laporan." showIcon />
      ) : (
        <DataPanel
          title="Hasil laporan"
          description="Daftar pegawai beserta sanksi terbaru dan ringkasan riwayat sesuai filter."
          exportConfig={{
            enabled: true,
            onExcel: exportExcel,
            loading: exporting,
            disabled: dateBlocked || pending || !!currentError,
          }}
        >
          <ResponsiveDataView
            data={report?.rows || []}
            columns={columns}
            loading={pending && !currentError}
            error={
              currentError?.message ||
              (dateBlocked ? "Periksa kembali rentang tanggal laporan." : undefined)
            }
            onRetry={() => {
              navigate({ ...input, cursor: undefined });
              setCursorHistory([]);
              setReload((value) => value + 1);
            }}
            pagination={false}
            scrollX={2050}
            emptyDescription="Belum ada pegawai dengan tindakan disiplin resmi yang sesuai filter."
            renderCard={(row) => (
              <Box>
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <ReportIdentity row={row} onPreview={setPhotoPreview} />
                  </Box>
                  {actionButton(row)}
                </Box>
                <Box sx={{ mt: 1.5, display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                  <CompactInfoChip
                    label={
                      (EMPLOYEE_STATUS_PRESENTATION[row.employment_status] || [
                        row.employment_status,
                      ])[0]
                    }
                    tone={
                      (EMPLOYEE_STATUS_PRESENTATION[row.employment_status] || [null, "neutral"])[1]
                    }
                  />
                  <CompactInfoChip
                    label={row.action_name_snapshot}
                    tone="danger"
                  />
                  <CompactInfoChip
                    label={ACTION_STATUS[row.action_status]?.[0] || row.action_status}
                    tone={ACTION_STATUS[row.action_status]?.[1] || "neutral"}
                  />
                  <CompactInfoChip
                    label={SEVERITY[row.severity]?.[0] || row.severity}
                    tone={SEVERITY[row.severity]?.[1] || "neutral"}
                  />
                  {row.direct_escalation ? (
                    <CompactInfoChip label="Eskalasi langsung" tone="warning" />
                  ) : null}
                </Box>
                <ReportCardFields
                  fields={[
                    ["Nomor kasus", row.case_no],
                    ["Tanggal kejadian", reportDate(row.incident_date)],
                    [
                      "Nomor surat",
                      row.letter_no ||
                        (!row.requires_document_snapshot
                          ? "Tidak diperlukan"
                          : "Belum tersedia"),
                    ],
                    ["Tanggal terbit", reportDate(row.issued_date)],
                    [
                      "Masa berlaku",
                      formatDisciplinaryValidityPeriod(
                        row.effective_from,
                        row.effective_until,
                        reportDate,
                      ),
                    ],
                    [
                      "Penempatan",
                      `${row.location_name || "Belum ditempatkan"} · ${row.unit_name || "Unit belum ditentukan"}`,
                    ],
                    ["Penerbit", row.issued_by_name || "Belum tersedia"],
                    [
                      "Ringkasan",
                      <Box key="mobile-summary" component="span">
                        {row.matched_action_count} sesuai filter · {row.total_official_actions}{" "}
                        total riwayat ·{" "}
                        <Tooltip title="Tindakan yang masih aktif atau sedang dalam proses banding.">
                          <Box
                            component="span"
                            tabIndex={0}
                            sx={{ textDecoration: "underline dotted" }}
                          >
                            {row.active_or_appealed_count} belum selesai
                          </Box>
                        </Tooltip>
                      </Box>,
                    ],
                  ]}
                />
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
                const previous = cursorHistory.at(-1);
                setCursorHistory(cursorHistory.slice(0, -1));
                navigate({ ...input, cursor: previous });
              }}
            >
              Sebelumnya
            </Button>
            <Button
              disabled={pending || !report?.nextCursor || !!currentError}
              onClick={() => {
                setCursorHistory([...cursorHistory, input.cursor]);
                navigate({ ...input, cursor: report.nextCursor });
              }}
            >
              Berikutnya
            </Button>
            <Select
              aria-label="Jumlah baris per halaman"
              value={Number(input.pageSize || 10)}
              onChange={(value) => change("pageSize", value)}
              options={[10, 20, 50].map((value) => ({ value, label: `${value} / halaman` }))}
            />
          </Box>
        </DataPanel>
      )}
      <DisciplinaryHistoryModal
        open={Boolean(historyEmployee)}
        employee={historyEmployee}
        organizationId={organizationId}
        onClose={() => setHistoryEmployee(null)}
        onOpenEmployee={openEmployee}
      />
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
