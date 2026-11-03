"use client";
import { useState } from "react";
import { Button, Checkbox, Form, Input, Space } from "antd";

import { Box } from "@mui/material";
import Select from "@/app/components/forms/AsyncSelect";
import BulkScheduleExceptionDialog from "./BulkScheduleExceptionDialog";
import { CalendarOutlined, ScheduleOutlined } from "@ant-design/icons";

import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import OperationalFilterSection from "@/app/components/filters/OperationalFilterSection";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import RowActionMenu from "@/app/components/actions/RowActionMenu";
import AppModal from "@/app/components/modals/AppModal";
import SelectedEmployeesSummary from "@/app/components/employees/SelectedEmployeesSummary";
import EmployeeAvatar from "@/app/components/employees/EmployeeAvatar";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import AppNotice from "@/app/components/data-display/AppNotice";
import { InfoField } from "@/app/components/employees/EmployeeDetailSections";
import ScheduleHistory from "./ScheduleHistory";
import EmployeeScheduleSummary from "./EmployeeScheduleSummary";

import Notification from "@/app/components/Notifications/Notification";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import useAppNotification from "@/app/hooks/useAppNotification";
import useDataList from "@/app/hooks/useDataList";
import { hrisLevel } from "@/lib/access/hrisPolicy.mjs";
import {
  scheduleRequest,
  requestKey,
  applyFieldErrors,
  WorkScheduleFields,
  useScheduleOptions,
} from "./ScheduleFields";
/** Workspace sama digunakan menu utama dan detail Pegawai. */
export default function WorkSchedulePage({ employeeId, presetOrganizationId }) {
  const user = useAuthenticatedUser();

  const platform = user.role_code === "superadmin";
  const manage = hrisLevel(user, "work-schedules") === "manage";
  const list = useDataList("/api/work-schedules", {
    requiredFilter: "organizationId",
    initialFilters: {
      ...(platform && !presetOrganizationId
        ? {}
        : { organizationId: String(presetOrganizationId || user.organization_id) }),
      ...(employeeId ? { employeeId: String(employeeId) } : {}),
    },
  });
  const org = list.filters.organizationId;
  const opts = useScheduleOptions(org);
  const [selected, setSelected] = useState({});
  const [photoPreview, setPhotoPreview] = useState(null);
  const [form] = Form.useForm();

  const [modal, setModal] = useState(null);
  const [bulkTargets, setBulkTargets] = useState(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(null);

  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const targets = employeeId ? list.data : Object.values(selected).filter((x) => x.org === org);
  const replacing = targets.some((t) => t.assignments?.some((a) => !a.cancelled));
  const canAct = Boolean(org && targets.length && targets.length <= 100 && !busy);
  const unassignedTargets = targets.filter(
    (person) =>
      !person.assignments?.some((a) => !a.cancelled && (!a.until || a.until >= opts.today)),
  );
  const filter = (key, value) => {
    setSelected({});
    list.updateFilters({ ...list.filters, [key]: value || undefined });
  };
  const open = (kind, item = null) => {
    form.resetFields();
    form.setFieldsValue({});
    setModal({ kind, item, key: requestKey() });
  };
  const refresh = async () => {
    setSelected({});
    await list.refresh();
  };
  const submit = async () => {
    if (busy) return;
    let values;
    try {
      await form.validateFields();
      values = form.getFieldsValue(true);
    } catch {
      return;
    }
    let endpoint,
      body = { ...values, organizationId: String(org), requestKey: modal.key };
    if (modal.kind === "assign") {
      endpoint = "/api/work-schedules";
      body = {
        ...body,
        until: null,
        employeeIds: targets.map((x) => x.id),
        reason: values.reason || "Penetapan jadwal awal.",
        expectedVersions: Object.fromEntries(targets.map((x) => [x.id, x.assignment_version])),
      };
    } else {
      endpoint = "/api/work-schedules/cancel";
      body = { ...body, id: modal.item.id, version: modal.item.version };
    }
    setBusy(true);
    try {
      await runWithLoadingBackdrop(() => scheduleRequest(endpoint, body), {
        message: "Menyimpan jadwal...",
      });
      setModal(null);
      await refresh();
      showNotification("Jadwal disimpan.");
    } catch (e) {
      applyFieldErrors(form, e);
      showNotification(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const actions = (item) =>
    manage
      ? [
          {
            key: "assign",
            label: "Tetapkan jadwal",
            onClick: () => {
              setSelected({ [item.id]: { ...item, org } });
              open("assign");
            },
          },
          { key: "history", label: "Riwayat jadwal", onClick: () => setHistory(item) },
        ]
      : [{ key: "history", label: "Riwayat jadwal", onClick: () => setHistory(item) }];
  const scheduleSummary = (person) => (
    <EmployeeScheduleSummary
      assignments={person.assignments}
      today={opts.today}
      error={opts.error}
    />
  );
  const selector = (x) => (
    <Checkbox
      style={{
        minWidth: 44,
        minHeight: 44,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-label={"Pilih " + x.full_name}
      checked={Boolean(selected[x.id]?.org === org)}
      onChange={(e) => {
        const checked = e.target.checked;
        setSelected((old) => {
          const n = { ...old };
          if (checked) n[x.id] = { ...x, org };
          else delete n[x.id];
          return n;
        });
      }}
      disabled={busy || (!selected[x.id] && targets.length >= 100)}
    />
  );
  const pageSelected = list.data.filter((x) => selected[x.id]?.org === org).length;
  const allPageSelected = list.data.length > 0 && pageSelected === list.data.length;
  const selectPage = (
    <Checkbox
      style={{
        minWidth: 44,
        minHeight: 44,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-label="Pilih semua Pegawai pada halaman ini"
      checked={allPageSelected}
      indeterminate={pageSelected > 0 && !allPageSelected}
      disabled={busy || list.loading || Boolean(list.error) || !list.data.length}
      onChange={(event) => {
        const checked = event.target.checked;
        setSelected((old) => {
          const next = { ...old };
          let count = Object.values(next).filter((x) => x.org === org).length;
          for (const x of list.data) {
            if (!checked) delete next[x.id];
            else if (next[x.id]?.org !== org && count < 100) {
              next[x.id] = { ...x, org };
              count++;
            }
          }
          return next;
        });
      }}
    />
  );
  const identity = (x) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
      <EmployeeAvatar employee={x} onPreview={setPhotoPreview} />
      <Box sx={{ minWidth: 0 }}>
        <FontStyle fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
          {x.full_name}
        </FontStyle>
        <FontStyle
          fontSize={11.5}
          sx={{ mt: 0.25, color: "text.secondary", overflowWrap: "anywhere" }}
        >
          {x.employee_no || "—"}
        </FontStyle>
      </Box>
    </Box>
  );
  const assignAction = manage && (
    <Button
      type="primary"
      icon={<ScheduleOutlined />}
      disabled={!canAct}
      onClick={() => open("assign")}
    >
      Tetapkan jadwal{targets.length ? " (" + targets.length + ")" : ""}
    </Button>
  );
  const columns = [
    ...(!employeeId && manage
      ? [{ title: selectPage, width: 70, align: "center", render: (_, x) => selector(x) }]
      : []),
    {
      title: "Pegawai",
      render: (_, x) => identity(x),
    },
    { title: "Jadwal saat ini", render: (_, x) => scheduleSummary(x) },
    {
      title: "Aksi",
      align: "center",
      width: 92,
      render: (_, x) => <RowActionMenu items={actions(x)} />,
    },
  ];
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      {!employeeId && (
        <PageHeader
          title="Jadwal Pegawai"
          description="Penetapan dan riwayat jadwal kerja Pegawai."
        />
      )}
      <OperationalFilterSection
        description="Cari Pegawai berdasarkan nama, NIP, atau status jadwal."
        onReset={() => {
          list.setSearch("");
          list.updateFilters({
            organizationId: org,
            ...(employeeId ? { employeeId } : {}),
            scheduleStatus: "all",
          });
          setSelected({});
        }}
        search={list.search}
        onSearchChange={(value) => {
          setSelected({});
          list.setSearch(value);
        }}
        searchPlaceholder="Nama atau NIP"
        onRefresh={refresh}
        items={[
          ...(platform && !presetOrganizationId
            ? [
                {
                  key: "org",
                  label: "Organisasi",
                  control: (
                    <OrganizationSelect
                      value={org}
                      onChange={(organizationId) => {
                        setSelected({});
                        list.updateFilters({ organizationId });
                      }}
                    />
                  ),
                },
              ]
            : []),
          {
            key: "scheduleStatus",
            label: "Status jadwal",
            control: (
              <Select
                aria-label="Status jadwal"
                value={list.filters.scheduleStatus || "all"}
                onChange={(scheduleStatus) => {
                  filter("scheduleStatus", scheduleStatus);
                }}
                options={[
                  { value: "all", label: "Semua Pegawai" },
                  { value: "assigned", label: "Sudah memiliki jadwal" },
                  { value: "unassigned", label: "Belum memiliki jadwal" },
                ]}
              />
            ),
          },
          ...[
            ["locationId", "Lokasi", "locations", "Semua lokasi"],
            ["organizationUnitId", "Divisi & Unit", "organizationUnits", "Semua Divisi & Unit"],
            ["positionId", "Jabatan", "positions", "Semua jabatan"],
            ["employmentTypeId", "Jenis Kepegawaian", "employmentTypes", "Semua jenis"],
          ].map(([key, label, source, placeholder]) => ({
            key,
            label,
            control: (
              <Select
                allowClear
                showSearch
                disabled={!org || opts.loading}
                loading={opts.loading}
                placeholder={placeholder}
                value={list.filters[key]}
                onChange={(value) => filter(key, value)}
                options={[
                  ...(key === "employmentTypeId"
                    ? [{ value: "without_active_contract", label: "Tanpa kontrak aktif" }]
                    : []),
                  ...(opts[source] || []).map((item) => ({ value: item.id, label: item.name })),
                ]}
              />
            ),
          })),
        ]}
      />
      {org && opts.error && (
        <AppNotice
          tone="danger"
          title="Pilihan jadwal belum tersedia"
          description={opts.error}
          action={<Button onClick={opts.onRetry}>Coba lagi</Button>}
        />
      )}
      {manage && unassignedTargets.length > 0 && (
        <AppNotice
          tone="warning"
          title={unassignedTargets.length + " Pegawai belum memiliki jadwal"}
          description="Tetapkan jadwal terlebih dahulu agar jadwal harian bisa diubah, atau hapus centang pada Pegawai tersebut."
          descriptionAlign="left"
        />
      )}
      <DataPanel
        title="Daftar jadwal Pegawai"
        description={
          !employeeId
            ? manage
              ? "Pilih maksimal 100 Pegawai untuk penetapan atau perubahan jadwal harian."
              : "Lihat jadwal yang berlaku dan riwayat penetapan Pegawai."
            : "Lihat jadwal yang berlaku, jadwal mendatang, dan riwayat penetapan Pegawai."
        }
        toolbar={
          manage ? (
            <Box
              sx={{
                display: { xs: "grid", sm: "flex" },
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                width: "100%",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                {!employeeId && (
                  <Box sx={{ display: "none", "@media (max-width:767px)": { display: "flex" } }}>
                    {selectPage}
                  </Box>
                )}
              </Box>
              <Box
                sx={{
                  display: { xs: "grid", sm: "flex" },
                  gap: 1.5,
                  flexWrap: "wrap",
                  "& .ant-btn": { minHeight: 44 },
                }}
              >
                {assignAction}
                <Button
                  icon={<CalendarOutlined />}
                  disabled={
                    !canAct ||
                    !opts.today ||
                    opts.loading ||
                    Boolean(opts.error) ||
                    unassignedTargets.length > 0
                  }
                  onClick={() => setBulkTargets([...targets])}
                >
                  Ubah jadwal harian
                </Button>
              </Box>
            </Box>
          ) : null
        }
      >
        <ResponsiveDataView
          data={list.data}
          columns={columns}
          loading={list.loading}
          error={list.error}
          onRetry={list.refresh}
          pagination={list.pagination}
          onPageChange={list.setPage}
          emptyDescription={org ? "Belum ada Pegawai sesuai filter." : "Pilih organisasi."}
          renderCard={(x) => (
            <Box sx={{ display: "grid", gap: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                {!employeeId && manage && selector(x)}
                {identity(x)}
              </Box>
              {scheduleSummary(x)}
              <RowActionMenu items={actions(x)} />
            </Box>
          )}
        />
      </DataPanel>
      {bulkTargets && (
        <BulkScheduleExceptionDialog
          employees={bulkTargets}
          organizationId={org}
          options={opts}
          onClose={() => setBulkTargets(null)}
          onSaved={refresh}
          onMessage={showNotification}
        />
      )}
      <AppModal
        open={Boolean(modal) && !photoPreview}
        keepMounted
        description={
          modal?.kind === "assign"
            ? "Pilih jadwal kerja dan tanggal mulai untuk Pegawai yang dipilih."
            : "Batalkan penetapan yang belum dimulai dengan alasan. Jadwal sebelumnya tidak diaktifkan kembali."
        }
        title={modal?.kind === "assign" ? "Tetapkan jadwal" : "Batalkan jadwal mendatang"}
        onClose={() => setModal(null)}
        disableClose={busy}
        footer={
          <Space
            wrap
            size={12}
            style={{ maxWidth: "100%" }}
            styles={{ item: { minWidth: 0, maxWidth: "100%" } }}
          >
            <Button disabled={busy} onClick={() => setModal(null)}>
              Batal
            </Button>
            <Button
              type="primary"
              style={{ minHeight: 44, height: "auto", maxWidth: "100%", whiteSpace: "normal" }}
              loading={busy}
              onClick={() => submit()}
            >
              {modal?.kind === "assign" ? "Tetapkan jadwal" : "Simpan perubahan"}
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          labelWrap
          requiredMark={false}
          disabled={busy}
          style={{ display: "grid", gap: 24 }}
        >
          {modal?.kind === "assign" && (
            <Box sx={{ pb: 3, borderBottom: 1, borderColor: "divider" }}>
              <SelectedEmployeesSummary
                employees={targets}
                onPreview={setPhotoPreview}
                disabled={busy}
              />
            </Box>
          )}
          {modal?.kind === "assign" ? (
            <WorkScheduleFields
              organizationId={org}
              prefix={[]}
              allowEndDate={false}
              joinedDate={targets
                .map((t) => t.joined_date)
                .sort()
                .at(-1)}
            />
          ) : modal?.kind === "cancel" ? (
            <AppNotice
              tone="warning"
              title="Pembatalan jadwal mendatang"
              description={`Penetapan ${modal.item.patternName || "jadwal"} mulai ${modal.item.from} akan dibatalkan. Jadwal sebelumnya tidak otomatis berlaku kembali.`}
            />
          ) : null}
          {(modal?.kind !== "assign" || replacing) && (
            <Form.Item
              style={{ marginBottom: 0 }}
              name="reason"
              label="Alasan perubahan"
              rules={[
                { required: true, message: "Isi alasan perubahan." },
                { min: 5, message: "Isi minimal 5 karakter." },
              ]}
            >
              <Input.TextArea rows={2} maxLength={1000} />
            </Form.Item>
          )}
        </Form>
      </AppModal>
      <AppModal
        open={Boolean(history)}
        title="Riwayat jadwal"
        description="Lihat jadwal yang pernah ditetapkan, periode berlaku, alasan perubahan, dan pelakunya."
        onClose={() => setHistory(null)}
        footer={<Button onClick={() => setHistory(null)}>Tutup</Button>}
      >
        <Box sx={{ display: "grid", gap: 3 }}>
          {history && (
            <Box sx={{ pb: 3, borderBottom: 1, borderColor: "divider" }}>
              <InfoField label="Pegawai" valueContent={identity(history)} />
            </Box>
          )}
          <ScheduleHistory
            assignments={history?.assignments || []}
            today={opts.today}
            timezone={opts.timezone || user.organization_timezone || "UTC"}
            manage={manage}
            onCancel={(assignment) => {
              setHistory(null);
              open("cancel", assignment);
            }}
          />
        </Box>
      </AppModal>
      <ImagePreviewModal
        open={Boolean(photoPreview)}
        {...photoPreview}
        onClose={() => setPhotoPreview(null)}
      />
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
