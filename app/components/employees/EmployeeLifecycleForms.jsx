"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, DatePicker, Form, Input, Select } from "antd";
import { Box } from "@mui/material";
import dayjs from "dayjs";
import AppModal from "@/app/components/modals/AppModal";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import PrivatePdfUpload from "@/app/components/forms/PrivatePdfUpload";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import { applyApiFieldErrors, normalizeRequestError, readApiResponse } from "@/lib/api/clientError";

/** Memilih tanggal awal aman setelah periode saat ini tanpa memundurkan tanggal ke masa lalu. */
function resolveNextLifecycleDate(startDate, endDate) {
  const today = dayjs().startOf("day");
  const boundaryValue = endDate || startDate;
  if (!boundaryValue) return today;
  const boundary = dayjs(boundaryValue).add(1, "day").startOf("day");
  return boundary.isAfter(today) ? boundary : today;
}

/** Memuat referensi lifecycle satu kali saat modal dibuka. */
function useEmployeeReferences(open, organizationId, onError) {
  const [references, setReferences] = useState({
    locations: [],
    organizationUnits: [],
    positions: [],
    employmentTypes: [],
    employees: [],
  });
  useEffect(() => {
    if (!open || !organizationId) return;
    let active = true;
    fetch(`/api/employees/reference-options?organizationId=${organizationId}`)
      .then((response) => response.json())
      .then((body) => active && setReferences(body.data || {}))
      .catch(() => active && onError("Referensi tidak dapat dimuat."));
    return () => {
      active = false;
    };
  }, [onError, open, organizationId]);
  return references;
}

/** Modal penempatan membuat periode baru atau mengoreksi salah input dengan audit. */
export function AssignmentForm({ open, employee, assignment = null, onClose, onSaved, onError }) {
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const references = useEmployeeReferences(open, employee?.organization_id, onError);
  const locationId = Form.useWatch("locationId", form);
  const [documentFile, setDocumentFile] = useState(null);
  const [removeDocumentOpen, setRemoveDocumentOpen] = useState(false);
  const assignmentEffectiveFrom = assignment?.effective_from;
  const employeeAssignmentEffectiveFrom = employee?.assignment_effective_from;
  const minimumEffectiveDate = useMemo(
    () =>
      assignmentEffectiveFrom
        ? dayjs(assignmentEffectiveFrom).startOf("day")
        : resolveNextLifecycleDate(employeeAssignmentEffectiveFrom),
    [assignmentEffectiveFrom, employeeAssignmentEffectiveFrom],
  );
  const units = useMemo(
    () =>
      (references.organizationUnits || []).filter(
        (unit) => !locationId || (unit.location_ids || []).includes(String(locationId)),
      ),
    [locationId, references.organizationUnits],
  );
  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setRemoveDocumentOpen(false);
        setDocumentFile(
          assignment?.document_file_id
            ? {
                id: assignment.document_file_id,
                original_name: assignment.document_name,
                mime_type: assignment.document_mime_type,
              }
            : null,
        );
      });
      form.resetFields();
      form.setFieldsValue({
        organizationId: employee.organization_id,
        locationId: assignment?.location_id,
        organizationUnitId: assignment?.organization_unit_id,
        positionId: assignment?.position_id,
        supervisorEmployeeId: assignment?.supervisor_employee_id,
        assignmentType: assignment?.assignment_type || "primary",
        changeType: assignment?.change_type || "rotation",
        effectiveFrom: assignment?.effective_from
          ? dayjs(assignment.effective_from)
          : minimumEffectiveDate,
        effectiveUntil: assignment?.effective_until ? dayjs(assignment.effective_until) : null,
        decreeNo: assignment?.decree_no,
        notes: assignment?.notes,
      });
    }
  }, [assignment, employee, form, minimumEffectiveDate, open]);

  /** Mengirim tanggal efektif ISO; service menutup assignment lama satu hari sebelumnya. */
  const submit = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(
            assignment
              ? `/api/employees/${employee.id}/assignments/${assignment.id}`
              : `/api/employees/${employee.id}/assignments`,
            {
              method: assignment ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...values,
                effectiveFrom: values.effectiveFrom.format("YYYY-MM-DD"),
                ...(assignment
                  ? {
                      effectiveUntil: values.effectiveUntil?.format("YYYY-MM-DD") || null,
                      version: new Date(assignment.updated_at).toISOString(),
                    }
                  : {}),
                documentFileId: documentFile?.id || null,
              }),
            },
          );
          const body = await readApiResponse(response, "Penempatan tidak dapat disimpan.");
          await onSaved(body.message);
        },
        {
          message: assignment ? "Menyimpan koreksi penempatan..." : "Menyimpan penempatan baru...",
        },
      );
    } catch (error) {
      const requestError = normalizeRequestError(error, "Penempatan tidak dapat disimpan.");
      applyApiFieldErrors(form, requestError, {
        nonFocusableFields: ["documentFileId", "version"],
      });

      onError(requestError.message);
    }
  };

  return (
    <AppModal
      open={open}
      title={assignment ? "Koreksi penempatan" : "Penempatan atau mutasi"}
      description={
        assignment
          ? "Perbaiki salah input penempatan. Setiap koreksi dicatat dalam audit."
          : "Penempatan aktif lama akan ditutup tanpa menghapus histori."
      }
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="primary" onClick={() => form.submit()}>
            {assignment ? "Simpan koreksi" : "Simpan penempatan"}
          </Button>
        </>
      }
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="organizationId" hidden>
          <Input />
        </Form.Item>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: { sm: "0 16px" },
          }}
        >
          <Form.Item
            name="locationId"
            label={assignment ? "Lokasi" : "Lokasi baru"}
            rules={[{ required: true }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={(references.locations || []).map((value) => ({
                value: value.id,
                label: value.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="organizationUnitId" label="Divisi & Unit" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={units.map((value) => ({ value: value.id, label: value.name }))}
            />
          </Form.Item>
          <Form.Item name="positionId" label="Jabatan">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={(references.positions || []).map((value) => ({
                value: value.id,
                label: value.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="supervisorEmployeeId" label="Atasan">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={(references.employees || [])
                .filter((value) => value.id !== employee.id)
                .map((value) => ({
                  value: value.id,
                  label: `${value.employee_no} - ${value.full_name}`,
                }))}
            />
          </Form.Item>
          <Form.Item name="changeType" label="Jenis perubahan" rules={[{ required: true }]}>
            <Select
              options={[
                ...(assignment?.change_type === "initial"
                  ? [{ value: "initial", label: "Penempatan awal" }]
                  : []),
                { value: "rotation", label: "Rolling" },
                { value: "transfer", label: "Mutasi" },
                { value: "promotion", label: "Promosi" },
                { value: "demotion", label: "Demosi" },
                { value: "acting", label: "Pelaksana tugas" },
                { value: "correction", label: "Koreksi" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="effectiveFrom"
            label="TMT jabatan/penempatan"
            extra="Terhitung mulai tanggal jabatan, unit, lokasi, dan atasan ini berlaku."
            rules={[{ required: true, message: "TMT jabatan/penempatan wajib diisi." }]}
          >
            <DatePicker
              style={{ width: "100%" }}
              disabledDate={
                assignment ? undefined : (current) => current.isBefore(minimumEffectiveDate, "day")
              }
            />
          </Form.Item>
          {assignment?.effective_until ? (
            <Form.Item name="effectiveUntil" label="Tanggal akhir" rules={[{ required: true }]}>
              <DatePicker
                style={{ width: "100%" }}
                disabledDate={(current) => {
                  const start = form.getFieldValue("effectiveFrom");
                  return Boolean(start) && current.isBefore(start, "day");
                }}
              />
            </Form.Item>
          ) : null}
          <Form.Item name="decreeNo" label="Nomor dokumen penempatan (opsional)">
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="assignmentType" label="Jenis penugasan">
            <Select
              options={[
                { value: "primary", label: "Utama" },
                { value: "acting", label: "Pelaksana tugas" },
                { value: "temporary", label: "Sementara" },
                { value: "additional", label: "Tambahan" },
              ]}
            />
          </Form.Item>
        </Box>
        <Form.Item label="Dokumen penempatan (opsional)">
          <PrivatePdfUpload
            value={documentFile}
            uploadUrl="/api/uploads"
            removeUrl={
              documentFile && documentFile.id !== assignment?.document_file_id
                ? `/api/uploads/${documentFile.id}?organizationId=${employee.organization_id}`
                : null
            }
            fields={{ fileKind: "sk_penempatan", employeeId: employee.id }}
            organizationId={employee.organization_id}
            onChange={setDocumentFile}
            onError={onError}
            helpText="Opsional. Gunakan dokumen penempatan, rolling, mutasi, promosi, atau demosi dalam format PDF maksimal 10 MB."
            showRemove={!assignment || documentFile?.id !== assignment.document_file_id}
          />
          {assignment?.document_file_id && documentFile?.id === assignment.document_file_id ? (
            <Button
              type="link"
              danger
              style={{ paddingInline: 0 }}
              onClick={() => setRemoveDocumentOpen(true)}
            >
              Lepas dokumen dari penempatan
            </Button>
          ) : null}
        </Form.Item>
        <Form.Item name="notes" label="Catatan">
          <Input.TextArea rows={3} maxLength={2000} showCount />
        </Form.Item>
      </Form>
      <ConfirmDialog
        open={removeDocumentOpen}
        title="Lepas dokumen SK?"
        message="Dokumen tidak lagi ditautkan ke penempatan setelah koreksi disimpan. Histori file tetap dipertahankan."
        confirmText="Lepas dokumen"
        danger
        onClose={() => setRemoveDocumentOpen(false)}
        onConfirm={() => {
          setDocumentFile(null);
          setRemoveDocumentOpen(false);
        }}
      />
    </AppModal>
  );
}

/** Modal kontrak selalu membuat periode baru agar histori perpanjangan tidak ditimpa. */
export function ContractForm({ open, employee, contract = null, onClose, onSaved, onError }) {
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const references = useEmployeeReferences(open, employee?.organization_id, onError);
  const [documentFile, setDocumentFile] = useState(null);
  const selectedStartDate = Form.useWatch("startDate", form);
  const contractStartDate = contract?.start_date;
  const employeeContractStartDate = employee?.contract_start_date;
  const employeeContractEndDate = employee?.contract_end_date;
  const minimumContractDate = useMemo(
    () =>
      contractStartDate
        ? dayjs(contractStartDate).startOf("day")
        : resolveNextLifecycleDate(employeeContractStartDate, employeeContractEndDate),
    [contractStartDate, employeeContractEndDate, employeeContractStartDate],
  );
  useEffect(() => {
    if (open) {
      queueMicrotask(() =>
        setDocumentFile(
          contract?.document_file_id
            ? {
                id: contract.document_file_id,
                original_name: contract.document_name,
                mime_type: contract.document_mime_type,
              }
            : null,
        ),
      );
      form.resetFields();
      form.setFieldsValue({
        organizationId: employee.organization_id,
        employmentTypeId: contract?.employment_type_id,
        contractNo: contract?.contract_no,
        status: contract?.status || "active",
        startDate: contract?.start_date ? dayjs(contract.start_date) : minimumContractDate,
        endDate: contract?.end_date ? dayjs(contract.end_date) : null,
        notes: contract?.notes,
      });
    }
  }, [contract, employee, form, minimumContractDate, open]);
  const submit = async (values) => {
    if (!contract && !documentFile) {
      onError("Dokumen kontrak wajib diunggah sebelum data disimpan.");
      return;
    }
    try {
      await runWithLoadingBackdrop(
        async () => {
          const payload = {
            ...values,
            startDate: values.startDate.format("YYYY-MM-DD"),
            endDate: values.endDate?.format("YYYY-MM-DD") || null,
            documentFileId: documentFile?.id || null,
            ...(contract ? { version: new Date(contract.updated_at).toISOString() } : {}),
          };
          if (contract) delete payload.status;
          const response = await fetch(
            contract
              ? `/api/employees/${employee.id}/contracts/${contract.id}`
              : `/api/employees/${employee.id}/contracts`,
            {
              method: contract ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          );
          const body = await readApiResponse(response, "Kontrak tidak dapat disimpan.");
          await onSaved(body.message);
        },
        { message: contract ? "Menyimpan koreksi kontrak..." : "Menyimpan kontrak baru..." },
      );
    } catch (error) {
      const requestError = normalizeRequestError(error, "Kontrak tidak dapat disimpan.");
      applyApiFieldErrors(form, requestError, {
        nonFocusableFields: ["documentFileId", "version"],
      });
      onError(requestError.message);
    }
  };
  return (
    <AppModal
      open={open}
      title={contract ? "Koreksi kontrak kerja" : "Kontrak kerja baru"}
      description={
        contract
          ? "Perbaiki kesalahan input. Setiap koreksi dicatat dalam audit."
          : "Perpanjangan disimpan sebagai periode baru dan kontrak lama tetap menjadi histori."
      }
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="primary" onClick={() => form.submit()}>
            {contract ? "Simpan koreksi" : "Simpan kontrak"}
          </Button>
        </>
      }
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="organizationId" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="employmentTypeId" label="Jenis kepegawaian" rules={[{ required: true }]}>
          <Select
            showSearch
            optionFilterProp="label"
            options={(references.employmentTypes || []).map((value) => ({
              value: value.id,
              label: value.name,
            }))}
          />
        </Form.Item>
        <Form.Item
          name="contractNo"
          label={contract ? "Nomor kontrak (opsional)" : "Nomor kontrak"}
          rules={contract ? undefined : [{ required: true, message: "Nomor kontrak wajib diisi." }]}
        >
          <Input maxLength={100} />
        </Form.Item>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: { sm: "0 16px" },
          }}
        >
          <Form.Item
            name="startDate"
            label="Tanggal mulai kontrak"
            extra="Tanggal mulai berlakunya jenis kepegawaian atau perjanjian kerja ini."
            rules={[{ required: true, message: "Tanggal mulai kontrak wajib diisi." }]}
          >
            <DatePicker
              style={{ width: "100%" }}
              disabledDate={
                contract ? undefined : (current) => current.isBefore(minimumContractDate, "day")
              }
            />
          </Form.Item>
          <Form.Item name="endDate" label="Tanggal akhir">
            <DatePicker
              style={{ width: "100%" }}
              disabledDate={(current) =>
                Boolean(selectedStartDate) && current.isBefore(selectedStartDate, "day")
              }
            />
          </Form.Item>
        </Box>
        <Form.Item name="status" hidden>
          <Input />
        </Form.Item>
        <Form.Item
          label={contract ? "Dokumen kontrak (opsional)" : "Dokumen kontrak"}
          required={!contract}
        >
          <PrivatePdfUpload
            value={documentFile}
            uploadUrl="/api/uploads"
            removeUrl={
              documentFile && documentFile.id !== contract?.document_file_id
                ? `/api/uploads/${documentFile.id}?organizationId=${employee.organization_id}`
                : null
            }
            fields={{ fileKind: "kontrak", employeeId: employee.id }}
            organizationId={employee.organization_id}
            onChange={setDocumentFile}
            onError={onError}
            helpText={
              contract
                ? "Opsional. Gunakan dokumen kontrak dalam format PDF maksimal 10 MB."
                : "Kontrak yang telah ditandatangani dalam format PDF maksimal 10 MB."
            }
            showRemove={!contract || documentFile?.id !== contract.document_file_id}
          />
        </Form.Item>
        <Form.Item name="notes" label="Catatan">
          <Input.TextArea rows={3} maxLength={2000} />
        </Form.Item>
      </Form>
    </AppModal>
  );
}

/** Pembatalan logis meminta alasan agar kesalahan input tetap dapat ditelusuri. */
export function ContractCancelForm({ open, employee, contract, onClose, onSaved, onError }) {
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  useEffect(() => {
    if (open) form.resetFields();
  }, [form, open]);

  const submit = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(`/api/employees/${employee.id}/contracts/${contract.id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              organizationId: employee.organization_id,
              version: new Date(contract.updated_at).toISOString(),
              reason: values.reason,
            }),
          });
          const body = await readApiResponse(response, "Kontrak tidak dapat dibatalkan.");
          await onSaved(body.message);
        },
        { message: "Membatalkan kontrak..." },
      );
    } catch (error) {
      const requestError = normalizeRequestError(error, "Kontrak tidak dapat dibatalkan.");
      applyApiFieldErrors(form, requestError, { nonFocusableFields: ["version"] });
      onError(requestError.message);
    }
  };

  return (
    <AppModal
      open={open}
      title="Batalkan kontrak?"
      description="Kontrak tetap tersimpan dalam histori dan tidak dianggap aktif."
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Kembali</Button>
          <Button type="primary" danger onClick={() => form.submit()}>
            Batalkan kontrak
          </Button>
        </>
      }
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item
          name="reason"
          label="Alasan pembatalan"
          rules={[
            { required: true, message: "Alasan pembatalan wajib diisi." },
            { min: 5, message: "Alasan minimal 5 karakter." },
          ]}
        >
          <Input.TextArea
            rows={3}
            maxLength={2000}
            showCount
            placeholder="Contoh: Kontrak tercatat dua kali atau periode salah diinput."
          />
        </Form.Item>
      </Form>
    </AppModal>
  );
}
