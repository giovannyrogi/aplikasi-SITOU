"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Col, DatePicker, Form, Input, InputNumber, Row, Select } from "antd";
import dayjs from "dayjs";
import AppModal from "@/app/components/modals/AppModal";
import EmployeeSelect from "@/app/components/selects/EmployeeSelect";
import OrganizationScopeField from "@/app/components/forms/OrganizationScopeField";
import FileUploadListField from "@/app/components/forms/FileUploadListField";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { readApiResponse } from "@/lib/api/clientError";
import { LEAVE_UNIT } from "./leaveLabels";

export default function LeaveRequestForm({
  open,
  organizationId,
  presetEmployeeId,
  onClose,
  onSaved,
  onError,
}) {
  const [form] = Form.useForm();
  const onErrorRef = useRef(onError);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const [types, setTypes] = useState([]);
  const [confirm, setConfirm] = useState(false);
  const watchedTypeId = Form.useWatch("leaveTypeId", form);
  const period = Form.useWatch("period", form);
  const files = Form.useWatch("attachmentFiles", form) || [];
  const selectedType = types.find((item) => item.id === String(watchedTypeId));
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    if (!open || !organizationId) return;
    form.resetFields();
    form.setFieldsValue({
      organizationId,
      employeeId: presetEmployeeId || undefined,
      requestedUnits: 1,
      attachmentFiles: [],
    });
    fetch(`/api/leave-types?organizationId=${organizationId}&options=true`)
      .then(readApiResponse)
      .then((body) => setTypes(body.data || []))
      .catch((error) => onErrorRef.current?.(error.message));
  }, [form, open, organizationId, presetEmployeeId]);
  useEffect(() => {
    if (period?.[0] && period?.[1] && selectedType?.unit === "day")
      form.setFieldValue(
        "requestedUnits",
        period[1].startOf("day").diff(period[0].startOf("day"), "day") + 1,
      );
  }, [form, period, selectedType]);
  const validate = async () => {
    try {
      await form.validateFields();
      setConfirm(true);
    } catch {}
  };
  const submit = async () => {
    setConfirm(false);
    const values = form.getFieldsValue(true);
    const uploaded = [];
    try {
      await runWithLoadingBackdrop(
        async () => {
          for (const entry of files) {
            const data = new FormData();
            data.append("file", entry.localFile);
            data.append("organizationId", organizationId);
            data.append("employeeId", values.employeeId);
            data.append("fileKind", "lampiran_cuti");
            const response = await fetch("/api/uploads", { method: "POST", body: data });
            const body = await readApiResponse(response, "Lampiran tidak dapat diunggah.");
            uploaded.push(body.data.id);
          }
          const response = await fetch("/api/leave-requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              organizationId,
              employeeId: values.employeeId,
              leaveTypeId: values.leaveTypeId,
              startDate: values.period[0].format("YYYY-MM-DD"),
              endDate: values.period[1].format("YYYY-MM-DD"),
              requestedUnits: values.requestedUnits,
              reason: values.reason,
              decisionNotes: values.decisionNotes || null,
              attachmentFileIds: uploaded,
            }),
          });
          const body = await readApiResponse(response);
          await onSaved(body.message);
        },
        { message: "Mencatat dan menyetujui cuti atau izin..." },
      );
    } catch (error) {
      for (const id of uploaded)
        await fetch(`/api/uploads/${id}?organizationId=${organizationId}`, {
          method: "DELETE",
        }).catch(() => {});
      if (error.fieldErrors)
        form.setFields(
          Object.entries(error.fieldErrors).map(([name, message]) => ({
            name:
              name === "startDate" || name === "endDate"
                ? "period"
                : name === "attachmentFileIds"
                  ? "attachmentFiles"
                  : name,
            errors: [message],
          })),
        );
      onError(error.message);
    }
  };
  return (
    <>
      <AppModal
        open={open}
        onClose={onClose}
        title="Catat cuti atau izin"
        description="Pencatatan HRD langsung disetujui dan masuk ke histori pegawai."
        icon="solar:calendar-add-bold-duotone"
        size="lg"
        footer={
          <>
            <Button onClick={onClose}>Batal</Button>
            <Button type="primary" onClick={validate}>
              Periksa & simpan
            </Button>
          </>
        }
      >
        <Alert
          type="info"
          showIcon
          title="Keputusan langsung oleh HRD"
          description="Periksa periode, durasi, saldo, dan lampiran. Data yang disetujui tidak dapat diedit; koreksi dilakukan melalui pembatalan."
          style={{ marginBottom: 20 }}
        />
        <Form form={form} layout="vertical">
          <Row gutter={[16, 4]}>
            <Col xs={24}>
              <OrganizationScopeField disabled />
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="employeeId"
                label="Pegawai"
                rules={[{ required: true, message: "Pegawai wajib dipilih." }]}
              >
                <EmployeeSelect organizationId={organizationId} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="leaveTypeId"
                label="Cuti atau izin"
                rules={[{ required: true, message: "Pilih cuti atau izin." }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={types.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="period"
                label="Periode"
                rules={[{ required: true, message: "Periode wajib dipilih." }]}
              >
                <DatePicker.RangePicker format="DD MMM YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="requestedUnits"
                label={`Durasi yang dibebankan${selectedType ? ` (${LEAVE_UNIT[selectedType.unit]})` : ""}`}
                rules={[{ required: true }]}
              >
                <InputNumber min={1} step={1} precision={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                name="reason"
                label="Alasan"
                rules={[{ required: true }, { min: 10, message: "Alasan minimal 10 karakter." }]}
              >
                <Input.TextArea rows={3} maxLength={2000} showCount />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                name="attachmentFiles"
                label="Lampiran"
                required={Boolean(selectedType?.requires_attachment)}
                rules={[
                  {
                    validator: (_, value) =>
                      selectedType?.requires_attachment && !value?.length
                        ? Promise.reject(new Error("Lampiran wajib dilengkapi untuk pilihan ini."))
                        : Promise.resolve(),
                  },
                ]}
                extra={
                  selectedType?.requires_attachment
                    ? "Dokumen wajib diunggah sesuai aturan cuti atau izin yang dipilih."
                    : "Lampiran bersifat opsional untuk pilihan ini."
                }
              >
                <FileUploadListField
                  onError={onError}
                  accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                  maxSizeBytes={10 * 1024 * 1024}
                  maxCount={5}
                  emptyTitle="Pilih atau tarik lampiran ke area ini"
                  helpText="JPG, PNG, WebP, atau PDF. Maksimal 10 MB per file."
                  selectedText="Lampiran siap disimpan bersama pencatatan"
                  fullWidth
                />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="decisionNotes" label="Catatan keputusan (opsional)">
                <Input.TextArea rows={2} maxLength={2000} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </AppModal>
      <ConfirmDialog
        open={confirm}
        title="Setujui pencatatan ini?"
        message="Cuti atau izin akan langsung disetujui, dicatat pada histori, dan mengurangi saldo bila jenisnya memakai saldo."
        confirmText="Setujui & simpan"
        onClose={() => setConfirm(false)}
        onConfirm={submit}
      />
    </>
  );
}
