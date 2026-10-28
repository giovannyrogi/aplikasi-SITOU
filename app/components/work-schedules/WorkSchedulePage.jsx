"use client";
import { useEffect, useState } from "react";
import { Button, Checkbox, Form, Input, Select, Space } from "antd";
import { Box } from "@mui/material";
import dayjs from "dayjs";
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
const labelStatus = {
  scheduled: "Bekerja",
  off: "Libur",
  holiday: "Hari libur",
  needs_review: "Belum diatur",
  cancelled: "Dibatalkan",
};
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
  const [form] = Form.useForm();
  const [rangeForm] = Form.useForm();
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [confirmAssign, setConfirmAssign] = useState(false);
  useEffect(() => {
    if (opts.today)
      rangeForm.setFieldsValue({
        from: opts.today,
        until: dayjs(opts.today).add(6, "day").format("YYYY-MM-DD"),
      });
  }, [opts.today, rangeForm]);
  const [history, setHistory] = useState(null);
  const [exceptionCheck, setExceptionCheck] = useState(null);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const targets = employeeId ? list.data : Object.values(selected).filter((x) => x.org === org);
  const canAct = Boolean(org && targets.length && targets.length <= 100 && !busy);
  const open = (kind, item = null) => {
    form.resetFields();
    form.setFieldsValue(
      kind === "assign"
        ? { from: opts.today }
        : kind === "exception"
          ? { date: opts.today, shiftIds: [] }
          : {},
    );
    setExceptionCheck(null);
    setModal({ kind, item, key: requestKey() });
  };
  const refresh = async () => {
    setPreview(null);
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
        employeeIds: targets.map((x) => x.id),
        expectedVersions: Object.fromEntries(targets.map((x) => [x.id, x.assignment_version])),
      };
    } else if (modal.kind === "exception") {
      endpoint = "/api/work-schedules/exceptions";
      body = { ...body, employeeId: modal.item.id, version: exceptionCheck.version };
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
  const makePreview = async () => {
    if (!canAct) return;
    let v;
    try {
      v = await rangeForm.validateFields();
    } catch {
      return;
    }
    setBusy(true);
    try {
      const input = { ...v, organizationId: String(org), employeeIds: targets.map((x) => x.id) };
      const r = await runWithLoadingBackdrop(
        () => scheduleRequest("/api/work-schedules/preview", input),
        { message: "Memeriksa jadwal..." },
      );
      setPreview({ rows: r.data, input, key: requestKey() });
      setPreviewPage(1);
    } catch (e) {
      applyFieldErrors(rangeForm, e);
      showNotification(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const generate = async () => {
    if (busy || !preview) return;
    setBusy(true);
    try {
      const result = await runWithLoadingBackdrop(
        () =>
          scheduleRequest("/api/work-schedules/generate", {
            ...preview.input,
            requestKey: preview.key,
            replace: true,
            expectedVersions: Object.fromEntries(
              preview.rows.map((x) => [x.employeeId + ":" + x.date, x.version]),
            ),
          }),
        { message: "Menyusun jadwal..." },
      );
      setConfirmGenerate(false);
      setPreview(null);
      showNotification(`${result.data.generated} jadwal disusun, ${result.data.unchanged} tetap.`);
    } catch (e) {
      showNotification(e.message, "error");
      setConfirmGenerate(false);
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
      form.setFieldsValue({
        shiftIds: row.exceptionId ? row.sessions.map((x) => x.shiftId) : [],
        reason: row.reason || "",
      });
      setExceptionCheck({ date, version: row.exceptionVersion });
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
          { key: "exception", label: "Jadwal khusus", onClick: () => open("exception", item) },
          { key: "history", label: "Riwayat jadwal", onClick: () => setHistory(item) },
        ]
      : [{ key: "history", label: "Riwayat jadwal", onClick: () => setHistory(item) }];
  const status = (x) => {
    const current = x.assignments?.find(
      (a) => !a.cancelled && a.from <= opts.today && (!a.until || a.until >= opts.today),
    );
    return current?.patternName || "Belum diatur";
  };
  const selector = (x) => (
    <Checkbox
      aria-label={"Pilih " + x.full_name}
      checked={Boolean(selected[x.id]?.org === org)}
      onChange={(e) => {
        setPreview(null);
        setSelected((old) => {
          const n = { ...old };
          if (e.target.checked) n[x.id] = { ...x, org };
          else delete n[x.id];
          return n;
        });
      }}
      disabled={!selected[x.id] && targets.length >= 100}
    />
  );
  const columns = [
    ...(!employeeId ? [{ title: "Pilih", width: 70, render: (_, x) => selector(x) }] : []),
    {
      title: "Pegawai",
      render: (_, x) => (
        <>
          <FontStyle fontWeight={600}>{x.full_name}</FontStyle>
          <FontStyle fontSize={12}>NIP: {x.employee_no}</FontStyle>
        </>
      ),
    },
    { title: "Pola saat ini", render: (_, x) => status(x) },
    { title: "Aksi", render: (_, x) => <RowActionMenu items={actions(x)} /> },
  ];
  const previewColumns = [
    { title: "Pegawai", dataIndex: "name" },
    { title: "Tanggal", dataIndex: "date" },
    {
      title: "Jadwal",
      render: (_, x) => (
        <Box>
          <CompactInfoChip label={labelStatus[x.status]} />
          {x.isHoliday && <FontStyle>{x.holidayName}</FontStyle>}
          {x.sessions.map((s) => (
            <FontStyle key={s.sessionNo}>
              {s.name}: {s.rules.startTime || s.rules.windowStart}–
              {s.rules.endTime || s.rules.latestFinish}
              {s.rules.nextDay ? " (+1 hari)" : ""}
            </FontStyle>
          ))}
        </Box>
      ),
    },
  ];
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      {!employeeId && (
        <PageHeader
          title="Jadwal Kerja"
          description="Tetapkan pola, periksa sesi, dan susun jadwal Pegawai."
        />
      )}
      <OperationalFilterSection
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
                        setPreview(null);
                        list.updateFilters({ organizationId });
                      }}
                    />
                  ),
                },
              ]
            : []),
          {
            key: "without",
            label: "Kelengkapan jadwal",
            control: (
              <Select
                value={list.filters.without || "false"}
                onChange={(without) => {
                  setPreview(null);
                  list.updateFilters({ without });
                }}
                options={[
                  { value: "false", label: "Tanpa filter jadwal" },
                  { value: "true", label: "Belum memiliki jadwal" },
                ]}
              />
            ),
          },
        ]}
      />
      <DataPanel title="Jadwal Pegawai">
        <Space wrap style={{ padding: 16, paddingBottom: 0, marginBottom: 16, maxWidth: "100%" }}>
          {manage && (
            <Button type="primary" disabled={!canAct} onClick={() => open("assign")}>
              Tetapkan jadwal{!employeeId ? " (" + targets.length + ")" : ""}
            </Button>
          )}
          {!employeeId && targets.length > 0 && (
            <Button
              onClick={() => {
                setSelected({});
                setPreview(null);
              }}
            >
              Hapus pilihan
            </Button>
          )}
        </Space>
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
              {!employeeId && selector(x)}
              <FontStyle fontWeight={600}>{x.full_name}</FontStyle>
              <FontStyle>NIP: {x.employee_no}</FontStyle>
              <FontStyle>{status(x)}</FontStyle>
              <RowActionMenu items={actions(x)} />
            </Box>
          )}
        />
      </DataPanel>
      <DataPanel title="Periksa dan susun jadwal" contentSx={{ p: { xs: 2, sm: 2.5 } }}>
        <Form
          form={rangeForm}
          layout="vertical"
          initialValues={{
            from: dayjs().format("YYYY-MM-DD"),
            until: dayjs().add(6, "day").format("YYYY-MM-DD"),
          }}
          onValuesChange={() => setPreview(null)}
        >
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <DateField name="from" label="Mulai" required />
            <DateField name="until" label="Sampai" required />
          </Box>
          <Button disabled={!canAct} onClick={makePreview}>
            Periksa jadwal
          </Button>
        </Form>
        {preview && (
          <Box sx={{ mt: 2 }}>
            <ResponsiveDataView
              data={preview.rows.slice((previewPage - 1) * 20, previewPage * 20)}
              columns={previewColumns}
              rowKey={(x) => x.employeeId + ":" + x.date}
              pagination={{ page: previewPage, pageSize: 20, total: preview.rows.length }}
              onPageChange={setPreviewPage}
              renderCard={(x) => (
                <Box>
                  <FontStyle>
                    {x.name} · {x.date}
                  </FontStyle>
                  {previewColumns[2].render(null, x)}
                </Box>
              )}
            />
            {manage && (
              <Button type="primary" disabled={busy} onClick={() => setConfirmGenerate(true)}>
                Susun jadwal
              </Button>
            )}
          </Box>
        )}
      </DataPanel>
      <AppModal
        open={Boolean(modal) && !confirmAssign}
        title={
          modal?.kind === "assign"
            ? "Tetapkan jadwal"
            : modal?.kind === "exception"
              ? "Jadwal khusus"
              : "Batalkan jadwal mendatang"
        }
        onClose={() => setModal(null)}
        disableClose={busy}
        footer={
          <Space>
            <Button disabled={busy} onClick={() => setModal(null)}>
              Batal
            </Button>
            <Button type="primary" loading={busy} onClick={() => submit()}>
              Simpan
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onValuesChange={(changed) => {
            if (changed.date) setExceptionCheck(null);
          }}
        >
          {modal?.kind === "assign" ? (
            <WorkScheduleFields organizationId={org} prefix={[]} />
          ) : modal?.kind === "exception" ? (
            <>
              <FontStyle>{modal.item.full_name}</FontStyle>
              <DateField name="date" label="Tanggal" required />
              <Button disabled={busy} onClick={checkException}>
                Periksa tanggal
              </Button>
              <Form.Item name="shiftIds" label="Sesi kerja" extra="Kosong berarti Libur.">
                <Select
                  disabled={!exceptionCheck}
                  mode="multiple"
                  maxCount={16}
                  showSearch
                  optionFilterProp="label"
                  onSearch={opts.onSearch}
                  options={(opts.shifts || []).map((x) => ({ value: x.id, label: x.name }))}
                />
              </Form.Item>
            </>
          ) : null}
          <Form.Item
            name="reason"
            label="Alasan perubahan"
            rules={[
              { required: true, message: "Isi alasan perubahan." },
              { min: 5, message: "Isi minimal 5 karakter." },
            ]}
          >
            <Input.TextArea rows={2} maxLength={1000} />
          </Form.Item>
        </Form>
      </AppModal>
      <AppModal
        open={Boolean(history)}
        title="Riwayat jadwal"
        onClose={() => setHistory(null)}
        footer={<Button onClick={() => setHistory(null)}>Tutup</Button>}
      >
        <Space orientation="vertical" style={{ width: "100%" }}>
          {history?.assignments?.length ? (
            history.assignments.map((a) => (
              <Box key={a.id} sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
                <FontStyle fontWeight={600}>{a.patternName}</FontStyle>
                <FontStyle>
                  {a.from} — {a.until || "Seterusnya"}
                </FontStyle>
                <FontStyle>
                  {a.cancelled ? "Dibatalkan" : a.from > opts.today ? "Mendatang" : "Tercatat"}
                </FontStyle>
                <FontStyle>{a.reason}</FontStyle>
                <FontStyle>
                  {a.createdBy || "Akun tidak tersedia"} ·{" "}
                  {a.createdAt
                    ? new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: opts.timezone || user.organization_timezone || "UTC",
                      }).format(new Date(a.createdAt))
                    : "—"}
                </FontStyle>
                {a.cancelled && <FontStyle>{a.cancellationReason}</FontStyle>}
                {manage && !a.cancelled && a.from > opts.today && (
                  <Button
                    onClick={() => {
                      setHistory(null);
                      open("cancel", a);
                    }}
                  >
                    Batalkan penetapan
                  </Button>
                )}
              </Box>
            ))
          ) : (
            <FontStyle>Belum ada penetapan.</FontStyle>
          )}
        </Space>
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
          {confirmAssign?.from} — {confirmAssign?.until || "Seterusnya"}
        </FontStyle>
        <Box sx={{ maxHeight: 240, overflow: "auto" }}>
          {targets.map((t) => (
            <FontStyle key={t.id}>
              {t.full_name} · {t.employee_no}
            </FontStyle>
          ))}
        </Box>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmGenerate}
        title="Susun jadwal?"
        message="Jadwal baru akan disimpan. Jadwal yang berubah dan belum digunakan akan diperbarui. Riwayat yang sudah digunakan tetap dilindungi."
        confirmText="Susun jadwal"
        loading={busy}
        onConfirm={generate}
        onClose={() => setConfirmGenerate(false)}
      />
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
