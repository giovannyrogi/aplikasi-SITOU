"use client";

import { useEffect, useState } from "react";
import { Button, DatePicker, Form } from "antd";
import { PlusOutlined, StopOutlined } from "@ant-design/icons";
import { Box } from "@mui/material";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import OperationalFilterSection from "@/app/components/filters/OperationalFilterSection";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import AppModal from "@/app/components/modals/AppModal";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import Notification from "@/app/components/Notifications/Notification";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import useDataList from "@/app/hooks/useDataList";
import useAppNotification from "@/app/hooks/useAppNotification";
import useFormModalClose from "@/app/hooks/useFormModalClose";
import { readApiResponse } from "@/lib/api/clientError";
import { hrisLevel } from "@/lib/access/hrisPolicy.mjs";

const endpoint = "/api/attendance-point-access";
function AccessSelect({ organizationId, kind, ...props }) {
  const [search, setSearch] = useState("");
  const [state, setState] = useState({ options: [], loading: true });
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const params = new URLSearchParams({ organizationId, options: kind, search });
        const { data } = await readApiResponse(
          await fetch(endpoint + "?" + params, {
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
          }),
        );
        if (!controller.signal.aborted) setState({ options: data.options, loading: false });
      } catch {
        if (!controller.signal.aborted)
          setState({
            options: [],
            loading: false,
            error: "Pilihan gagal dimuat. Ketik ulang untuk mencoba lagi.",
          });
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [organizationId, kind, search]);
  return (
    <>
      <AsyncSelect
        {...props}
        options={state.options}
        loading={state.loading}
        filterOption={false}
        onSearch={setSearch}
        notFoundContent={state.loading ? "Memuat pilihan…" : state.error || "Tidak ada pilihan."}
      />
      {state.error && <div role="alert">{state.error}</div>}
    </>
  );
}

export default function AttendancePointAccessPage() {
  const user = useAuthenticatedUser();
  const platform = user.role_code === "superadmin";
  const manage = hrisLevel(user, "attendance-point-access") === "manage";
  const list = useDataList(endpoint, {
    requiredFilter: "organizationId",
    initialFilters: platform ? {} : { organizationId: String(user.organization_id) },
  });
  const org = list.filters.organizationId;
  const [open, setOpen] = useState(false);
  const [revoke, setRevoke] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const close = useFormModalClose(form, () => setOpen(false));
  async function save(input) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await runWithLoadingBackdrop(
        async () =>
          readApiResponse(
            await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ organizationId: String(org), ...input }),
              signal: AbortSignal.timeout(25000),
            }),
          ),
        { message: "Menyimpan akses titik…" },
      );
      setOpen(false);
      setRevoke(null);
      showNotification(result.message);
      await list.refresh();
    } catch (error) {
      if (error.fieldErrors)
        form.setFields(
          Object.entries(error.fieldErrors).map(([name, message]) => ({ name, errors: [message] })),
        );
      showNotification(
        error.name === "TimeoutError"
          ? "Hasil penyimpanan belum diketahui. Muat ulang daftar sebelum mencoba lagi."
          : error.message,
        "error",
      );
    } finally {
      setBusy(false);
    }
  }
  const revokeAction = (row) =>
    manage &&
    !row.revoked_at &&
    !row.expired && (
      <Button icon={<StopOutlined />} onClick={() => setRevoke(row)}>
        Cabut akses
      </Button>
    );
  const accessStatus = (row) =>
    row.revoked_at ? "Dicabut" : row.expired ? "Berakhir" : row.upcoming ? "Terjadwal" : "Berlaku";
  const period = (row) => row.effective_from + " – " + (row.effective_until || "Seterusnya");
  const columns = [
    { title: "Pegawai", dataIndex: "full_name" },
    { title: "NIP", dataIndex: "employee_no" },
    { title: "Titik absensi", dataIndex: "point_name" },
    { title: "Periode", render: (_, row) => period(row) },
    { title: "Status akses", render: (_, row) => accessStatus(row) },
    ...(manage ? [{ title: "Aksi", render: (_, row) => revokeAction(row) }] : []),
  ];

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="Akses Titik Absensi"
        description="Berikan titik absensi tambahan kepada Pegawai selama penugasan."
        action={
          manage && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!org}
              onClick={() => {
                form.resetFields();
                setOpen(true);
              }}
            >
              Tambah akses
            </Button>
          )
        }
      />
      <OperationalFilterSection
        title="Filter akses titik"
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Nama Pegawai, NIP, atau titik"
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
                      allowClear
                      onChange={(organizationId) => list.updateFilters({ organizationId })}
                    />
                  ),
                },
              ]
            : []
        }
      />
      <DataPanel title="Daftar akses tambahan">
        <ResponsiveDataView
          data={list.data}
          columns={columns}
          loading={list.loading}
          error={list.error}
          onRetry={list.refresh}
          pagination={list.pagination}
          onPageChange={list.setPage}
          emptyDescription={org ? "Belum ada akses tambahan." : "Pilih organisasi."}
          renderCard={(row) => (
            <Box sx={{ display: "grid", gap: 1 }}>
              <strong>{row.full_name}</strong>
              <span>NIP {row.employee_no}</span>
              <span>{row.point_name}</span>
              <span>{period(row)}</span>
              <span>{accessStatus(row)}</span>
              {revokeAction(row)}
            </Box>
          )}
        />
      </DataPanel>
      <AppModal
        open={open}
        title="Tambah akses titik"
        onClose={close.requestClose}
        disableClose={busy}
        footer={
          <>
            <Button disabled={busy} onClick={close.requestClose}>
              Batal
            </Button>
            <Button type="primary" loading={busy} onClick={() => form.submit()}>
              Simpan
            </Button>
          </>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) =>
            save({
              employeeId: values.employeeId,
              pointIds: values.pointIds,
              from: values.from.format("YYYY-MM-DD"),
              until: values.until?.format("YYYY-MM-DD") ?? null,
            })
          }
        >
          <Form.Item
            label="Pegawai"
            name="employeeId"
            rules={[{ required: true, message: "Pilih Pegawai." }]}
          >
            <AccessSelect organizationId={org} kind="employees" placeholder="Cari nama atau NIP" />
          </Form.Item>
          <Form.Item
            label="Titik absensi tambahan"
            name="pointIds"
            extra="Siapkan titik aktif melalui Data Master → Lokasi."
            rules={[{ required: true, message: "Pilih minimal satu titik absensi." }]}
          >
            <AccessSelect
              organizationId={org}
              kind="points"
              mode="multiple"
              maxCount={25}
              placeholder="Cari titik absensi"
            />
          </Form.Item>
          <Form.Item
            label="Mulai berlaku"
            name="from"
            rules={[{ required: true, message: "Isi tanggal mulai." }]}
          >
            <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Akhir berlaku (opsional)" name="until">
            <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </AppModal>
      <ConfirmDialog
        open={close.confirmCloseOpen}
        title="Buang perubahan?"
        message="Perubahan akses titik belum disimpan."
        confirmText="Buang perubahan"
        danger
        onClose={close.keepEditing}
        onConfirm={close.discardChanges}
      />
      <ConfirmDialog
        open={Boolean(revoke)}
        title="Cabut akses titik?"
        message={`Akses tambahan ${revoke?.full_name ?? ""} ke ${revoke?.point_name ?? ""} akan berakhir sekarang. Riwayat tetap tersedia.`}
        confirmText="Cabut akses"
        danger
        loading={busy}
        onClose={() => setRevoke(null)}
        onConfirm={() => save({ revokeId: revoke.id })}
      />
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
