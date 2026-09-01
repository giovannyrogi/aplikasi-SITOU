"use client";
import { Button, Form, Input, InputNumber, Select } from "antd";
import AppModal from "@/app/components/modals/AppModal";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { readApiResponse } from "@/lib/api/clientError";
export default function LeaveBalanceAdjustmentForm({
  employee,
  entitlement,
  onClose,
  onSaved,
  onError,
}) {
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const submit = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(
            `/api/employees/${employee.id}/leave-balances/${entitlement.id}/adjustments`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ organizationId: employee.organization_id, ...values }),
            },
          );
          const body = await readApiResponse(response);
          await onSaved(body.message);
        },
        { message: "Menyesuaikan saldo cuti..." },
      );
    } catch (error) {
      onError(error.message);
    }
  };
  return (
    <AppModal
      open
      title="Kelola saldo cuti"
      description={`${entitlement.name} · saldo saat ini ${entitlement.balance} ${entitlement.unit === "day" ? "hari" : "jam"}`}
      icon="solar:wallet-money-bold-duotone"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="primary" onClick={() => form.submit()}>
            Simpan penyesuaian
          </Button>
        </>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={submit}
        initialValues={{ transactionType: "adjustment" }}
      >
        <Form.Item name="transactionType" label="Jenis transaksi" rules={[{ required: true }]}>
          <Select
            options={[
              { value: "adjustment", label: "Penyesuaian saldo" },
              { value: "carryover", label: "Carry-over manual" },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="units"
          label="Jumlah"
          extra="Gunakan angka negatif untuk mengurangi saldo pada penyesuaian."
          rules={[{ required: true }]}
        >
          <InputNumber step={1} precision={0} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item
          name="reason"
          label="Alasan"
          rules={[{ required: true }, { min: 10, message: "Alasan minimal 10 karakter." }]}
        >
          <Input.TextArea rows={4} maxLength={2000} showCount />
        </Form.Item>
      </Form>
    </AppModal>
  );
}
