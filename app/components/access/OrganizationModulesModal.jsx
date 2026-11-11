"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Form, Space } from "antd";
import { Box } from "@mui/material";
import AppModal from "@/app/components/modals/AppModal";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import FormSettingSwitch from "@/app/components/forms/FormSettingSwitch";
import AppNotice from "@/app/components/data-display/AppNotice";
import { ORGANIZATION_MODULES, SELFIE_CHECK_MODULE } from "@/lib/access/organizationModules.mjs";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import useFormModalClose from "@/app/hooks/useFormModalClose";
import { readApiResponse, applyApiFieldErrors } from "@/lib/api/clientError";

const featureDescriptions = {
  inventory: {
    on: "Akun yang diberi akses dapat mengelola gudang, persediaan, dan transaksi.",
    off: "Akses inventaris ditutup. Data gudang dan transaksi tetap tersimpan.",
  },
  attendance: {
    on: "HRD dapat mengelola jadwal kerja, kalender libur, dan titik absen sesuai hak akses.",
    off: "Akses fitur absensi ditutup. Data dan hak akses tetap tersimpan.",
  },
  [SELFIE_CHECK_MODULE]: {
    on: "Saat absen di HP, kamera memandu posisi wajah dan memeriksa kejelasan foto.",
    off: "Pegawai tetap mengambil selfie dengan kamera seperti biasa.",
  },
};

export default function OrganizationModulesModal({ organization, onClose, onSaved, onError }) {
  const [form] = Form.useForm();
  const [modules, setModules] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(null);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const attendanceEnabled = Form.useWatch("attendance", form);
  const dirtyRef = useRef(false);
  const close = useFormModalClose(form, onClose, () => dirtyRef.current);
  const callbacks = useRef({ onError, onSaved });
  useEffect(() => {
    callbacks.current = { onError, onSaved };
  }, [onError, onSaved]);
  useEffect(() => {
    if (!organization) return;
    dirtyRef.current = false;
    const controller = new AbortController();
    void runWithLoadingBackdrop(
      async () => {
        setModules(null);
        setError("");
        setPending(null);
        const body = await readApiResponse(
          await fetch("/api/access/modules?view=all&organizationId=" + organization.id, {
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]),
            cache: "no-store",
          }),
        );
        if (!controller.signal.aborted) {
          setModules(body.data.modules);
          form.resetFields();
          form.setFieldsValue(
            Object.fromEntries(
              ORGANIZATION_MODULES.map((item) => [
                item.code,
                body.data.modules[item.code].is_enabled,
              ]),
            ),
          );
        }
      },
      { message: "Memuat fitur organisasi..." },
    ).catch((failure) => {
      if (!controller.signal.aborted) {
        setError(failure.message);
        callbacks.current.onError(failure.message);
      }
    });
    return () => controller.abort();
  }, [organization, form, retry, runWithLoadingBackdrop]);
  const save = async (changes) => {
    if (saving || !modules) return;
    setSaving(true);
    try {
      await runWithLoadingBackdrop(
        async () => {
          const body = await readApiResponse(
            await fetch("/api/access/modules", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              signal: AbortSignal.timeout(45000),
              body: JSON.stringify({ organizationId: Number(organization.id), changes }),
            }),
          );
          dirtyRef.current = false;
          window.dispatchEvent(new Event("sitou:access-changed"));
          await callbacks.current.onSaved(body.message);
        },
        { message: "Menyimpan fitur organisasi..." },
      );
    } catch (failure) {
      applyApiFieldErrors(form, failure);
      callbacks.current.onError(failure.message);
    } finally {
      setSaving(false);
    }
  };
  const disabledNames = pending
    ?.filter((change) => !change.isEnabled && change.moduleCode !== SELFIE_CHECK_MODULE)
    .map((change) => ORGANIZATION_MODULES.find((item) => item.code === change.moduleCode).label)
    .join(" dan ");
  return (
    <>
      <AppModal
        open={Boolean(organization)}
        title="Fitur organisasi"
        description={organization?.name}
        icon="navigation:organization-settings"
        size="sm"
        onClose={close.requestClose}
        disableClose={saving}
        footer={
          <Space wrap>
            <Button disabled={saving} onClick={close.requestClose}>
              Batal
            </Button>
            <Button
              type="primary"
              loading={saving}
              disabled={!modules}
              onClick={() => form.submit()}
            >
              Simpan fitur
            </Button>
          </Space>
        }
      >
        {error ? (
          <AppNotice
            tone="danger"
            title="Fitur organisasi tidak dapat dimuat"
            description={error}
            action={<Button onClick={() => setRetry((value) => value + 1)}>Coba lagi</Button>}
          />
        ) : null}
        <Form
          form={form}
          layout="vertical"
          disabled={saving || !modules}
          onValuesChange={() => {
            dirtyRef.current = true;
          }}
          onFinish={(values) => {
            if (!modules) return;
            const changes = ORGANIZATION_MODULES.filter(
              (item) => Boolean(values[item.code]) !== modules[item.code].is_enabled,
            ).map((item) => ({
              moduleCode: item.code,
              isEnabled: Boolean(values[item.code]),
              version: modules[item.code].version,
            }));
            if (!changes.length) {
              onClose();
              return;
            }
            if (
              changes.some(
                (change) => !change.isEnabled && change.moduleCode !== SELFIE_CHECK_MODULE,
              )
            )
              setPending(changes);
            else void save(changes);
          }}
        >
          <Box
            sx={{ display: "grid", gap: { xs: 1.5, sm: 2 }, "& .form-setting-switch": { py: 0 } }}
          >
            {modules &&
              ORGANIZATION_MODULES.map((item) => {
                const locked = item.parent === "attendance" && !attendanceEnabled;
                const descriptions = featureDescriptions[item.code];
                const title = "Fitur " + item.label;
                const offNotice = {
                  title: title + " nonaktif",
                  description: locked
                    ? "Aktifkan fitur Absensi untuk menggunakan deteksi wajah."
                    : descriptions.off,
                  tone: "warning",
                };

                return (
                  <FormSettingSwitch
                    key={item.code}
                    name={item.code}
                    title={title}
                    notice={{
                      on: locked
                        ? offNotice
                        : { title: title + " aktif", description: descriptions.on },
                      off: offNotice,
                    }}
                    noticeProps={{ descriptionAlign: "left" }}
                    disabled={locked}
                    formItemProps={
                      locked ? { getValueProps: () => ({ checked: false }) } : undefined
                    }
                  />
                );
              })}
          </Box>
        </Form>
      </AppModal>
      <ConfirmDialog
        open={Boolean(pending)}
        title="Nonaktifkan fitur organisasi?"
        message={
          "Akses " +
          disabledNames +
          " akan ditutup untuk akun organisasi. Data dan hak akses tetap tersimpan. Pengaktifan kembali mengikuti hak akses yang masih berlaku."
        }
        confirmText="Nonaktifkan fitur"
        danger
        onClose={() => setPending(null)}
        onConfirm={() => {
          const changes = pending;
          setPending(null);
          void save(changes);
        }}
      />
      <ConfirmDialog
        open={close.confirmCloseOpen}
        title="Tutup tanpa menyimpan?"
        message="Perubahan fitur belum disimpan."
        confirmText="Tutup"
        onClose={close.keepEditing}
        onConfirm={close.discardChanges}
      />
    </>
  );
}
