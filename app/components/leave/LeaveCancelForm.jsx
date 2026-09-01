"use client";
import { Button, Form, Input } from "antd";
import AppModal from "@/app/components/modals/AppModal";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { readApiResponse } from "@/lib/api/clientError";
export default function LeaveCancelForm({ item, onClose, onSaved, onError }) {
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const submit = async ({ reason }) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(`/api/leave-requests/${item.id}/cancel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              organizationId: item.organization_id,
              reason,
              version: new Date(item.updated_at).toISOString(),
            }),
          });
          const body = await readApiResponse(response);
          await onSaved(body.message);
        },
        { message: "Membatalkan cuti atau izin..." },
      );
    } catch (error) {
      onError(error.message);
    }
  };
  return (
    <AppModal
      open
      title="Batalkan cuti atau izin"
      description="Histori tetap disimpan dan saldo akan dikembalikan bila sebelumnya dipotong."
      icon="solar:calendar-remove-bold-duotone"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Kembali</Button>
          <Button danger type="primary" onClick={() => form.submit()}>
            Batalkan pencatatan
          </Button>
        </>
      }
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item
          name="reason"
          label="Alasan pembatalan"
          rules={[{ required: true }, { min: 10, message: "Alasan minimal 10 karakter." }]}
        >
          <Input.TextArea rows={4} maxLength={2000} showCount />
        </Form.Item>
      </Form>
    </AppModal>
  );
}
