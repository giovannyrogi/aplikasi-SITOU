"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Col, DatePicker, Form, Input, InputNumber, Row, Select } from "antd";
import AppModal from "@/app/components/modals/AppModal";
import EmployeeSelect from "@/app/components/selects/EmployeeSelect";
import OrganizationScopeField from "@/app/components/forms/OrganizationScopeField";
import FileUploadListField from "@/app/components/forms/FileUploadListField";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { readApiResponse } from "@/lib/api/clientError";
import { LEAVE_UNIT } from "./leaveLabels";
import { MAX_LEAVE_ATTACHMENTS, MAX_LEAVE_FILE_BYTES } from "@/lib/leave/requestRules.mjs";

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
  const [confirmation, setConfirmation] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const watchedTypeId = Form.useWatch("leaveTypeId", form);
  const period = Form.useWatch("period", form);
  const selectedType = types.find((item) => item.id === String(watchedTypeId));
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    if (!open || !organizationId) return;
    const controller = new AbortController();
    form.resetFields();
    form.setFieldsValue({
      organizationId,
      employeeId: presetEmployeeId || undefined,
      requestedUnits: 1,
      attachmentFiles: [],
    });
    fetch(`/api/leave-types?organizationId=${organizationId}&options=true`, {
      signal: controller.signal,
    })
      .then(readApiResponse)
      .then((body) => setTypes(body.data || []))
      .catch((error) => {
        if (error.name !== "AbortError") onErrorRef.current?.(error.message);
      });
    return () => controller.abort();
  }, [form, open, organizationId, presetEmployeeId]);
  useEffect(() => {
    if (period?.[0] && period?.[1] && selectedType?.unit === "day")
      form.setFieldValue(
        "requestedUnits",
        period[1].startOf("day").diff(period[0].startOf("day"), "day") + 1,
      );
  }, [form, period, selectedType]);
  /** Field tanggal API dipetakan ke satu rentang tanggal tanpa membuang pesan. */
  const formFieldName = (name) =>
    name === "startDate" || name === "endDate"
      ? "period"
      : name === "attachmentFileIds" || name === "files"
        ? "attachmentFiles"
        : name;

  /** Memfokuskan field pertama yang bermasalah tanpa menghapus isian pengguna. */
  const focusError = (name) => {
    if (!name) return;
    window.setTimeout(() => {
      form.scrollToField(name, { behavior: "smooth", block: "center", focus: true });
      const instance = form.getFieldInstance(name);
      if (instance?.focus) instance.focus();
      else document.getElementById(`leave-request_${name}`)?.focus();
    }, 100);
  };

  const validate = async () => {
    if (savingRef.current) return;
    try {
      const values = await form.validateFields();
      if (
        !selectedEmployee ||
        String(selectedEmployee.id) !== String(values.employeeId) ||
        !selectedType
      ) {
        onErrorRef.current?.(
          "Tunggu sampai data pegawai dan jenis cuti selesai dimuat, lalu coba kembali.",
        );
        return;
      }
      setConfirmation({ values, employee: selectedEmployee, type: selectedType });
      setConfirm(true);
    } catch (error) {
      focusError(error.errorFields?.[0]?.name);
      onErrorRef.current?.(
        error.errorFields?.[0]?.errors?.[0] || "Periksa field yang ditandai, lalu coba kembali.",
      );
    }
  };
  const submit = async () => {
    if (savingRef.current || !confirmation) return;
    savingRef.current = true;
    setSaving(true);
    setConfirm(false);
    const values = confirmation.values;
    try {
      await runWithLoadingBackdrop(
        async () => {
          const payload = {
            organizationId,
            employeeId: values.employeeId,
            leaveTypeId: values.leaveTypeId,
            startDate: values.period[0].format("YYYY-MM-DD"),
            endDate: values.period[1].format("YYYY-MM-DD"),
            requestedUnits: values.requestedUnits,
            reason: values.reason,
            decisionNotes: values.decisionNotes || null,
            attachmentFileIds: [],
          };
          const formData = new FormData();
          formData.append("payload", JSON.stringify(payload));
          for (const entry of values.attachmentFiles || [])
            formData.append("files", entry.localFile);
          const response = await fetch("/api/leave-requests", {
            method: "POST",
            body: formData,
          });
          const body = await readApiResponse(response);
          await onSaved(body.message);
        },
        { message: "Mencatat dan menyetujui cuti atau izin..." },
      );
    } catch (error) {
      const errors = new Map();
      for (const [name, message] of Object.entries(error.fieldErrors || {})) {
        const field = formFieldName(name);
        errors.set(field, [...(errors.get(field) || []), message]);
      }
      form.setFields([...errors].map(([name, messages]) => ({ name, errors: messages })));
      focusError(errors.keys().next().value);
      onErrorRef.current?.(error.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <>
      <AppModal
        open={open}
        onClose={onClose}
        title="Catat cuti atau izin"
        description="Pencatatan oleh HRD langsung disetujui. Jika jenis cuti menggunakan saldo, saldo berkurang setelah berhasil disimpan."
        icon="solar:calendar-add-bold-duotone"
        size="lg"
        disableClose={saving}
        footer={
          <>
            <Button onClick={onClose} disabled={saving}>
              Batal
            </Button>
            <Button type="primary" onClick={validate} loading={saving} disabled={confirm}>
              Simpan
            </Button>
          </>
        }
      >
        <Alert
          type="info"
          showIcon
          title="Periksa data sebelum menyimpan"
          description="Data yang tersimpan tidak dapat diedit atau dihapus. Jika ada kesalahan, batalkan pencatatan dengan alasan, lalu catat ulang. Saldo yang terpotong akan dikembalikan saat pembatalan."
          style={{ marginBottom: 20 }}
        />
        <Form form={form} name="leave-request" layout="vertical" disabled={saving || confirm}>
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
                <EmployeeSelect
                  organizationId={organizationId}
                  onError={onError}
                  onSelectedEmployeeChange={setSelectedEmployee}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="leaveTypeId"
                label="Jenis cuti atau izin"
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
                label="Tanggal mulai dan selesai"
                rules={[{ required: true, message: "Tanggal mulai dan selesai wajib dipilih." }]}
              >
                <DatePicker.RangePicker format="DD MMM YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="requestedUnits"
                label={`Jumlah ${selectedType?.unit === "hour" ? "jam" : "hari"} yang dibebankan`}
                rules={[
                  { required: true, message: "Isi jumlah hari atau jam yang dibebankan." },
                  {
                    type: "integer",
                    min: 1,
                    message: "Jumlah harus berupa angka bulat minimal 1.",
                  },
                ]}
                extra={
                  selectedType?.unit === "hour"
                    ? "Isi jumlah jam sesuai kebijakan organisasi."
                    : "Perkiraan awal memakai hari kalender. Sesuaikan dengan hari kerja dan kebijakan organisasi. Jumlah ini digunakan untuk mengurangi saldo jika jenis cuti memakai saldo."
                }
              >
                <InputNumber min={1} step={1} precision={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                name="reason"
                label="Alasan cuti atau izin"
                rules={[
                  { required: true, message: "Alasan cuti atau izin wajib diisi." },
                  { min: 10, message: "Alasan minimal 10 karakter." },
                ]}
              >
                <Input.TextArea rows={3} maxLength={2000} showCount />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                name="attachmentFiles"
                label="Dokumen pendukung"
                required={Boolean(selectedType?.requires_attachment)}
                rules={[
                  {
                    validator: (_, value) =>
                      selectedType?.requires_attachment && !value?.length
                        ? Promise.reject(
                            new Error("Dokumen pendukung wajib dilengkapi untuk jenis ini."),
                          )
                        : Promise.resolve(),
                  },
                ]}
                extra={
                  selectedType?.requires_attachment
                    ? "Dokumen wajib diunggah sesuai aturan cuti atau izin yang dipilih."
                    : "Dokumen pendukung tidak wajib untuk jenis ini."
                }
              >
                <FileUploadListField
                  onError={onError}
                  accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                  maxSizeBytes={MAX_LEAVE_FILE_BYTES}
                  maxCount={MAX_LEAVE_ATTACHMENTS}
                  disabled={saving || confirm}
                  emptyTitle="Pilih atau tarik dokumen ke area ini"
                  helpText="Satu file JPG, PNG, WebP, atau PDF. Maksimal 10 MB."
                  selectedText="Lampiran siap disimpan bersama pencatatan"
                  fullWidth
                />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="decisionNotes" label="Catatan HRD (opsional)">
                <Input.TextArea rows={2} maxLength={2000} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </AppModal>
      <ConfirmDialog
        open={confirm}
        title="Simpan cuti atau izin?"
        message={
          confirmation ? (
            <span style={{ display: "grid", gap: 12, overflowWrap: "anywhere" }}>
              <span>
                <strong>{confirmation.employee.full_name}</strong>
                <br />
                NIP: {confirmation.employee.employee_no}
              </span>
              <span>
                {confirmation.type.name}
                <br />
                {confirmation.values.period[0].format("DD MMM YYYY")} –{" "}
                {confirmation.values.period[1].format("DD MMM YYYY")}
                <br />
                Jumlah yang dibebankan: {confirmation.values.requestedUnits}{" "}
                {LEAVE_UNIT[confirmation.type.unit]}
              </span>
              <span>
                {confirmation.type.uses_balance
                  ? `Saldo akan berkurang ${confirmation.values.requestedUnits} ${LEAVE_UNIT[confirmation.type.unit]} setelah berhasil disimpan.`
                  : "Pencatatan ini tidak mengurangi saldo."}
              </span>
              <span>
                Pencatatan langsung disetujui. Koreksi dilakukan melalui pembatalan dengan alasan,
                lalu pencatatan ulang.
              </span>
            </span>
          ) : (
            ""
          )
        }
        confirmText="Simpan"
        loading={saving}
        onClose={() => setConfirm(false)}
        onConfirm={submit}
      />
    </>
  );
}
