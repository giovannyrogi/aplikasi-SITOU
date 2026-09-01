"use client";

import { applyApiFieldErrors, readApiResponse } from "@/lib/api/clientError";

import { useEffect, useState } from "react";
import { Button, DatePicker, Form, Input, Select } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { Box, useTheme } from "@mui/material";
import dayjs from "dayjs";
import AppModal from "@/app/components/modals/AppModal";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import OrganizationScopeField from "@/app/components/forms/OrganizationScopeField";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import FileUploadField from "@/app/components/forms/FileUploadField";
import FormSettingSwitch, { FormSettingsGroup } from "@/app/components/forms/FormSettingSwitch";
import { ACTION_LABELS } from "./disciplineLabels";

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
    if (open) {
      // Bersihkan nilai dari sesi modal sebelumnya sebelum memasang nilai awal kasus baru.
      form.resetFields();
      form.setFieldsValue({
        organizationId: organizationId || user.organization_id,
        employeeId: employee?.id,
        incidentDate: dayjs(),
        severity: "light",
      });
    }
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
          const body = await readApiResponse(response);
          // Pastikan pembukaan modal berikutnya tidak membawa uraian kasus yang baru disimpan.
          form.resetFields();
          await onSaved(body.message);
        },
        { message: "Membuka kasus disiplin..." },
      );
    } catch (error) {
      applyApiFieldErrors(form, error);
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
export function DisciplinaryActionForm({
  open,
  disciplineCase,
  action = null,
  onClose,
  onSaved,
  onError,
}) {
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
        actionType: action?.action_type || "oral_warning",
        letterNo: action?.letter_no || null,
        issuedDate: action?.issued_date ? dayjs(action.issued_date) : dayjs(),
        effectiveFrom: action?.effective_from ? dayjs(action.effective_from) : dayjs(),
        effectiveUntil: action?.effective_until ? dayjs(action.effective_until) : null,
        status: action?.status || "draft",
        directEscalation: Boolean(action?.direct_escalation),
        escalationReason: action?.escalation_reason || null,
        notes: action?.notes || null,
      });
      queueMicrotask(() =>
        setFile(
          action?.document_file_id
            ? {
                id: action.document_file_id,
                original_name: action.document_original_name,
                mime_type: action.document_mime_type,
                size_bytes: action.document_size_bytes,
              }
            : null,
        ),
      );
    }
  }, [action, disciplineCase, form, open]);

  /** Nilai eskalasi lama dibersihkan ketika jenis tindakan tidak lagi mendukung lompatan SP. */
  useEffect(() => {
    if (!supportsDirectEscalation) {
      form.setFieldsValue({ directEscalation: false, escalationReason: null });
    }
  }, [form, supportsDirectEscalation]);
  const submit = async (values) => {
    try {
      const submittedRequiresDocument =
        values.actionType !== "oral_warning" && values.status === "active";
      if (submittedRequiresDocument && !values.letterNo?.trim()) {
        throw new Error("Nomor surat wajib diisi untuk tindakan tertulis ini.");
      }
      if (submittedRequiresDocument && !file) {
        throw new Error("PDF surat wajib diunggah sebelum tindakan tertulis disimpan.");
      }
      await runWithLoadingBackdrop(
        async () => {
          let documentFileId = file?.id || null;
          if (file instanceof File) {
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
          const endpoint = action
            ? `/api/discipline/actions/${action.id}`
            : `/api/discipline/cases/${disciplineCase.id}/actions`;
          const response = await fetch(endpoint, {
            method: action ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const body = await readApiResponse(response);
          await onSaved(body.message);
        },
        { message: action ? "Menyimpan perubahan tindakan..." : "Menyimpan tindakan disiplin..." },
      );
    } catch (error) {
      applyApiFieldErrors(form, error);
      onError(error.message);
    }
  };
  return (
    <AppModal
      open={open}
      title={action ? "Edit draft tindakan" : "Tetapkan tindakan disiplin"}
      description="Draft dapat dilengkapi kemudian. Saat diterbitkan menjadi Aktif, tindakan tertulis wajib memiliki nomor dan PDF surat resmi."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="primary" onClick={() => form.submit()}>
            {action ? "Simpan perubahan" : "Simpan tindakan"}
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
          label={
            actionType === "oral_warning"
              ? "Nomor surat (tidak diperlukan untuk teguran lisan)"
              : "Nomor surat tindakan"
          }
          extra={
            actionType === "oral_warning"
              ? "Kosongkan bila keputusan hanya berupa teguran lisan."
              : "Masukkan nomor yang sama dengan PDF surat resmi."
          }
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
        <Form.Item
          name="status"
          label="Status"
          extra="Draft masih dapat diedit. Aktif berarti keputusan resmi telah diterbitkan dan tidak dapat diedit langsung."
        >
          <Select
            options={[
              { value: "active", label: "Aktif" },
              { value: "draft", label: "Draft" },
            ]}
          />
        </Form.Item>
        <Form.Item
          label={requiresWrittenDocument ? "PDF surat tindakan" : "PDF pendukung (opsional)"}
          required={requiresWrittenDocument}
          validateStatus={requiresWrittenDocument && !file ? "error" : undefined}
          help={
            requiresWrittenDocument && !file
              ? "PDF surat wajib diunggah sebelum tindakan tertulis disimpan."
              : undefined
          }
        >
          <FileUploadField
            value={file}
            previewUrl={
              file?.id
                ? `/api/uploads/${file.id}?organizationId=${disciplineCase.organization_id}`
                : undefined
            }
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
          <FormSettingsGroup sx={{ mb: 3 }}>
            <FormSettingSwitch
              name="directEscalation"
              title="Terbitkan langsung tanpa tahapan sebelumnya"
              description={`Aktifkan hanya jika penerbitan ${actionType?.toUpperCase()} secara langsung sesuai dengan tingkat pelanggaran dan keputusan organisasi.`}
            >
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
            </FormSettingSwitch>
          </FormSettingsGroup>
        ) : null}
        <Form.Item name="notes" label="Catatan internal">
          <Input.TextArea rows={2} maxLength={3000} />
        </Form.Item>
      </Form>
    </AppModal>
  );
}

/** Form pencabutan menyimpan alasan resmi tanpa mengubah atau menghapus tindakan asal. */
export function DisciplinaryActionRevokeForm({
  open,
  action,
  organizationId,
  onClose,
  onSaved,
  onError,
}) {
  const theme = useTheme();
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const reason = Form.useWatch("reason", form) || "";

  useEffect(() => {
    if (open) form.resetFields();
  }, [form, open]);

  const submit = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(`/api/discipline/actions/${action.id}/revoke`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ organizationId, reason: values.reason }),
          });
          const body = await readApiResponse(response);
          form.resetFields();
          await onSaved(body.message);
        },
        { message: "Mencabut tindakan disiplin..." },
      );
    } catch (error) {
      applyApiFieldErrors(form, error);
      onError(error.message);
    }
  };

  return (
    <AppModal
      open={open}
      title="Cabut tindakan disiplin"
      description="Catat alasan pencabutan untuk histori tindakan."
      size="sm"
      onClose={onClose}
      footer={
        <Box
          sx={{
            width: "100%",
            display: "flex",
            justifyContent: "flex-end",
            flexDirection: { xs: "column-reverse", sm: "row" },
            gap: 1,
            "& .ant-btn": { minHeight: 44, width: { xs: "100%", sm: "auto" } },
          }}
        >
          <Button onClick={onClose}>Batal</Button>
          <Button type="primary" danger onClick={() => form.submit()}>
            Cabut tindakan
          </Button>
        </Box>
      }
    >
      <Box sx={{ display: "grid", gap: 2.25 }}>
        <Box
          component="section"
          sx={{
            p: 2,
            bgcolor: theme.ui.panelSubtleBg,
            border: `1px solid ${theme.ui.panelBorderSubtle}`,
            borderRadius: "8px",
          }}
        >
          <FontStyle fontSize={11.5} fontWeight={600} sx={{ color: theme.ui.mutedText }}>
            Tindakan yang akan dicabut
          </FontStyle>
          <Box sx={{ mt: 1, display: "flex", gap: 0.75, flexWrap: "wrap" }}>
            <CompactInfoChip
              label={ACTION_LABELS[action.action_type] || action.action_type}
              tone="danger"
            />
            {action.letter_no ? <CompactInfoChip label={action.letter_no} tone="neutral" /> : null}
          </Box>
          <FontStyle fontSize={11.5} sx={{ mt: 1, color: theme.ui.mutedText }}>
            Diterbitkan{" "}
            {action.issued_date ? dayjs(action.issued_date).format("DD MMMM YYYY") : "-"}
          </FontStyle>
        </Box>

        <Box
          sx={{
            p: 1.5,
            display: "flex",
            alignItems: "flex-start",
            gap: 1,
            color: theme.status.info.text,
            bgcolor: theme.status.info.background,
            border: `1px solid ${theme.status.info.border}`,
            borderRadius: "8px",
          }}
        >
          <InfoCircleOutlined style={{ marginTop: 2 }} />
          <FontStyle fontSize={11.5} sx={{ lineHeight: 1.6 }}>
            Tindakan dan surat tetap tersimpan dalam histori.
          </FontStyle>
        </Box>

        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item
            name="reason"
            label="Alasan pencabutan"
            style={{ marginBottom: 0 }}
            rules={[
              { required: true, message: "Alasan pencabutan wajib diisi." },
              { min: 10, message: "Alasan pencabutan minimal 10 karakter." },
            ]}
          >
            <Input.TextArea
              rows={5}
              maxLength={3000}
              placeholder="Jelaskan alasan tindakan ini dicabut."
            />
          </Form.Item>
          <Box
            sx={{
              mt: 0.75,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.5,
            }}
          >
            <FontStyle fontSize={11} sx={{ color: theme.ui.mutedText }}>
              Minimal 10 karakter
            </FontStyle>
            <FontStyle
              aria-live="polite"
              fontSize={11}
              fontWeight={600}
              sx={{ color: theme.ui.mutedText, flexShrink: 0 }}
            >
              {reason.length}/3000
            </FontStyle>
          </Box>
        </Form>
      </Box>
    </AppModal>
  );
}
