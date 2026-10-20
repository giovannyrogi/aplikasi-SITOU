"use client";

import { applyApiFieldErrors, readApiResponse } from "@/lib/api/clientError";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { Button, DatePicker, Form, Input, Select } from "antd";
import { Box, useTheme } from "@mui/material";
import dayjs from "dayjs";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import AppModal from "@/app/components/modals/AppModal";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import AppNotice from "@/app/components/data-display/AppNotice";
import FontStyle from "@/app/components/font-style/FontStyle";
import OrganizationScopeField from "@/app/components/forms/OrganizationScopeField";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import FileUploadField from "@/app/components/forms/FileUploadField";
import FormSettingSwitch, { FormSettingsGroup } from "@/app/components/forms/FormSettingSwitch";
import { formatDisciplinaryValidityPeriod } from "@/lib/discipline/presentation.mjs";
import { disciplinaryDateErrors } from "@/lib/discipline/issuancePolicy.mjs";

/** Perbandingan keputusan lama/baru memakai struktur identik agar konteks tidak tertukar. */
function ReplacementSanctionCard({ label, name, start, end, tone }) {
  const theme = useTheme();
  return (
    <Box
      component="section"
      aria-label={label}
      sx={{
        p: 2,
        border: "1px solid",
        borderColor: theme.status[tone].border,
        bgcolor: theme.status[tone].background,
        borderRadius: 2,
        minWidth: 0,
        display: "grid",
        gap: 1,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          alignItems: "center",
          gap: 1.5,
          minWidth: 0,
        }}
      >
        <FontStyle
          component="h3"
          fontSize={15}
          fontWeight={700}
          sx={{ minWidth: 0, overflowWrap: "anywhere" }}
        >
          {name}
        </FontStyle>
        <CompactInfoChip label={label} tone={tone} />
      </Box>
      <Box component="dl" sx={{ m: 0 }}>
        <FontStyle component="dt" fontSize={12} sx={{ color: "text.secondary" }}>
          Masa berlaku
        </FontStyle>
        <FontStyle component="dd" fontSize={13} sx={{ m: 0, mt: 0.5, overflowWrap: "anywhere" }}>
          {formatDisciplinaryValidityPeriod(start, end, (value) =>
            dayjs(value).format("DD MMM YYYY"),
          )}
        </FontStyle>
      </Box>
    </Box>
  );
}

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

/** Form tindakan mengirim data dan PDF bersama tombol simpan. */
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
  const [fileError, setFileError] = useState("");
  const initializedSession = useRef(null);
  const [actionTypes, setActionTypes] = useState([]);
  const [context, setContext] = useState({ loading: true, error: "", activeActions: [] });
  const [contextReload, setContextReload] = useState(0);
  const [confirmation, setConfirmation] = useState(null);
  const [saving, setSaving] = useState(false);
  const confirmedType = actionTypes.find(
    (type) => String(type.id) === String(confirmation?.values.actionTypeId),
  );
  const confirmedEnd =
    confirmation && confirmedType?.duration_mode === "fixed"
      ? confirmation.values.effectiveFrom
          .add(
            confirmedType.duration_value,
            confirmedType.duration_unit === "day" ? "day" : "month",
          )
          .format("YYYY-MM-DD")
      : null;
  const loadActionContext = useCallback(
    async (signal) => {
      const response = await fetch(
        `/api/discipline/cases/${disciplineCase.id}/actions?organizationId=${disciplineCase.organization_id}`,
        { signal, cache: "no-store" },
      );
      const body = await readApiResponse(response);
      if (signal?.aborted) return null;
      setActionTypes(body.data.actionTypes);
      setContext({ ...body.data, loading: false, error: "" });
      return body.data;
    },
    [disciplineCase.id, disciplineCase.organization_id],
  );
  const reportLoadError = useEffectEvent((message) => onError(message));
  const actionTypeId = Form.useWatch("actionTypeId", form);
  const actionStatus = Form.useWatch("status", form);
  const issuedDate = Form.useWatch("issuedDate", form);
  const effectiveFrom = Form.useWatch("effectiveFrom", form);
  const incidentDate = context.incidentDate || disciplineCase.incident_date;
  const validateDate = (field) => (_, value) => {
    if (!value) return Promise.resolve();
    if (!value.isValid()) return Promise.reject(new Error("Tanggal tidak valid."));
    const errors = disciplinaryDateErrors({
      incidentDate,
      issuedDate: form.getFieldValue("issuedDate")?.format("YYYY-MM-DD"),
      effectiveFrom: form.getFieldValue("effectiveFrom")?.format("YYYY-MM-DD"),
      status: form.getFieldValue("status"),
      today: context.today,
    });
    return errors[field] ? Promise.reject(new Error(errors[field])) : Promise.resolve();
  };
  const disabledActionDate = (value, field) => {
    const date = value.format("YYYY-MM-DD");
    return Boolean(
      (incidentDate && date < incidentDate) ||
      (field === "effectiveFrom" &&
        issuedDate?.isValid() &&
        date < issuedDate.format("YYYY-MM-DD")) ||
      (actionStatus === "active" && context.today && date > context.today),
    );
  };
  const selectedActionType = actionTypes.find((item) => String(item.id) === String(actionTypeId));
  const supportsDirectEscalation = Boolean(
    selectedActionType?.allows_direct_escalation ?? action?.allows_direct_escalation,
  );
  const requiresWrittenDocument =
    Boolean(selectedActionType?.requires_document ?? action?.requires_document_snapshot) &&
    actionStatus === "active";
  const effectiveUntil = (() => {
    if (!effectiveFrom || !selectedActionType || selectedActionType.duration_mode === "indefinite")
      return null;
    return effectiveFrom.add(
      selectedActionType.duration_value,
      selectedActionType.duration_unit === "day" ? "day" : "month",
    );
  })();
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    Promise.resolve()
      .then(async () => {
        if (controller.signal.aborted) return;
        setContext((current) => ({ ...current, loading: true, error: "" }));
        await loadActionContext(controller.signal);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setContext({ loading: false, error: error.message, activeActions: [] });
          reportLoadError(error.message);
        }
      });
    return () => controller.abort();
  }, [loadActionContext, open, contextReload]);
  useEffect(() => {
    if (!open) {
      initializedSession.current = null;
      return;
    }
    if (!context.today || !context.incidentDate) return;
    // Refresh session/data induk tidak boleh menghapus isian dan PDF yang belum disimpan.
    const sessionKey = `${disciplineCase.organization_id}:${disciplineCase.id}:${action?.id || "new"}`;
    if (initializedSession.current !== sessionKey) {
      initializedSession.current = sessionKey;
      form.resetFields();
      form.setFieldsValue({
        organizationId: disciplineCase.organization_id,
        actionTypeId: action?.action_type_id || null,
        letterNo: action?.letter_no || null,
        issuedDate: action?.issued_date
          ? dayjs(action.issued_date)
          : dayjs(context.incidentDate > context.today ? context.incidentDate : context.today),
        effectiveFrom: action?.effective_from
          ? dayjs(action.effective_from)
          : dayjs(context.incidentDate > context.today ? context.incidentDate : context.today),
        status: action?.status || "draft",
        directEscalation: Boolean(action?.direct_escalation),
        escalationReason: action?.escalation_reason || null,
        notes: action?.notes || null,
      });
      queueMicrotask(() => {
        if (initializedSession.current !== sessionKey) return;
        setFileError("");
        setFile(
          action?.document_file_id
            ? {
                id: action.document_file_id,
                original_name: action.document_original_name,
                mime_type: action.document_mime_type,
                size_bytes: action.document_size_bytes,
              }
            : null,
        );
      });
    }
  }, [action, disciplineCase, form, open, context.today, context.incidentDate]);

  useEffect(() => {
    if (!open || action || actionTypeId || !actionTypes.length) return;
    form.setFieldValue(
      "actionTypeId",
      actionTypes.find((type) => type.is_active && !type.disabled_reason)?.id,
    );
  }, [action, actionTypeId, actionTypes, form, open]);

  /** Nilai eskalasi lama dibersihkan ketika jenis tindakan tidak lagi mendukung lompatan SP. */
  useEffect(() => {
    if (!supportsDirectEscalation) {
      form.setFieldsValue({ directEscalation: false, escalationReason: null });
    }
  }, [form, supportsDirectEscalation]);
  const submit = async (values, confirmedIds = null) => {
    try {
      setSaving(true);
      const submittedType = actionTypes.find(
        (item) => String(item.id) === String(values.actionTypeId),
      );
      const submittedRequiresDocument =
        Boolean(submittedType?.requires_document) && values.status === "active";
      if (
        values.status === "active" &&
        submittedType?.requires_direct_escalation &&
        !values.directEscalation
      )
        throw new Error(
          "Tahapan sebelumnya belum berlaku. Aktifkan penerbitan langsung dan isi alasannya.",
        );
      if (submittedRequiresDocument && !values.letterNo?.trim()) {
        throw new Error("Nomor surat wajib diisi untuk tindakan tertulis ini.");
      }
      if (submittedRequiresDocument && !file) {
        setFileError("Pilih PDF surat sebelum menyimpan tindakan aktif.");
        throw new Error("PDF surat wajib diunggah sebelum tindakan tertulis disimpan.");
      }
      if (confirmedIds === null) {
        const fresh = await runWithLoadingBackdrop(() => loadActionContext(), {
          message: "Memeriksa sanksi yang berlaku...",
        });
        const blocked = fresh.actionTypes.find(
          (type) => String(type.id) === String(values.actionTypeId),
        )?.disabled_reason;
        if (blocked) {
          form.setFields([{ name: "actionTypeId", errors: [blocked] }]);
          throw new Error(blocked);
        }
        const dateErrors = disciplinaryDateErrors({
          incidentDate: fresh.incidentDate,
          issuedDate: values.issuedDate.format("YYYY-MM-DD"),
          effectiveFrom: values.effectiveFrom.format("YYYY-MM-DD"),
          status: values.status,
          today: fresh.today,
        });
        if (Object.keys(dateErrors).length) {
          form.setFields(
            Object.entries(dateErrors).map(([name, message]) => ({ name, errors: [message] })),
          );
          throw new Error(Object.values(dateErrors)[0]);
        }
        if (values.status === "active" && fresh.activeActions.length) {
          setConfirmation({ values, activeActions: fresh.activeActions });
          return;
        }
      }
      setSaving(true);
      await runWithLoadingBackdrop(
        async () => {
          const payload = {
            ...values,
            issuedDate: values.issuedDate.format("YYYY-MM-DD"),
            effectiveFrom: values.effectiveFrom.format("YYYY-MM-DD"),
            documentFileId: file?.id || null,
            replacementActionIds: confirmedIds || [],
          };
          const endpoint = action
            ? `/api/discipline/actions/${action.id}`
            : `/api/discipline/cases/${disciplineCase.id}/actions`;
          const formData = new FormData();
          formData.append("payload", JSON.stringify(payload));
          if (file instanceof File) formData.append("file", file);
          const response = await fetch(endpoint, {
            method: action ? "PATCH" : "POST",
            body: formData,
          });
          const body = await readApiResponse(response);
          await onSaved(body.message);
        },
        { message: action ? "Menyimpan perubahan tindakan..." : "Menyimpan tindakan disiplin..." },
      );
    } catch (error) {
      setConfirmation(null);
      if (["ACTION_CONFIRMATION_CHANGED", "ACTION_TYPE_BLOCKED"].includes(error.code))
        setContextReload((n) => n + 1);
      applyApiFieldErrors(form, error);
      if (error.fieldErrors?.documentFileId || error.fieldErrors?.file)
        setFileError(error.fieldErrors.documentFileId || error.fieldErrors.file);
      onError(error.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <AppModal
        open={open && !confirmation}
        disableClose={saving}
        title={action ? "Edit draft tindakan" : "Tetapkan tindakan disiplin"}
        description="Draft dapat dilengkapi kemudian. Saat diterbitkan menjadi Aktif, tindakan tertulis wajib memiliki nomor dan PDF surat resmi."
        size="lg"
        onClose={onClose}
        footer={
          <>
            <Button disabled={saving} onClick={onClose}>
              Batal
            </Button>
            <Button
              type="primary"
              disabled={context.loading || !!context.error}
              loading={saving}
              onClick={() => form.submit()}
            >
              {action ? "Simpan perubahan" : "Simpan tindakan"}
            </Button>
          </>
        }
      >
        <Box
          component={Form}
          form={form}
          layout="vertical"
          onFinish={submit}
          scrollToFirstError={{ behavior: "smooth", block: "center" }}
          sx={{
            display: "grid",
            gap: 3,
            pb: 1,
            "& .ant-form-item": { marginBottom: 0, minWidth: 0 },
            "& .ant-form-item-extra, & .ant-form-item-explain": { paddingTop: 1, lineHeight: 1.6 },
            "& .ant-picker, & .ant-select, & input.ant-input": { minHeight: 44 },
          }}
        >
          {context.error ? (
            <AppNotice
              tone="danger"
              title="Pilihan sanksi tidak dapat dimuat."
              action={<Button onClick={() => setContextReload((n) => n + 1)}>Coba lagi</Button>}
            />
          ) : null}
          {!context.loading && context.activeActions.length ? (
            <AppNotice
              compact
              tone="info"
              title="Pegawai masih memiliki sanksi yang berlaku."
              description="Jenis yang sama dan tahapan yang lebih rendah tidak dapat dipilih."
            />
          ) : null}
          <Form.Item name="organizationId" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="actionTypeId"
            label="Jenis tindakan"
            rules={[
              { required: true },
              {
                validator: (_, value) => {
                  const reason = actionTypes.find(
                    (type) => String(type.id) === String(value),
                  )?.disabled_reason;
                  return reason ? Promise.reject(new Error(reason)) : Promise.resolve();
                },
              },
            ]}
          >
            <Select
              loading={context.loading}
              disabled={context.loading || !!context.error}
              showSearch
              optionFilterProp="label"
              options={actionTypes.map((item) => ({
                value: item.id,
                label: item.disabled_reason ? `${item.name} — ${item.disabled_reason}` : item.name,
                disabled: !item.is_active || !!item.disabled_reason,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="letterNo"
            label={
              selectedActionType?.requires_document
                ? "Nomor surat tindakan"
                : "Nomor surat (opsional)"
            }
            extra={
              selectedActionType?.requires_document
                ? "Masukkan nomor yang sama dengan PDF surat resmi."
                : "Jenis tindakan ini tidak mewajibkan surat resmi."
            }
            rules={
              requiresWrittenDocument
                ? [{ required: true, message: "Nomor surat wajib untuk tindakan tertulis aktif." }]
                : []
            }
          >
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item
            name="issuedDate"
            label="Tanggal terbit"
            extra="Tidak boleh sebelum tanggal kejadian."
            dependencies={["status"]}
            rules={[
              { required: true, message: "Tanggal terbit wajib diisi." },
              { validator: validateDate("issuedDate") },
            ]}
          >
            <DatePicker
              style={{ width: "100%" }}
              disabled={context.loading || Boolean(context.error)}
              disabledDate={(value) => disabledActionDate(value, "issuedDate")}
            />
          </Form.Item>
          <Form.Item
            name="effectiveFrom"
            label="Mulai berlaku"
            extra="Tidak boleh sebelum tanggal terbit. Tanggal mendatang hanya untuk draft."
            rules={[
              { required: true, message: "Tanggal mulai berlaku wajib diisi." },
              { validator: validateDate("effectiveFrom") },
            ]}
            dependencies={["issuedDate", "status"]}
          >
            <DatePicker
              style={{ width: "100%" }}
              disabled={context.loading || Boolean(context.error)}
              disabledDate={(value) => disabledActionDate(value, "effectiveFrom")}
            />
          </Form.Item>
          <Form.Item
            label="Berakhir pada"
            extra="Dihitung otomatis dari tanggal mulai dan Pengaturan Sanksi organisasi."
          >
            <Input
              disabled
              value={
                selectedActionType?.duration_mode === "indefinite"
                  ? "Tidak memiliki tanggal akhir"
                  : effectiveUntil
                    ? effectiveUntil.format("DD MMMM YYYY")
                    : "Pilih jenis tindakan dan tanggal mulai"
              }
            />
          </Form.Item>
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
            validateStatus={fileError ? "error" : undefined}
            help={fileError || undefined}
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
              onSelect={(selectedFile) => {
                setFile(selectedFile);
                setFileError("");
              }}
              onRemove={() => {
                setFile(null);
                setFileError("");
              }}
              onError={(message) => {
                setFileError(message);
                onError(message);
              }}
            />
          </Form.Item>
          {supportsDirectEscalation ? (
            <FormSettingsGroup>
              {selectedActionType?.requires_direct_escalation && actionStatus === "active" ? (
                <AppNotice
                  compact
                  tone="warning"
                  title="Tahapan sebelumnya belum berlaku."
                  description="Untuk menerbitkan langsung ke tingkat ini, aktifkan pilihan di bawah dan isi alasannya."
                />
              ) : null}
              <FormSettingSwitch
                name="directEscalation"
                title="Terbitkan langsung tanpa tahapan sebelumnya"
                description={`Aktifkan hanya jika penerbitan ${selectedActionType?.name || "tindakan ini"} secara langsung sesuai dengan tingkat pelanggaran dan keputusan organisasi.`}
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
        </Box>
      </AppModal>
      <ConfirmDialog
        open={open && Boolean(confirmation)}
        title="Konfirmasi penggantian sanksi"
        description="Periksa sanksi lama dan sanksi baru sebelum diterbitkan."
        message="Sanksi baru akan menggantikan sanksi lama berikut. Surat dan riwayat sanksi lama tetap tersimpan."
        messageAlign="left"
        confirmText="Terbitkan sanksi baru"
        fullWidthMobile
        loading={saving}
        onClose={() => setConfirmation(null)}
        onConfirm={() =>
          submit(
            confirmation.values,
            confirmation.activeActions.map((item) => String(item.id)),
          )
        }
      >
        <Box sx={{ display: "grid", gap: 1.5 }}>
          {confirmation?.activeActions.map((item) => (
            <ReplacementSanctionCard
              key={item.id}
              label="Sanksi lama"
              name={item.action_name_snapshot}
              start={item.effective_from}
              end={item.effective_until}
              tone="warning"
            />
          ))}
          {confirmation ? (
            <ReplacementSanctionCard
              label="Sanksi baru"
              name={confirmedType?.name}
              start={confirmation.values.effectiveFrom.format("YYYY-MM-DD")}
              end={confirmedEnd}
              tone="info"
            />
          ) : null}
        </Box>
      </ConfirmDialog>
    </>
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

  const [confirmation, setConfirmation] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) form.resetFields();
  }, [form, open]);

  const submit = async (values, confirmedIds = null) => {
    try {
      setSaving(true);
      if (confirmedIds === null) {
        const preview = await runWithLoadingBackdrop(
          async () =>
            readApiResponse(
              await fetch(
                `/api/discipline/actions/${action.id}/revoke?organizationId=${organizationId}`,
                { cache: "no-store" },
              ),
            ),
          { message: "Memeriksa sanksi sebelumnya..." },
        );
        if (preview.data.restorableActions.length) {
          setConfirmation({ values, actions: preview.data.restorableActions });
          return;
        }
      }
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(`/api/discipline/actions/${action.id}/revoke`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              organizationId,
              reason: values.reason,
              restorationActionIds: confirmedIds || [],
            }),
          });
          const body = await readApiResponse(response);
          form.resetFields();
          await onSaved(body.message);
        },
        { message: "Mencabut tindakan disiplin..." },
      );
    } catch (error) {
      setConfirmation(null);
      applyApiFieldErrors(form, error);
      onError(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AppModal
        open={open && !confirmation}
        disableClose={saving}
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
            <Button disabled={saving} onClick={onClose}>
              Batal
            </Button>
            <Button type="primary" danger loading={saving} onClick={() => form.submit()}>
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
              <CompactInfoChip label={action.action_name_snapshot} tone="danger" />
              {action.letter_no ? (
                <CompactInfoChip label={action.letter_no} tone="neutral" />
              ) : null}
            </Box>
            <FontStyle fontSize={11.5} sx={{ mt: 1, color: theme.ui.mutedText }}>
              Diterbitkan{" "}
              {action.issued_date ? dayjs(action.issued_date).format("DD MMMM YYYY") : "-"}
            </FontStyle>
          </Box>

          <AppNotice tone="info" compact>
            Tindakan dan surat tetap tersimpan dalam histori.
          </AppNotice>

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
      <ConfirmDialog
        open={open && Boolean(confirmation)}
        title="Cabut sanksi?"
        description="Periksa perubahan sanksi berikut."
        message="Sanksi sebelumnya akan aktif kembali dengan masa berlaku yang ditampilkan di bawah. Tanggal berakhirnya tidak berubah. Surat dan riwayat tetap tersimpan."
        messageAlign="justify"
        confirmText="Cabut sanksi"
        danger
        fullWidthMobile
        loading={saving}
        onClose={() => setConfirmation(null)}
        onConfirm={() =>
          submit(
            confirmation.values,
            confirmation.actions.map((item) => String(item.id)),
          )
        }
      >
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <ReplacementSanctionCard
            label="Akan dicabut"
            name={action.action_name_snapshot}
            start={action.effective_from}
            end={action.effective_until}
            tone="warning"
          />
          {confirmation?.actions.map((item) => (
            <ReplacementSanctionCard
              key={item.id}
              label="Berlaku kembali"
              name={item.action_name_snapshot}
              start={item.effective_from}
              end={item.effective_until}
              tone="success"
            />
          ))}
        </Box>
      </ConfirmDialog>
    </>
  );
}
