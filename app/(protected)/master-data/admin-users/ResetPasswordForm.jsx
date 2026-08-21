"use client";

import { useEffect } from "react";
import { Button, Form, Input } from "antd";
import AppModal from "@/app/components/modals/AppModal";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import useFormModalClose from "@/app/hooks/useFormModalClose";
import { PASSWORD_FORM_RULES, PASSWORD_HELP_TEXT } from "@/app/utils/passwordRules";

export default function ResetPasswordForm({ open, item, onClose, onSaved, onError }) {
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const closeGuard = useFormModalClose(form, onClose);

  useEffect(() => {
    if (open) form.resetFields();
  }, [form, open]);

  const submit = async ({ password, confirmPassword }) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(`/api/admin-users/${item.id}/password`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password, confirmPassword }),
          });
          const body = await response.json();
          if (!response.ok) {
            if (body.fieldErrors) {
              form.setFields(
                Object.entries(body.fieldErrors).map(([name, message]) => ({
                  name,
                  errors: [message],
                })),
              );
            }
            throw new Error(body.message);
          }
          await onSaved(body.message);
        },
        { message: "Memperbarui password..." },
      );
    } catch (error) {
      onError(error.message || "Password gagal diperbarui.");
    }
  };

  return (
    <>
      <AppModal
        open={open}
        onClose={closeGuard.requestClose}
        title="Atur ulang password"
        description={`Buat password awal baru untuk @${item?.username || "admin"}.`}
        icon="solar:lock-password-bold-duotone"
        size="sm"
        footer={
          <>
            <Button onClick={closeGuard.requestClose}>Batal</Button>
            <Button type="primary" onClick={() => form.submit()}>
              Perbarui password
            </Button>
          </>
        }
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item
            name="password"
            label="Password baru"
            extra={PASSWORD_HELP_TEXT}
            rules={PASSWORD_FORM_RULES}
          >
            <Input.Password autoComplete="new-password" maxLength={72} />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Konfirmasi password baru"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Konfirmasi password wajib diisi." },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) return Promise.resolve();
                  return Promise.reject(new Error("Konfirmasi password tidak sama."));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" maxLength={72} />
          </Form.Item>
        </Form>
      </AppModal>
      <ConfirmDialog
        open={closeGuard.confirmCloseOpen}
        title="Buang perubahan?"
        message="Password baru belum disimpan."
        confirmText="Buang perubahan"
        danger
        onClose={closeGuard.keepEditing}
        onConfirm={closeGuard.discardChanges}
      />
    </>
  );
}
