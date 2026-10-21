"use client";
import ResponsiveRangePicker from "@/app/components/forms/ResponsiveRangePicker";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Box } from "@mui/material";
import Typography from "@/app/components/font-style/FontStyle";
import { Button, Input, Select, Tooltip } from "antd";
import AppNotice from "@/app/components/data-display/AppNotice";
import { EyeOutlined, UnorderedListOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import DataPagination from "@/app/components/data-display/DataPagination";
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
  DISCIPLINARY_FILTER_STATUSES,
  DISCIPLINE_SEVERITIES,
  changeDisciplinaryReportFilters,
} from "@/lib/reports/disciplinaryPolicy.mjs";
import { ACTION_STATUS, SEVERITY } from "@/app/components/discipline/disciplineLabels";
import { EMPLOYEE_STATUS_PRESENTATION } from "@/app/components/employees/employeeStatus";
import { ReportIdentity, ReportCardFields, reportDate } from "./ReportEmployeeFields";
import DisciplinaryHistoryModal from "./DisciplinaryHistoryModal";
import { hrisLevel } from "@/lib/access/hrisPolicy.mjs";

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
      labelRender={
        key === "actionStatus"
          ? ({ label, value }) => label || ACTION_STATUS[value]?.[0] || value
          : undefined
      }
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
        <ResponsiveRangePicker
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
        DISCIPLINARY_FILTER_STATUSES.map((value) => ({ value, label: ACTION_STATUS[value][0] })),
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
    <Tooltip title="Lihat riwayat sanksi">
      <Button
        aria-label={`Lihat riwayat sanksi ${row.full_name}`}
        icon={<EyeOutlined />}
        onClick={() => setHistoryEmployee(row)}
        style={{ width: 44, height: 44 }}
      />
    </Tooltip>
  );
  // Ringkasan hanya berisi informasi pemindaian; dokumen dan uraian tersedia di riwayat.
  const columns = [
    {
      key: "employee",
      title: "Pegawai",
      width: 400,
      render: (_, row) => <ReportIdentity row={row} onPreview={setPhotoPreview} noWrap />,
    },
    {
      key: "location",
      title: "Lokasi",
      width: 180,
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
      width: 170,
      render: (_, row) => row.position_name || "Belum ditentukan",
    },
    {
      key: "sanction",
      title: "Sanksi terbaru",
      width: 160,
      render: (_, row) => (
        <Typography sx={{ fontSize: 13, fontWeight: 600, overflowWrap: "anywhere" }}>
          {row.action_name_snapshot}
        </Typography>
      ),
    },
    {
      key: "status",
      title: "Status sanksi",
      width: 130,
      render: (_, row) => (
        <CompactInfoChip
          label={ACTION_STATUS[row.action_status]?.[0] || row.action_status}
          tone={ACTION_STATUS[row.action_status]?.[1] || "neutral"}
        />
      ),
    },
    {
      key: "issuedDate",
      title: "Tanggal terbit",
      width: 130,
      render: (_, row) => reportDate(row.issued_date),
    },
    {
      key: "total",
      title: "Total sanksi",
      width: 110,
      align: "center",
      render: (_, row) => row.total_official_actions,
    },
    {
      key: "action",
      title: "Aksi",
      fixed: "right",
      width: 72,
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
      {referenceError ? <AppNotice tone="danger" title={referenceError} /> : null}
      {exportError ? <AppNotice tone="danger" title={exportError} /> : null}
      {!organizationId ? (
        <AppNotice tone="info" title="Pilih organisasi untuk menampilkan laporan." />
      ) : (
        <DataPanel
          title="Hasil laporan"
          description="Sanksi terbaru mengikuti filter. Total sanksi mencakup seluruh sanksi resmi pegawai, termasuk yang berakhir, dicabut, atau digantikan."
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
            scrollX="max-content"
            emptyDescription="Belum ada pegawai dengan tindakan disiplin resmi yang sesuai filter."
            renderCard={(row) => (
              <Box sx={{ display: "grid", gap: 2 }}>
                <ReportIdentity row={row} onPreview={setPhotoPreview} />
                <Box
                  sx={{ bgcolor: "action.hover", borderRadius: 2, p: 1.5, display: "grid", gap: 1 }}
                >
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                    Sanksi terbaru sesuai filter
                  </Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>
                    {row.action_name_snapshot}
                  </Typography>
                  <Box>
                    <CompactInfoChip
                      label={ACTION_STATUS[row.action_status]?.[0] || row.action_status}
                      tone={ACTION_STATUS[row.action_status]?.[1] || "neutral"}
                    />
                  </Box>
                  <ReportCardFields
                    fields={[
                      ["Tanggal terbit", reportDate(row.issued_date)],
                      ["Lokasi", row.location_name || "Belum ditempatkan"],
                      ["Divisi & Unit", row.unit_name || "Belum ditentukan"],
                      ["Jabatan", row.position_name || "Belum ditentukan"],
                      ["Tingkat", SEVERITY[row.severity]?.[0] || row.severity],
                    ]}
                  />
                </Box>
                <ReportCardFields
                  fields={[["Total sanksi", `${row.total_official_actions} sanksi`]]}
                />
                <Button
                  block
                  icon={<UnorderedListOutlined />}
                  onClick={() => setHistoryEmployee(row)}
                  style={{ minHeight: 44 }}
                >
                  Lihat riwayat sanksi
                </Button>
              </Box>
            )}
          />
          <Box sx={{ p: 2 }}>
            <DataPagination
              cursor={{
                page: cursorHistory.length + 1,
                next: !dateBlocked && !currentError ? report?.nextCursor : null,
              }}
              displayedCount={report?.rows?.length}
              total={!dateBlocked && !currentError ? report?.total : null}
              pageSize={Number(input.pageSize || 10)}
              loading={dateBlocked || pending}
              onPrevious={() => {
                const previous = cursorHistory.at(-1);
                setCursorHistory(cursorHistory.slice(0, -1));
                navigate({ ...input, cursor: previous });
              }}
              onNext={() => {
                setCursorHistory([...cursorHistory, input.cursor]);
                navigate({ ...input, cursor: report.nextCursor });
              }}
              onPageSizeChange={(value) => change("pageSize", value)}
              sx={{ pt: 0 }}
            />
          </Box>
        </DataPanel>
      )}
      <DisciplinaryHistoryModal
        open={Boolean(historyEmployee)}
        employee={historyEmployee}
        organizationId={organizationId}
        onClose={() => setHistoryEmployee(null)}
        onOpenEmployee={hrisLevel(user, "employees") ? openEmployee : undefined}
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
