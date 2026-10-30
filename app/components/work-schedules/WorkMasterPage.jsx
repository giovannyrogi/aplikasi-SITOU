"use client";
import { useState } from "react";
import { Button, Form, Space } from "antd";
import { Box } from "@mui/material";
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
import MasterEditor, { masterValues } from "./MasterEditor";
import TemplatePage from "./TemplatePage";
import { scheduleRequest, requestKey, applyFieldErrors } from "./ScheduleFields";
const endpoints = {
  shifts: "work-shifts",
  patterns: "shift-patterns",
  calendars: "work-calendars",
};
const titles = { shifts: "Shift kerja", patterns: "Pola kerja", calendars: "Kalender Libur" };
export default function WorkMasterPage({ initialKind = "shifts" }) {
  return initialKind === "calendars" ? <MasterList kind="calendars" /> : <TemplatePage />;
}

function MasterList({ kind }) {
  const user = useAuthenticatedUser();
  const platform = user.role_code === "superadmin";
  const list = useDataList("/api/" + endpoints[kind], {
    requiredFilter: "organizationId",
    initialFilters: platform ? {} : { organizationId: String(user.organization_id) },
  });
  const org = list.filters.organizationId;
  const manage =
    hrisLevel(user, kind === "calendars" ? "work-calendars" : "work-shifts") === "manage";
  const [form] = Form.useForm();
  const [editor, setEditor] = useState(null);
  const [history, setHistory] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const open = (item = null, copy = false) => {
    form.resetFields();
    form.setFieldsValue(masterValues(item, kind, copy));
    setEditor({ item: copy ? null : item, requestKey: requestKey() });
  };
  const submit = async () => {
    if (busy) return;
    let v;
    try {
      await form.validateFields();
      v = form.getFieldsValue(true);
      delete v.id;
      delete v.version;
    } catch {
      return;
    }
    if (kind === "shifts") {
      if (v.rules.type === "off")
        v.rules = {
          type: "off",
          startTime: null,
          endTime: null,
          windowStart: null,
          windowEnd: null,
          latestFinish: null,
          requiredMinutes: 0,
          breakMinutes: 0,
          deductBreak: true,
          nextDay: false,
          lateTolerance: 0,
          earlyTolerance: 0,
        };
      else if (v.rules.type === "fixed") {
        v.rules.windowStart = null;
        v.rules.windowEnd = null;
        v.rules.latestFinish = null;
        v.rules.requiredMinutes = 0;
      } else {
        v.rules.startTime = null;
        v.rules.endTime = null;
      }
    }
    setBusy(true);
    try {
      await runWithLoadingBackdrop(
        () =>
          scheduleRequest("/api/" + endpoints[kind], {
            ...v,
            organizationId: String(org),
            ...(editor.item ? { id: editor.item.id, version: editor.item.version } : {}),
            requestKey: editor.requestKey,
          }),
        { message: "Menyimpan data..." },
      );
      setEditor(null);
      await list.refresh();
      showNotification("Berhasil disimpan.");
    } catch (e) {
      applyFieldErrors(form, e);
      showNotification(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const deactivate = async () => {
    setBusy(true);
    try {
      const values = masterValues(confirm, kind);
      await runWithLoadingBackdrop(
        () =>
          scheduleRequest("/api/" + endpoints[kind], {
            ...values,
            organizationId: String(org),
            isActive: !confirm.is_active,
            requestKey: requestKey(),
          }),
        { message: "Memperbarui status..." },
      );
      await list.refresh();
      setConfirm(null);
      showNotification("Status diperbarui.");
    } catch (e) {
      showNotification(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const actions = (item) => [
    ...(manage
      ? [
          { key: "edit", label: "Edit", onClick: () => open(item) },
          { key: "copy", label: "Duplikasi", onClick: () => open(item, true) },
          {
            key: "status",
            label: item.is_active ? "Nonaktifkan" : "Aktifkan",
            danger: item.is_active,
            onClick: () => setConfirm(item),
          },
        ]
      : []),
    ...(kind === "shifts"
      ? [{ key: "history", label: "Riwayat revisi", onClick: () => setHistory(item) }]
      : []),
  ];
  const details = (item) =>
    kind === "shifts"
      ? { fixed: "Jam tetap", flexible: "Jam fleksibel", off: "Libur", field: "Lapangan" }[
          item.revisions?.at(-1)?.rules.type
        ] || "—"
      : kind === "patterns"
        ? item.pattern_type === "weekly"
          ? "Mingguan"
          : `Rotasi ${item.cycle_days} hari`
        : `${item.days?.length || 0} tanggal libur`;
  const columns = [
    { title: kind === "calendars" ? "Nama kalender" : "Nama", dataIndex: "name" },
    {
      title: kind === "calendars" ? "Jumlah tanggal libur" : "Keterangan",
      render: (_, x) => details(x),
    },
    {
      title: "Status",
      render: (_, x) => (
        <CompactInfoChip
          label={x.is_active ? "Aktif" : "Nonaktif"}
          tone={x.is_active ? "success" : "neutral"}
        />
      ),
    },
    {
      title: "Aksi",
      align: "center",
      width: 92,
      render: (_, x) => <RowActionMenu items={actions(x)} />,
    },
  ];
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title={titles[kind]}
        description="Kelola tanggal libur organisasi untuk digunakan pada jadwal kerja."
        action={
          manage && (
            <Button type="primary" disabled={!org} onClick={() => open()}>
              Buat {kind === "shifts" ? "shift" : kind === "patterns" ? "pola" : "kalender libur"}
            </Button>
          )
        }
      />
      <OperationalFilterSection
        description="Cari kalender libur berdasarkan nama dan status penggunaannya."
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Cari nama kalender"
        status={list.status}
        onStatusChange={list.setStatus}
        onRefresh={list.refresh}
        items={
          platform
            ? [
                {
                  key: "organization",
                  label: "Organisasi",
                  control: (
                    <OrganizationSelect
                      value={org}
                      onChange={(organizationId) => list.updateFilters({ organizationId })}
                    />
                  ),
                },
              ]
            : []
        }
      />
      <DataPanel
        title={"Daftar " + titles[kind].toLowerCase()}
        description="Lihat jumlah tanggal libur dan status kalender. Buka Edit untuk mengatur tanggalnya."
      >
        <ResponsiveDataView
          data={list.data}
          columns={columns}
          loading={list.loading}
          error={list.error}
          onRetry={list.refresh}
          pagination={list.pagination}
          onPageChange={list.setPage}
          emptyDescription={
            org
              ? "Belum ada kalender libur sesuai filter."
              : "Pilih organisasi untuk melihat kalender libur."
          }
          renderCard={(x) => (
            <Box sx={{ display: "grid", gap: 1 }}>
              <FontStyle fontWeight={600}>{x.name}</FontStyle>
              <FontStyle>{details(x)}</FontStyle>
              <CompactInfoChip label={x.is_active ? "Aktif" : "Nonaktif"} />
              <RowActionMenu items={actions(x)} />
            </Box>
          )}
        />
      </DataPanel>
      <MasterEditor
        open={Boolean(editor)}
        kind={kind}
        item={editor?.item}
        form={form}
        organizationId={org}
        onClose={() => setEditor(null)}
        onSubmit={submit}
        busy={busy}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.is_active ? "Nonaktifkan data?" : "Aktifkan data?"}
        message="Pilihan baru mengikuti status ini. Histori tetap disimpan."
        onClose={() => setConfirm(null)}
        onConfirm={deactivate}
        loading={busy}
      />
      <AppModal
        open={Boolean(history)}
        title="Riwayat revisi"
        onClose={() => setHistory(null)}
        footer={<Button onClick={() => setHistory(null)}>Tutup</Button>}
      >
        <Space orientation="vertical" style={{ width: "100%" }}>
          {history?.revisions?.map((r) => (
            <Box key={r.id} sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
              <FontStyle>
                {r.effective_from === "-infinity" ? "Aturan awal" : r.effective_from} —{" "}
                {r.effective_until || "Seterusnya"}
              </FontStyle>
              <FontStyle>
                {r.rules.startTime || r.rules.windowStart || "Libur"}
                {r.rules.endTime || r.rules.latestFinish
                  ? " – " + (r.rules.endTime || r.rules.latestFinish)
                  : ""}
              </FontStyle>
              <FontStyle>{r.reason}</FontStyle>
            </Box>
          ))}
        </Space>
      </AppModal>
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
