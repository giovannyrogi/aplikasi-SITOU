"use client";

import { useEffect, useState } from "react";
import { Button, DatePicker, Form, Input, Select, Switch } from "antd";
import dayjs from "dayjs";
import AppModal from "@/app/components/modals/AppModal";
import OrganizationScopeField from "@/app/components/forms/OrganizationScopeField";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import FileUploadField from "@/app/components/forms/FileUploadField";

/** Form kasus mencatat pemeriksaan manual tanpa pernah menghasilkan sanksi otomatis. */
export function DisciplineCaseForm({
  open,
  organizationId,
  employee = null,
  onClose,
  onSaved,
  onError,
}) {
  const user = useAuthenticatedUser();
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const [employees, setEmployees] = useState([]);
  const selectedOrganizationId = Form.useWatch("organizationId", form);
  useEffect(() => {
    if (open)
      form.setFieldsValue({
        organizationId: organizationId || user.organization_id,
        employeeId: employee?.id,
        incidentDate: dayjs(),
        severity: "light",
      });
  }, [employee?.id, form, open, organizationId, user.organization_id]);
  useEffect(() => {
    const target = selectedOrganizationId || organizationId || user.organization_id;
    if (!open || !target || employee) return;
    fetch(`/api/employees/options?organizationId=${target}`)
      .then((response) => response.json())
      .then((body) => setEmployees(body.data || []))
      .catch(() => onError("Daftar pegawai tidak dapat dimuat."));
  }, [employee, onError, open, organizationId, selectedOrganizationId, user.organization_id]);
  const submit = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch("/api/discipline/cases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...values,
              incidentDate: values.incidentDate.format("YYYY-MM-DD"),
            }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.message);
          await onSaved(body.message);
        },
        { message: "Membuka kasus disiplin..." },
      );
    } catch (error) {
      onError(error.message);
    }
  };
  return (
    <AppModal
      open={open}
      title="Catat kasus disiplin"
      description="Tahap pemeriksaan: catat fakta dan penjelasan pegawai. Sanksi ditentukan setelah kasus tersimpan."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="primary" onClick={() => form.submit()}>
            Simpan kasus
          </Button>
        </>
      }
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        <OrganizationScopeField disabled={Boolean(employee)} />
        <Form.Item name="employeeId" label="Pegawai" rules={[{ required: true }]}>
          <Select
            disabled={Boolean(employee)}
            showSearch
            optionFilterProp="label"
            options={
              employee
                ? [
                    {
                      value: employee.id,
                      label: `${employee.employee_no} - ${employee.full_name}`,
                    },
                  ]
                : employees.map((value) => ({
                    value: value.id,
                    label: `${value.employee_no} - ${value.full_name}`,
                  }))
            }
          />
        </Form.Item>
        <Form.Item name="severity" label="Tingkat pelanggaran" rules={[{ required: true }]}>
          <Select
            options={[
              { value: "light", label: "Ringan" },
              { value: "moderate", label: "Sedang" },
              { value: "severe", label: "Berat" },
            ]}
          />
        </Form.Item>
        <Form.Item name="incidentDate" label="Tanggal kejadian" rules={[{ required: true }]}>
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="description" label="Uraian kejadian" rules={[{ required: true, min: 10 }]}>
          <Input.TextArea rows={4} maxLength={5000} showCount />
        </Form.Item>
        <Form.Item name="employeeExplanation" label="Penjelasan pegawai">
          <Input.TextArea rows={3} maxLength={5000} showCount />
        </Form.Item>
      </Form>
    </AppModal>
  );
}

/** Form tindakan mengunggah surat privat lebih dahulu lalu menyimpan fileId pada sanksi. */
export function DisciplinaryActionForm({ open, disciplineCase, onClose, onSaved, onError }) {
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const [file, setFile] = useState(null);
  const actionType = Form.useWatch("actionType", form);
  const actionStatus = Form.useWatch("status", form);
  const isSp = ["sp1", "sp2", "sp3"].includes(actionType);
  const supportsDirectEscalation = ["sp2", "sp3"].includes(actionType);
  const requiresWrittenDocument =
    actionType && actionType !== "oral_warning" && actionStatus === "active";
  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        organizationId: disciplineCase.organization_id,
        actionType: "oral_warning",
        issuedDate: dayjs(),
        effectiveFrom: dayjs(),
        status: "active",
        directEscalation: false,
      });
      queueMicrotask(() => setFile(null));
    }
  }, [disciplineCase, form, open]);

  /** Nilai eskalasi lama dibersihkan ketika jenis tindakan tidak lagi mendukung lompatan SP. */
  useEffect(() => {
    if (!supportsDirectEscalation) {
      form.setFieldsValue({ directEscalation: false, escalationReason: null });
    }
  }, [form, supportsDirectEscalation]);
  const submit = async (values) => {
    try {
      if (values.status === "active" && values.actionType !== "oral_warning" && !file) {
        throw new Error("PDF surat wajib diunggah sebelum tindakan tertulis diaktifkan.");
      }
      await runWithLoadingBackdrop(
        async () => {
          let documentFileId = null;
          if (file) {
            const upload = new FormData();
            upload.append("file", file);
            upload.append(
              "fileKind",
              `sanksi_${values.actionType === "sp1" || values.actionType === "sp2" || values.actionType === "sp3" ? values.actionType : "lainnya"}`,
            );
            upload.append("employeeId", disciplineCase.employee_id);
            upload.append("organizationId", disciplineCase.organization_id);
            const uploadResponse = await fetch("/api/uploads", { method: "POST", body: upload });
            const uploadBody = await uploadResponse.json();
            if (!uploadResponse.ok) throw new Error(uploadBody.message);
            documentFileId = uploadBody.data.id;
          }
          const payload = {
            ...values,
            issuedDate: values.issuedDate.format("YYYY-MM-DD"),
            effectiveFrom: values.effectiveFrom.format("YYYY-MM-DD"),
            effectiveUntil: values.effectiveUntil?.format("YYYY-MM-DD") || null,
            documentFileId,
          };
          const response = await fetch(`/api/discipline/cases/${disciplineCase.id}/actions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.message);
          await onSaved(body.message);
        },
        { message: "Menerbitkan tindakan disiplin..." },
      );
    } catch (error) {
      onError(error.message);
    }
  };
  return (
    <AppModal
      open={open}
      title="Terbitkan tindakan disiplin"
      description="Tindakan merupakan keputusan HRD dan tersimpan sebagai histori resmi."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="primary" onClick={() => form.submit()}>
            Simpan tindakan
          </Button>
        </>
      }
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="organizationId" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="actionType" label="Jenis tindakan" rules={[{ required: true }]}>
          <Select
            options={[
              { value: "oral_warning", label: "Teguran lisan" },
              { value: "sp1", label: "SP1" },
              { value: "sp2", label: "SP2" },
              { value: "sp3", label: "SP3" },
              { value: "suspension", label: "Skorsing" },
              { value: "demotion", label: "Demosi" },
              { value: "other", label: "Tindakan lain" },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="letterNo"
          label={requiresWrittenDocument ? "Nomor surat" : "Nomor surat (opsional)"}
          rules={
            requiresWrittenDocument
              ? [{ required: true, message: "Nomor surat wajib untuk tindakan tertulis aktif." }]
              : []
          }
        >
          <Input maxLength={100} />
        </Form.Item>
        <Form.Item name="issuedDate" label="Tanggal terbit" rules={[{ required: true }]}>
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="effectiveFrom" label="Mulai berlaku" rules={[{ required: true }]}>
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>
        {isSp ? (
          <Form.Item label="Masa berlaku SP">
            <Input disabled value="Otomatis 3 bulan sejak tanggal terbit" />
          </Form.Item>
        ) : (
          <Form.Item
            name="effectiveUntil"
            label="Tanggal berakhir tindakan (opsional)"
            extra="Isi hanya jika tindakan memiliki batas waktu, misalnya masa skorsing. Kosongkan jika tidak memiliki tanggal akhir."
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
        )}
        <Form.Item name="status" label="Status">
          <Select
            options={[
              { value: "active", label: "Aktif" },
              { value: "draft", label: "Draft" },
            ]}
          />
        </Form.Item>
        <Form.Item
          label={requiresWrittenDocument ? "Dokumen surat" : "Dokumen pendukung (opsional)"}
          required={requiresWrittenDocument}
          validateStatus={requiresWrittenDocument && !file ? "error" : undefined}
          help={
            requiresWrittenDocument && !file
              ? "PDF surat wajib diunggah sebelum tindakan tertulis diaktifkan."
              : undefined
          }
        >
          <FileUploadField
            value={file}
            accept="application/pdf,.pdf"
            maxSizeBytes={10 * 1024 * 1024}
            emptyTitle="Pilih atau tarik surat tindakan ke area ini"
            helpText="Gunakan PDF resmi maksimal 10 MB. Dokumen tertulis diperiksa kembali saat tindakan disimpan."
            selectedText="Dokumen terpilih dan siap disimpan"
            onSelect={setFile}
            onRemove={() => setFile(null)}
            onError={onError}
          />
        </Form.Item>
        {supportsDirectEscalation ? (
          <>
            <Form.Item
              name="directEscalation"
              label={`Langsung menerbitkan ${actionType?.toUpperCase()} tanpa tahapan sebelumnya`}
              valuePropName="checked"
              extra="Aktifkan hanya bila keputusan langsung ke tingkat ini dibenarkan oleh tingkat pelanggaran dan proses organisasi."
            >
              <Switch />
            </Form.Item>
            <Form.Item
              noStyle
              shouldUpdate={(previous, current) =>
                previous.directEscalation !== current.directEscalation
              }
            >
              {({ getFieldValue }) =>
                getFieldValue("directEscalation") ? (
                  <Form.Item
                    name="escalationReason"
                    label="Alasan melewati tahapan sebelumnya"
                    rules={[
                      {
                        required: true,
                        message: "Jelaskan alasan tindakan langsung ke tingkat ini.",
                      },
                    ]}
                  >
                    <Input.TextArea rows={2} maxLength={3000} />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
          </>
        ) : null}
        <Form.Item name="notes" label="Catatan internal">
          <Input.TextArea rows={2} maxLength={3000} />
        </Form.Item>
      </Form>
    </AppModal>
  );
}
