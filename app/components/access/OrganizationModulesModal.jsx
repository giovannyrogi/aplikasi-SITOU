"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Form } from "antd";
import AppModal from "@/app/components/modals/AppModal";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import FormSettingSwitch from "@/app/components/forms/FormSettingSwitch";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import useFormModalClose from "@/app/hooks/useFormModalClose";
import { readApiResponse, applyApiFieldErrors } from "@/lib/api/clientError";
export default function OrganizationModulesModal({ organization, onClose, onSaved, onError }) {
  const [form] = Form.useForm();
  const [module, setModule] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(null);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
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
        const body = await readApiResponse(
          await fetch(`/api/access/modules?organizationId=${organization.id}`, {
            signal: controller.signal,
            cache: "no-store",
          }),
        );
        if (!controller.signal.aborted) {
          setModule(body.data);
          form.resetFields();
          form.setFieldsValue({ isEnabled: body.data.is_enabled });
        }
      },
      { message: "Memuat modul organisasi..." },
    ).catch((error) => {
      if (error.name !== "AbortError") callbacks.current.onError(error.message);
    });
    return () => controller.abort();
  }, [organization, form, runWithLoadingBackdrop]);
  const save = async (values) => {
    if (saving || !module) return;
    setSaving(true);
    try {
      await runWithLoadingBackdrop(
        async () => {
          const body = await readApiResponse(
            await fetch("/api/access/modules", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                organizationId: Number(organization.id),
                isEnabled: values.isEnabled,
                version: module.version,
              }),
            }),
          );
          window.dispatchEvent(new Event("sitou:access-changed"));
          await callbacks.current.onSaved(body.message);
        },
        { message: "Menyimpan modul organisasi..." },
      );
    } catch (error) {
      applyApiFieldErrors(form, error);
      callbacks.current.onError(error.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <AppModal
        open={Boolean(organization)}
        title="Modul organisasi"
        description={organization?.name}
        icon="navigation:inventory"
        size="sm"
        onClose={close.requestClose}
        disableClose={saving}
        footer={
          <>
            <Button disabled={saving} onClick={close.requestClose}>
              Batal
            </Button>
            <Button
              type="primary"
              loading={saving}
              disabled={!module}
              onClick={() => form.submit()}
            >
              Simpan modul
            </Button>
          </>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={() => {
            dirtyRef.current = true;
          }}
          onFinish={(values) => {
            if (module?.is_enabled && !values.isEnabled) setPending(values);
            else void save(values);
          }}
        >
          <FormSettingSwitch
            name="isEnabled"
            title="Inventaris"
            description="Aktifkan Inventaris untuk akun yang diberi akses. Saat nonaktif, gudang dan paket tetap tersimpan. Akses pulih setelah modul diaktifkan kembali."
          />
        </Form>
      </AppModal>
      <ConfirmDialog
        open={Boolean(pending)}
        title="Nonaktifkan Inventaris?"
        message="Seluruh akun organisasi akan kehilangan akses Inventaris. Gudang dan pemberian paket tetap tersimpan."
        confirmText="Nonaktifkan modul"
        danger
        onClose={() => setPending(null)}
        onConfirm={() => {
          const values = pending;
          setPending(null);
          void save(values);
        }}
      />
      <ConfirmDialog
        open={close.confirmCloseOpen}
        title="Tutup tanpa menyimpan?"
        message="Perubahan modul belum disimpan."
        confirmText="Tutup"
        onClose={close.keepEditing}
        onConfirm={close.discardChanges}
      />
    </>
  );
}
