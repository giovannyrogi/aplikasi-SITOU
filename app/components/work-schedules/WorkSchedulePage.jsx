"use client";
import { useState } from "react";
import { Button, Checkbox, Form, Input, Radio, Space, Tooltip } from "antd";
import AppIcon from "@/app/components/icons/AppIcon";
import { Box, useTheme } from "@mui/material";
import Select from "@/app/components/forms/AsyncSelect";
import ScheduleCalendar from "./ScheduleCalendar";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import OperationalFilterSection from "@/app/components/filters/OperationalFilterSection";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import RowActionMenu from "@/app/components/actions/RowActionMenu";
import AppModal from "@/app/components/modals/AppModal";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import EmployeeAvatar from "@/app/components/employees/EmployeeAvatar";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import AppNotice from "@/app/components/data-display/AppNotice";
import { InfoField } from "@/app/components/employees/EmployeeDetailSections";
import ScheduleHistory from "./ScheduleHistory";
import { sessionText } from "./ScheduleSummary";
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
  DateField,
  WorkScheduleFields,
  useScheduleOptions,
} from "./ScheduleFields";
/** Workspace sama digunakan menu utama dan detail Pegawai. */
export default function WorkSchedulePage({ employeeId, presetOrganizationId }) {
  const user = useAuthenticatedUser();
  const theme = useTheme();
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
  const dayType = Form.useWatch("dayType", form);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [calendarRevision, setCalendarRevision] = useState(0);
  const invalidateCalendar = () => setCalendarRevision((n) => n + 1);
  const [confirmAssign, setConfirmAssign] = useState(false);
  const [history, setHistory] = useState(null);
  const [exceptionCheck, setExceptionCheck] = useState(null);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const targets = employeeId ? list.data : Object.values(selected).filter((x) => x.org === org);
  const replacing = targets.some((t) => t.assignments?.some((a) => !a.cancelled));
  const canAct = Boolean(org && targets.length && targets.length <= 100 && !busy);
  const open = (kind, item = null) => {
    form.resetFields();
    form.setFieldsValue(
      kind === "assign"
        ? {}
        : kind === "exception"
          ? { date: opts.today, shiftIds: [], dayType: "work" }
          : {},
    );
    setExceptionCheck(null);
    setModal({ kind, item, key: requestKey() });
  };
  const refresh = async () => {
    invalidateCalendar();
    setSelected({});
    await list.refresh();
  };
  const submit = async (confirmed = false) => {
    if (busy) return;
    let values;
    try {
      if (confirmed === true && confirmAssign) values = confirmAssign;
      else {
        await form.validateFields();
        values = form.getFieldsValue(true);
      }
    } catch {
      return;
    }
    if (modal.kind === "exception" && exceptionCheck?.date !== values.date) {
      form.setFields([{ name: "date", errors: ["Periksa jadwal pada tanggal ini."] }]);
      return;
    }
    if (modal.kind === "assign" && confirmed !== true) {
      setConfirmAssign({ ...values });
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
    } else if (modal.kind === "exception") {
      endpoint = "/api/work-schedules/exceptions";
      delete body.dayType;
      body = {
        ...body,
        shiftIds: values.dayType === "off" ? [] : values.shiftIds,
        employeeId: modal.item.id,
        version: exceptionCheck.version,
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
      setConfirmAssign(false);
      await refresh();
      showNotification("Jadwal disimpan.");
    } catch (e) {
      applyFieldErrors(form, e);
      showNotification(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const checkException = async () => {
    const date = form.getFieldValue("date");
    if (!date) {
      form.setFields([{ name: "date", errors: ["Isi tanggal."] }]);
      return;
    }
    setBusy(true);
    try {
      const r = await runWithLoadingBackdrop(
        () =>
          scheduleRequest("/api/work-schedules/preview", {
            organizationId: String(org),
            employeeIds: [modal.item.id],
            from: date,
            until: date,
          }),
        { message: "Memeriksa jadwal..." },
      );
      const row = r.data[0];
      if (!row)
        throw new Error("Jadwal pada tanggal ini tidak ditemukan. Pilih tanggal lalu coba lagi.");
      form.setFieldsValue({
        shiftIds: row.sessions.map((x) => x.shiftId),
        dayType: row.status === "off" || row.status === "holiday" ? "off" : "work",
        reason: form.getFieldValue("reason") || row.reason || "",
      });
      setExceptionCheck({
        date,
        version: row.exceptionVersion,
        summary:
          row.sessions.map((x) => `${x.name}: ${sessionText(x.rules)}`).join(". ") ||
          (row.status === "off" || row.status === "holiday"
            ? "Libur."
            : "Jadwal belum diatur untuk tanggal ini."),
      });
    } catch (e) {
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
          {
            key: "exception",
            label: "Ubah jadwal harian",
            onClick: () => open("exception", item),
          },
          { key: "history", label: "Riwayat jadwal", onClick: () => setHistory(item) },
        ]
      : [{ key: "history", label: "Riwayat jadwal", onClick: () => setHistory(item) }];
  const status = (x) => {
    const current = x.assignments?.find(
      (a) => !a.cancelled && a.from <= opts.today && (!a.until || a.until >= opts.today),
    );
    if (current) return `Jadwal berlaku: ${current.patternName}`;
    const future = x.assignments
      ?.filter((a) => !a.cancelled && a.from > opts.today)
      .sort((a, b) => a.from.localeCompare(b.from))[0];
    return future ? `Jadwal mulai ${future.from}: ${future.patternName}` : "Jadwal belum diatur";
  };
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
        invalidateCalendar();
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
        invalidateCalendar();
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
    <Button type="primary" disabled={!canAct} onClick={() => open("assign")}>
      Tetapkan jadwal{targets.length ? " (" + targets.length + ")" : ""}
    </Button>
  );
  const columns = [
    ...(!employeeId
      ? [{ title: selectPage, width: 70, align: "center", render: (_, x) => selector(x) }]
      : []),
    {
      title: "Pegawai",
      render: (_, x) => identity(x),
    },
    { title: "Jadwal saat ini", render: (_, x) => status(x) },
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
          description="Tetapkan jadwal kerja dan lihat hari kerja serta libur Pegawai."
          action={assignAction}
        />
      )}
      <OperationalFilterSection
        description="Cari Pegawai berdasarkan nama, NIP, atau jadwal yang berlaku hari ini."
        onReset={() => {
          list.setSearch("");
          list.updateFilters({ ...list.filters, without: "false" });
          setSelected({});
          invalidateCalendar();
        }}
        search={list.search}
        onSearchChange={list.setSearch}
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
                        invalidateCalendar();
                        list.updateFilters({ organizationId });
                      }}
                    />
                  ),
                },
              ]
            : []),
          {
            key: "without",
            label: "Jadwal hari ini",
            control: (
              <Select
                value={list.filters.without || "false"}
                onChange={(without) => {
                  invalidateCalendar();
                  list.updateFilters({ without });
                }}
                options={[
                  { value: "false", label: "Semua Pegawai" },
                  { value: "true", label: "Belum memiliki jadwal hari ini" },
                ]}
              />
            ),
          },
        ]}
      />
      <DataPanel
        title="Daftar jadwal Pegawai"
        description={
          !employeeId
            ? manage
              ? "Pilih maksimal 100 Pegawai, lalu tekan Tetapkan jadwal."
              : "Pilih Pegawai untuk melihat hari kerja dan liburnya."
            : "Lihat jadwal yang berlaku, jadwal mendatang, dan riwayat penetapan Pegawai."
        }
        action={employeeId ? assignAction : null}
        toolbar={
          !employeeId ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ display: "none", "@media (max-width:767px)": { display: "flex" } }}>
                {selectPage}
              </Box>
              <FontStyle>{targets.length} Pegawai dipilih</FontStyle>
              {targets.length > 0 && (
                <Button
                  disabled={busy}
                  onClick={() => {
                    setSelected({});
                    invalidateCalendar();
                  }}
                >
                  Batalkan semua pilihan
                </Button>
              )}
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
                {!employeeId && selector(x)}
                {identity(x)}
              </Box>
              <FontStyle>{status(x)}</FontStyle>
              <RowActionMenu items={actions(x)} />
            </Box>
          )}
        />
      </DataPanel>
      {opts.today && (
        <ScheduleCalendar
          key={org}
          organizationId={org}
          employees={targets}
          today={opts.today}
          revision={calendarRevision}
        />
      )}
      <AppModal
        scrollHeaderWithContent
        open={Boolean(modal) && !confirmAssign}
        description={
          modal?.kind === "assign"
            ? "Pilih jadwal kerja dan tanggal mulai untuk Pegawai yang dipilih. Periksa ringkasan sebelum mengonfirmasi penetapan."
            : modal?.kind === "exception"
              ? "Pilih waktu kerja atau tetapkan libur pada satu tanggal. Isi alasan perubahan."
              : "Batalkan penetapan yang belum dimulai dengan alasan. Jadwal sebelumnya tidak diaktifkan kembali."
        }
        title={
          modal?.kind === "assign"
            ? "Tetapkan jadwal"
            : modal?.kind === "exception"
              ? "Ubah jadwal harian"
              : "Batalkan jadwal mendatang"
        }
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
              disabled={modal?.kind === "exception" && !exceptionCheck}
              onClick={() => submit()}
            >
              {modal?.kind === "assign" ? "Lanjutkan" : "Simpan perubahan"}
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
          onValuesChange={(changed) => {
            if (changed.date) setExceptionCheck(null);
          }}
        >
          {(modal?.kind === "assign" || modal?.kind === "exception") && (
            <Box sx={{ pb: 3, borderBottom: 1, borderColor: "divider" }}>
              <InfoField
                label="Pegawai"
                valueContent={
                  modal.kind === "exception" ? (
                    identity(modal.item)
                  ) : targets.length === 1 ? (
                    identity(targets[0])
                  ) : (
                    <FontStyle fontWeight={600}>{targets.length} Pegawai dipilih</FontStyle>
                  )
                }
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
          ) : modal?.kind === "exception" ? (
            <>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) auto" },
                  gap: 2,
                  alignItems: "end",
                  "& .ant-form-item": { mb: 0 },
                }}
              >
                <DateField name="date" label="Tanggal yang diubah" required />
                <Box sx={{ width: { xs: "100%", sm: 44 }, "& .ant-btn": { px: { xs: 2, sm: 0 } } }}>
                  <Tooltip
                    title="Periksa jadwal pada tanggal yang dipilih"
                    trigger={["hover", "focus"]}
                  >
                    <Button
                      disabled={busy}
                      onClick={checkException}
                      aria-label="Periksa jadwal pada tanggal yang dipilih"
                      icon={<AppIcon icon="solar:eye-linear" fontSize={20} />}
                      style={{
                        width: "100%",
                        minHeight: 44,
                        height: "auto",
                        whiteSpace: "normal",
                        color: theme.status.info.main,
                        borderColor: theme.status.info.border,
                      }}
                    >
                      <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>
                        Periksa jadwal
                      </Box>
                    </Button>
                  </Tooltip>
                </Box>
              </Box>
              {!exceptionCheck ? (
                <AppNotice
                  title="Periksa jadwal sebelum mengubah"
                  description="Tekan tombol bergambar mata untuk memuat jadwal pada tanggal yang dipilih. Setelah itu, atur waktu kerja atau pilih Libur."
                />
              ) : (
                <>
                  <AppNotice
                    title="Jadwal pada tanggal pilihan"
                    description={exceptionCheck.summary}
                  />
                  <Form.Item name="dayType" label="Pengaturan hari ini" style={{ marginBottom: 0 }}>
                    <Radio.Group
                      options={[
                        { value: "work", label: "Bekerja" },
                        { value: "off", label: "Libur" },
                      ]}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 16,
                        minHeight: 44,
                        alignItems: "center",
                      }}
                    />
                  </Form.Item>
                  {dayType === "work" ? (
                    <Form.Item
                      name="shiftIds"
                      label="Waktu kerja"
                      style={{ marginBottom: 0 }}
                      rules={[{ required: true, message: "Pilih waktu kerja untuk tanggal ini." }]}
                    >
                      <Select
                        mode="multiple"
                        maxCount={16}
                        showSearch
                        optionFilterProp="label"
                        onSearch={opts.onSearch}
                        options={(opts.shifts || []).map((x) => ({ value: x.id, label: x.name }))}
                        placeholder="Pilih waktu kerja"
                      />
                    </Form.Item>
                  ) : (
                    <AppNotice
                      title="Ditetapkan sebagai libur"
                      description="Perubahan hanya berlaku pada tanggal ini. Jadwal rutin Pegawai tetap sama."
                    />
                  )}
                </>
              )}
            </>
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
        scrollHeaderWithContent
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
      <ConfirmDialog
        open={Boolean(confirmAssign)}
        title="Tetapkan jadwal?"
        description="Periksa Pegawai dan tanggal sebelum menyimpan."
        confirmText="Tetapkan jadwal"
        loading={busy}
        onClose={() => setConfirmAssign(false)}
        onConfirm={() => submit(true)}
      >
        <FontStyle>
          {opts.patterns?.find((p) => p.id === confirmAssign?.patternId)?.name} ·{" "}
          {confirmAssign?.from} — Sampai diganti
        </FontStyle>
        <Box sx={{ maxHeight: 240, overflow: "auto" }}>
          {targets.map((t) => (
            <FontStyle key={t.id}>
              {t.full_name} · {t.employee_no}
            </FontStyle>
          ))}
        </Box>
      </ConfirmDialog>
      <ImagePreviewModal
        open={Boolean(photoPreview)}
        {...photoPreview}
        onClose={() => setPhotoPreview(null)}
      />
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
