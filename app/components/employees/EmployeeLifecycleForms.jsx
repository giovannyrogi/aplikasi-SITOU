"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, DatePicker, Form, Input, Select } from "antd";
import { Box } from "@mui/material";
import dayjs from "dayjs";
import AppModal from "@/app/components/modals/AppModal";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import PrivatePdfUpload from "@/app/components/forms/PrivatePdfUpload";

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

/** Modal rolling membuat record baru dan tidak mengedit penempatan historis. */
export function AssignmentForm({ open, employee, onClose, onSaved, onError }) {
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const references = useEmployeeReferences(open, employee?.organization_id, onError);
  const locationId = Form.useWatch("locationId", form);
  const [documentFile, setDocumentFile] = useState(null);
  const minimumEffectiveDate = useMemo(
    () => resolveNextLifecycleDate(employee?.assignment_effective_from),
    [employee?.assignment_effective_from],
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
      queueMicrotask(() => setDocumentFile(null));
      form.resetFields();
      form.setFieldsValue({
        organizationId: employee.organization_id,
        assignmentType: "primary",
        changeType: "rotation",
        effectiveFrom: minimumEffectiveDate,
      });
    }
  }, [employee, form, minimumEffectiveDate, open]);

  /** Mengirim tanggal efektif ISO; service menutup assignment lama satu hari sebelumnya. */
  const submit = async (values) => {
    if (!documentFile) {
      onError("Dokumen SK penempatan wajib diunggah sebelum data disimpan.");
      return;
    }
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(`/api/employees/${employee.id}/assignments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...values,
              effectiveFrom: values.effectiveFrom.format("YYYY-MM-DD"),
              documentFileId: documentFile?.id || null,
            }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.message);
          await onSaved(body.message);
        },
        { message: "Menyimpan penempatan baru..." },
      );
    } catch (error) {
      onError(error.message);
    }
  };

  return (
    <AppModal
      open={open}
      title="Penempatan atau mutasi"
      description="Penempatan aktif lama akan ditutup tanpa menghapus histori."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="primary" onClick={() => form.submit()}>
            Simpan penempatan
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
          <Form.Item name="locationId" label="Lokasi baru" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={(references.locations || []).map((value) => ({
                value: value.id,
                label: `${value.code} - ${value.name}`,
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
                { value: "rotation", label: "Rolling" },
                { value: "transfer", label: "Mutasi" },
                { value: "promotion", label: "Promosi" },
                { value: "demotion", label: "Demosi" },
                { value: "acting", label: "Pelaksana tugas" },
                { value: "correction", label: "Koreksi" },
              ]}
            />
          </Form.Item>
          <Form.Item name="effectiveFrom" label="Tanggal efektif" rules={[{ required: true }]}>
            <DatePicker
              style={{ width: "100%" }}
              disabledDate={(current) => current.isBefore(minimumEffectiveDate, "day")}
            />
          </Form.Item>
          <Form.Item name="decreeNo" label="Nomor SK" rules={[{ required: true }]}>
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
        <Form.Item label="Dokumen SK" required>
          <PrivatePdfUpload
            value={documentFile}
            uploadUrl="/api/uploads"
            removeUrl={
              documentFile
                ? `/api/uploads/${documentFile.id}?organizationId=${employee.organization_id}`
                : null
            }
            fields={{ fileKind: "sk_penempatan", employeeId: employee.id }}
            organizationId={employee.organization_id}
            onChange={setDocumentFile}
            onError={onError}
            helpText="SK penempatan, rolling, mutasi, promosi, atau demosi dalam format PDF maksimal 10 MB."
          />
        </Form.Item>
        <Form.Item name="notes" label="Catatan">
          <Input.TextArea rows={3} maxLength={2000} showCount />
        </Form.Item>
      </Form>
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
    if (!documentFile) {
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
            ...(contract ? { version: contract.updated_at } : {}),
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
          const body = await response.json();
          if (!response.ok) throw new Error(body.message);
          await onSaved(body.message);
        },
        { message: contract ? "Menyimpan koreksi kontrak..." : "Menyimpan kontrak baru..." },
      );
    } catch (error) {
      onError(error.message);
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
              label: `${value.code} - ${value.name}`,
            }))}
          />
        </Form.Item>
        <Form.Item name="contractNo" label="Nomor kontrak" rules={[{ required: true }]}>
          <Input maxLength={100} />
        </Form.Item>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: { sm: "0 16px" },
          }}
        >
          <Form.Item name="startDate" label="Tanggal mulai" rules={[{ required: true }]}>
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
        <Form.Item label="Dokumen kontrak" required>
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
            helpText="Kontrak yang telah ditandatangani dalam format PDF maksimal 10 MB."
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
              version: contract.updated_at,
              reason: values.reason,
            }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.message);
          await onSaved(body.message);
        },
        { message: "Membatalkan kontrak..." },
      );
    } catch (error) {
      onError(error.message);
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
