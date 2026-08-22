"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Checkbox, DatePicker, Form, Input, Select, Steps } from "antd";
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import dayjs from "dayjs";
import AppModal from "@/app/components/modals/AppModal";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import FontStyle from "@/app/components/font-style/FontStyle";
import OrganizationScopeField from "@/app/components/forms/OrganizationScopeField";
import PrivatePdfUpload from "@/app/components/forms/PrivatePdfUpload";
import PrivateFileUpload from "@/app/components/forms/PrivateFileUpload";
import IndonesiaPhoneInput from "@/app/components/forms/IndonesiaPhoneInput";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { getIndonesianMobileFormRules } from "@/lib/validation/indonesianPhone";

const required = (message) => [{ required: true, message }];
const dateValue = (value) => (value ? dayjs(value) : null);

/** Menyiapkan nilai awal konsisten untuk draft pegawai baru. */
function getCreateDefaults(organizationId) {
  return {
    organizationId,
    nationality: "Indonesia",
    employmentStatus: "active",
    contact: {},
    assignment: { assignmentType: "primary", changeType: "initial", effectiveFrom: dayjs() },
    contract: { status: "active", startDate: dayjs() },
  };
}

/** Mengembalikan tanggal draft ke dayjs agar kompatibel dengan DatePicker AntD. */
function hydrateDraft(payload, organizationId) {
  const defaults = getCreateDefaults(organizationId);
  return {
    ...defaults,
    ...payload,
    organizationId,
    birthDate: dateValue(payload.birthDate),
    joinedDate: dateValue(payload.joinedDate),
    contact: { ...defaults.contact, ...(payload.contact || {}) },
    contract: {
      ...defaults.contract,
      ...(payload.contract || {}),
      startDate: dateValue(payload.contract?.startDate) || dayjs(),
      endDate: dateValue(payload.contract?.endDate),
    },
    assignment: {
      ...defaults.assignment,
      ...(payload.assignment || {}),
      effectiveFrom: dateValue(payload.assignment?.effectiveFrom) || dayjs(),
    },
  };
}

/** Form pegawai menyatukan profil, kontrak awal, penempatan, dokumen, dan draft otomatis. */
export default function EmployeeForm({ open, item, organizationId, onClose, onSaved, onError }) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  const user = useAuthenticatedUser();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(null);
  const [draftStatus, setDraftStatus] = useState("loading");
  const [files, setFiles] = useState([]);
  const [domicileSameAsKtp, setDomicileSameAsKtp] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [references, setReferences] = useState({
    locations: [],
    organizationUnits: [],
    positions: [],
    employmentTypes: [],
    employees: [],
  });
  const saveQueueRef = useRef(Promise.resolve(true));
  const draftRef = useRef(null);
  const dirtyRef = useRef(false);
  const selectedOrganizationId = Form.useWatch("organizationId", form);
  const selectedLocationId = Form.useWatch(["assignment", "locationId"], form);
  const editing = Boolean(item);
  const targetOrganizationId = String(organizationId || user.organization_id || "");
  const contractFile = files.find((file) => file.category === "contract") || null;
  const assignmentFile = files.find((file) => file.category === "assignment_decree") || null;
  const profilePhotoFile = files.find((file) => file.category === "employee_photo") || null;
  const ktpFile = files.find((file) => file.category === "identity") || null;

  /** Menjaga ref version tetap sinkron untuk penyimpanan draft yang berjalan berurutan. */
  const rememberDraft = (value) => {
    draftRef.current = value;
    setDraft(value);
    setFiles(value?.files || []);
  };

  /** Memuat draft server atau membuat satu draft baru ketika workflow dibuka. */
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const controller = new AbortController();
      queueMicrotask(() => {
        setStep(0);
        setDraftStatus("saved");
        setFiles(
          item.profile_photo_file_id
            ? [
                {
                  id: item.profile_photo_file_id,
                  category: "employee_photo",
                  original_name: "Pas foto saat ini",
                  mime_type: "image/jpeg",
                  size_bytes: 0,
                },
              ]
            : [],
        );
      });
      form.resetFields();
      const sameAddress = Boolean(item.ktp_address && item.ktp_address === item.domicile_address);
      queueMicrotask(() => setDomicileSameAsKtp(sameAddress));
      form.setFieldsValue({
        organizationId: organizationId || user.organization_id || null,
        employeeNo: item.employee_no,
        fullName: item.full_name,
        preferredName: item.preferred_name,
        nationalId: item.national_id,
        birthPlace: item.birth_place,
        birthDate: dateValue(item.birth_date),
        gender: item.gender,
        religion: item.religion,
        maritalStatus: item.marital_status,
        bloodType: item.blood_type,
        nationality: item.nationality,
        joinedDate: dateValue(item.joined_date),
        employmentStatus: item.employment_status,
        contact: {
          personalEmail: item.personal_email,
          whatsapp: item.whatsapp,
          ktpAddress: item.ktp_address,
          domicileAddress: item.domicile_address,
          city: item.city,
          province: item.province,
        },
      });
      void (async () => {
        try {
          const response = await fetch(
            `/api/uploads?organizationId=${targetOrganizationId}&employeeId=${item.id}`,
            { signal: controller.signal },
          );
          const body = await response.json();
          if (!response.ok) throw new Error(body.message);
          setFiles(
            (body.data || []).filter(
              (file) =>
                file.category === "employee_photo" ||
                (file.category === "identity" && file.document_type === "ktp"),
            ),
          );
        } catch (error) {
          if (error.name !== "AbortError")
            onError(error.message || "Dokumen pegawai gagal dimuat.");
        }
      })();
      return () => controller.abort();
    }
    if (!targetOrganizationId) return;
    let active = true;
    queueMicrotask(() => active && setDraftStatus("loading"));
    (async () => {
      try {
        const query = `?organizationId=${targetOrganizationId}`;
        let response = await fetch(`/api/employees/drafts${query}`);
        let body = await response.json();
        if (!response.ok) throw new Error(body.message);
        if (!body.data) {
          response = await fetch("/api/employees/drafts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ organizationId: targetOrganizationId }),
          });
          body = await response.json();
          if (!response.ok) throw new Error(body.message);
        }
        if (!active) return;
        rememberDraft(body.data);
        setStep(body.data.currentStep || 0);
        form.resetFields();
        const hydrated = hydrateDraft(body.data.payload || {}, targetOrganizationId);
        form.setFieldsValue(hydrated);
        setDomicileSameAsKtp(
          Boolean(
            hydrated.contact.ktpAddress &&
            hydrated.contact.ktpAddress === hydrated.contact.domicileAddress,
          ),
        );
        dirtyRef.current = false;
        setDraftStatus("saved");
      } catch (error) {
        if (active) {
          setDraftStatus("error");
          onError(error.message || "Draft pegawai tidak dapat dimuat.");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [
    editing,
    form,
    item,
    onError,
    open,
    organizationId,
    targetOrganizationId,
    user.organization_id,
  ]);

  /** Referensi form dimuat bersama untuk mencegah waterfall request. */
  useEffect(() => {
    const target = selectedOrganizationId || organizationId || user.organization_id;
    if (!open || !target) return;
    let active = true;
    fetch(`/api/employees/reference-options?organizationId=${target}`)
      .then((response) => response.json())
      .then((body) => active && setReferences(body.data || {}))
      .catch(() => active && onError("Referensi form pegawai tidak dapat dimuat."));
    return () => {
      active = false;
    };
  }, [onError, open, organizationId, selectedOrganizationId, user.organization_id]);

  const availableUnits = useMemo(
    () =>
      (references.organizationUnits || []).filter(
        (unit) =>
          !selectedLocationId || (unit.location_ids || []).includes(String(selectedLocationId)),
      ),
    [references.organizationUnits, selectedLocationId],
  );

  /** Mengubah dayjs menjadi tanggal ISO sebelum draft disimpan atau data difinalisasi. */
  const serialize = (values) => {
    const formatDate = (value) => (value?.format ? value.format("YYYY-MM-DD") : value || null);
    const contact = { ...(values.contact || {}) };
    // Checkbox ini hanya state UI; payload selalu membawa nilai domisili final untuk database.
    if (domicileSameAsKtp) contact.domicileAddress = contact.ktpAddress || null;
    return {
      ...values,
      birthDate: formatDate(values.birthDate),
      joinedDate: formatDate(values.joinedDate),
      contact,
      ...(editing
        ? { version: item.updated_at }
        : {
            assignment: {
              ...values.assignment,
              effectiveFrom: formatDate(values.assignment?.effectiveFrom),
            },
            contract: {
              ...values.contract,
              startDate: formatDate(values.contract?.startDate),
              endDate: formatDate(values.contract?.endDate),
            },
          }),
    };
  };

  /** Menyimpan snapshot terbaru secara berurutan agar version draft tidak saling mendahului. */
  const saveDraftNow = (stepOverride = step) => {
    if (editing || !draftRef.current) return Promise.resolve(true);
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      const current = draftRef.current;
      if (!current) return false;
      setDraftStatus("saving");
      try {
        const values = serialize(form.getFieldsValue(true));
        delete values.organizationId;
        const response = await fetch(`/api/employees/drafts/${current.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: targetOrganizationId,
            currentStep: stepOverride,
            version: current.version,
            payload: values,
          }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Draft tidak dapat disimpan.");
        rememberDraft(body.data);
        dirtyRef.current = false;
        setDraftStatus("saved");
        return true;
      } catch (error) {
        setDraftStatus("error");
        onError(error.message);
        return false;
      }
    });
    return saveQueueRef.current;
  };

  /** Perubahan lokal hanya menandai draft; request dilakukan saat pengguna memilih aksi simpan. */
  const markDraftDirty = () => {
    if (editing || !draftRef.current) return;
    dirtyRef.current = true;
    setDraftStatus("dirty");
  };

  /** Browser memperingatkan pengguna hanya ketika perubahan belum aman di server. */
  useEffect(() => {
    const beforeUnload = (event) => {
      if (!dirtyRef.current && draftStatus !== "saving") return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [draftStatus]);

  /** Close menyimpan perubahan terakhir dan menahan modal bila penyimpanan gagal. */
  const requestClose = async () => {
    if (editing) return onClose();
    const saved = dirtyRef.current ? await saveDraftNow() : await saveQueueRef.current;
    if (saved !== false) onClose();
  };

  /** Navigasi step memvalidasi bagian aktif dan menyimpan posisi terakhir. */
  const nextStep = async () => {
    const fields =
      step === 0
        ? ["organizationId", "employeeNo", "fullName", "joinedDate", "employmentStatus"]
        : [
            ["contract", "employmentTypeId"],
            ["contract", "contractNo"],
            ["contract", "startDate"],
          ];
    try {
      await form.validateFields(fields);
    } catch {
      return;
    }
    if (step === 1 && !contractFile) {
      onError("Dokumen kontrak aktif wajib diunggah sebelum melanjutkan.");
      return;
    }
    const next = step + 1;
    const saved = await saveDraftNow(next);
    if (saved) setStep(next);
  };

  /** Mundur satu step tetap menyimpan posisi dan seluruh nilai terbaru ke draft server. */
  const previousStep = async () => {
    const previous = Math.max(0, step - 1);
    const saved = await saveDraftNow(previous);
    if (saved) setStep(previous);
  };

  /** Menyimpan edit lama atau memfinalisasi draft baru yang telah lengkap. */
  const submit = async (values) => {
    try {
      if (!editing && !assignmentFile) {
        onError("Dokumen SK penempatan wajib diunggah sebelum menyimpan pegawai.");
        return;
      }
      await runWithLoadingBackdrop(
        async () => {
          let response;
          if (editing) {
            response = await fetch(`/api/employees/${item.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(serialize(values)),
            });
          } else {
            const saved = await saveDraftNow(2);
            if (!saved) throw new Error("Draft belum berhasil disimpan.");
            response = await fetch(`/api/employees/drafts/${draftRef.current.id}/submit`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ organizationId: targetOrganizationId }),
            });
          }
          const body = await response.json();
          if (!response.ok) {
            if (body.fieldErrors) {
              form.setFields(
                Object.entries(body.fieldErrors).map(([name, error]) => ({
                  name: name.split("."),
                  errors: [error],
                })),
              );
              if (Object.keys(body.fieldErrors).some((name) => name.startsWith("contract.")))
                setStep(1);
              else if (Object.keys(body.fieldErrors).some((name) => name.startsWith("assignment.")))
                setStep(2);
              else setStep(0);
            }
            throw new Error(body.message || "Data pegawai tidak dapat disimpan.");
          }
          draftRef.current = null;
          dirtyRef.current = false;
          await onSaved(body.message);
        },
        {
          message: editing
            ? "Menyimpan data pegawai..."
            : "Memfinalisasi data dan dokumen pegawai...",
        },
      );
    } catch (error) {
      onError(error.message);
    }
  };

  /** Discard membuat draft kosong baru agar pengguna dapat langsung memulai ulang. */
  const discardDraft = async () => {
    setDiscardOpen(false);
    const current = draftRef.current;
    if (!current) return;
    try {
      await runWithLoadingBackdrop(
        async () => {
          const query = `?organizationId=${targetOrganizationId}`;
          let response = await fetch(`/api/employees/drafts/${current.id}${query}`, {
            method: "DELETE",
          });
          let body = await response.json();
          if (!response.ok) throw new Error(body.message);
          response = await fetch("/api/employees/drafts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ organizationId: targetOrganizationId }),
          });
          body = await response.json();
          if (!response.ok) throw new Error(body.message);
          rememberDraft(body.data);
          setStep(0);
          form.resetFields();
          form.setFieldsValue(getCreateDefaults(targetOrganizationId));
          setDomicileSameAsKtp(false);
          dirtyRef.current = false;
          setDraftStatus("saved");
        },
        { message: "Menyiapkan draft baru..." },
      );
    } catch (error) {
      onError(error.message);
    }
  };

  const gridSx = {
    gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" },
    gap: { xs: 0, sm: "0 16px" },
  };
  const draftTone = {
    saving: "info",
    saved: "success",
    error: "danger",
    dirty: "warning",
    loading: "neutral",
  };
  const draftPresentation = {
    saving: {
      title: "Menyimpan perubahan",
      description: "Mohon tunggu, isian terbaru sedang diamankan ke server.",
      icon: <LoadingOutlined spin />,
    },
    saved: {
      title: "Draft aman tersimpan",
      description: "Form dapat ditutup dan dilanjutkan kembali sebelum masa draft berakhir.",
      icon: <CheckCircleOutlined />,
    },
    error: {
      title: "Draft belum tersimpan",
      description: "Periksa koneksi lalu tekan kembali tombol penyimpanan draft.",
      icon: <ExclamationCircleOutlined />,
    },
    dirty: {
      title: "Perubahan belum disimpan",
      description: "Tekan Lanjut, Kembali, atau Simpan draft & tutup untuk menyimpan perubahan.",
      icon: <SaveOutlined />,
    },
    loading: {
      title: "Memuat draft",
      description: "SITOU sedang memulihkan isian terakhir Anda.",
      icon: <LoadingOutlined spin />,
    },
  };
  const draftVisual = theme.status[draftTone[draftStatus]];
  const draftInfo = draftPresentation[draftStatus];
  const query = `?organizationId=${targetOrganizationId}`;

  return (
    <>
      <AppModal
        open={open}
        title={editing ? "Edit data pegawai" : "Tambah data pegawai"}
        description="Lengkapi profil, kontrak, dokumen, dan penempatan dalam satu alur."
        size="xl"
        onClose={requestClose}
        disableClose={!editing && draftStatus === "loading"}
        footer={
          <>
            <Button onClick={step ? previousStep : requestClose}>
              {step ? "Kembali" : editing ? "Batal" : "Simpan draft & tutup"}
            </Button>
            {!editing && step < 2 ? (
              <Button
                type="primary"
                onClick={nextStep}
                disabled={!draft || draftStatus === "loading"}
              >
                Lanjut
              </Button>
            ) : (
              <Button
                type="primary"
                onClick={() => form.submit()}
                disabled={draftStatus === "saving"}
              >
                Simpan
              </Button>
            )}
          </>
        }
      >
        {!editing ? (
          <>
            <Box
              sx={{
                width: "100%",
                maxWidth: { xs: 300, sm: "none" },
                mx: "auto",
                mb: 2,
                px: { xs: 0.5, sm: 0 },
                "& .ant-steps-item": { minWidth: 0 },
                "& .ant-steps-item-container": { outline: "none" },
                "& .ant-steps-item-title": {
                  fontSize: { xs: "12px !important", sm: "14px !important" },
                  whiteSpace: "normal",
                  textAlign: "center",
                },
              }}
            >
              <Steps
                current={step}
                size="small"
                responsive={false}
                titlePlacement={mobile ? "vertical" : "horizontal"}
                items={[{ title: "Profil" }, { title: "Kontrak" }, { title: "Penempatan" }]}
              />
            </Box>
            <Box
              sx={{
                mb: 2.5,
                p: { xs: 1.5, sm: 2 },
                display: "flex",
                alignItems: { xs: "stretch", sm: "center" },
                flexDirection: { xs: "column", sm: "row" },
                gap: 1.5,
                border: `1px solid ${draftVisual.border}`,
                borderRadius: 2,
                bgcolor: draftVisual.background,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, flex: 1 }}>
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 40,
                    height: 40,
                    flex: "0 0 40px",
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "50%",
                    color: draftVisual.text,
                    bgcolor: theme.palette.background.paper,
                    fontSize: 20,
                  }}
                >
                  {draftInfo.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <FontStyle fontWeight={700} sx={{ color: draftVisual.text }}>
                    {draftInfo.title}
                  </FontStyle>
                  <FontStyle fontSize={12.5} sx={{ mt: 0.25, color: theme.ui.mutedText }}>
                    {draftInfo.description}
                  </FontStyle>
                  {draft?.updatedAt ? (
                    <FontStyle fontSize={12} sx={{ mt: 0.5, color: draftVisual.text }}>
                      Terakhir disimpan: {dayjs(draft.updatedAt).format("DD MMM YYYY, HH:mm")}
                    </FontStyle>
                  ) : null}
                </Box>
              </Box>
              <Button
                danger
                icon={<ReloadOutlined />}
                onClick={() => setDiscardOpen(true)}
                disabled={!draft || draftStatus === "saving"}
                style={{ minHeight: 44 }}
              >
                Buang draft & mulai ulang
              </Button>
            </Box>
            {draftStatus === "error" ? (
              <Alert
                type="error"
                showIcon
                title="Draft belum aman tersimpan"
                description="Periksa koneksi lalu tekan kembali tombol penyimpanan draft."
                style={{ marginBottom: 16 }}
              />
            ) : null}
          </>
        ) : null}
        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          onValuesChange={markDraftDirty}
          requiredMark
        >
          <Box sx={{ display: editing || step === 0 ? "block" : "none" }}>
            <Box sx={{ display: "grid", ...gridSx }}>
              <OrganizationScopeField disabled />
              <Form.Item
                name="employeeNo"
                label="Nomor pegawai"
                rules={required("Nomor pegawai wajib diisi.")}
              >
                <Input maxLength={60} />
              </Form.Item>
              <Form.Item
                name="fullName"
                label="Nama lengkap"
                rules={required("Nama lengkap wajib diisi.")}
              >
                <Input maxLength={200} />
              </Form.Item>
              <Form.Item name="preferredName" label="Nama panggilan">
                <Input maxLength={100} />
              </Form.Item>
              <Form.Item
                name="nationalId"
                label="NIK"
                rules={[{ pattern: /^\d{16}$/, message: "NIK harus terdiri dari tepat 16 digit." }]}
              >
                <Input maxLength={16} inputMode="numeric" />
              </Form.Item>
              <Box
                sx={{
                  gridColumn: "1 / -1",
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" },
                  gap: { xs: 2, sm: 2 },
                  mb: 2,
                }}
              >
                <Form.Item label="KTP (opsional)" style={{ marginBottom: 0 }}>
                  <PrivateFileUpload
                    value={ktpFile}
                    uploadUrl={
                      editing ? "/api/uploads" : `/api/employees/drafts/${draft?.id}/files`
                    }
                    removeUrl={
                      ktpFile
                        ? editing
                          ? `/api/uploads/${ktpFile.id}${query}`
                          : `/api/employees/drafts/${draft?.id}/files/${ktpFile.id}${query}`
                        : null
                    }
                    fields={
                      editing ? { fileKind: "ktp", employeeId: item.id } : { fileKind: "ktp" }
                    }
                    organizationId={targetOrganizationId}
                    accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                    maxSizeBytes={5 * 1024 * 1024}
                    emptyTitle="Pilih atau tarik KTP ke area ini"
                    helpText="Opsional. Gunakan JPEG, PNG, WebP, atau PDF maksimal 5 MB."
                    selectedText={
                      editing
                        ? "KTP aktif tersimpan secara privat"
                        : "KTP tersimpan pada draft privat"
                    }
                    onChange={(file) =>
                      setFiles((current) => [
                        ...current.filter((value) => value.category !== "identity"),
                        ...(file ? [file] : []),
                      ])
                    }
                    onError={onError}
                    disabled={!editing && !draft}
                  />
                </Form.Item>
                <Form.Item label="Pas foto (opsional)" style={{ marginBottom: 0 }}>
                  <PrivateFileUpload
                    value={profilePhotoFile}
                    uploadUrl={
                      editing ? "/api/uploads" : `/api/employees/drafts/${draft?.id}/files`
                    }
                    removeUrl={
                      profilePhotoFile
                        ? editing
                          ? `/api/uploads/${profilePhotoFile.id}${query}`
                          : `/api/employees/drafts/${draft?.id}/files/${profilePhotoFile.id}${query}`
                        : null
                    }
                    fields={
                      editing
                        ? { fileKind: "pas_foto", employeeId: item.id }
                        : { fileKind: "pas_foto" }
                    }
                    organizationId={targetOrganizationId}
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    maxSizeBytes={5 * 1024 * 1024}
                    emptyTitle="Pilih atau tarik pas foto ke area ini"
                    helpText="Opsional. Gunakan JPEG, PNG, atau WebP maksimal 5 MB."
                    selectedText={
                      editing
                        ? "Pas foto aktif tersimpan secara privat"
                        : "Pas foto tersimpan pada draft privat"
                    }
                    onChange={(file) =>
                      setFiles((current) => [
                        ...current.filter((value) => value.category !== "employee_photo"),
                        ...(file ? [file] : []),
                      ])
                    }
                    onError={onError}
                    disabled={!editing && !draft}
                  />
                </Form.Item>
              </Box>
              <Form.Item name="birthPlace" label="Tempat lahir">
                <Input maxLength={120} />
              </Form.Item>
              <Form.Item name="birthDate" label="Tanggal lahir">
                <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
              </Form.Item>
              <Form.Item
                name="joinedDate"
                label="Tanggal bergabung"
                rules={required("Tanggal bergabung wajib diisi.")}
              >
                <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
              </Form.Item>
              <Form.Item name="gender" label="Jenis kelamin">
                <Select
                  allowClear
                  options={[
                    { value: "male", label: "Laki-laki" },
                    { value: "female", label: "Perempuan" },
                    { value: "undisclosed", label: "Tidak disebutkan" },
                  ]}
                />
              </Form.Item>
              <Form.Item name="religion" label="Agama">
                <Input maxLength={50} />
              </Form.Item>
              <Form.Item name="maritalStatus" label="Status perkawinan">
                <Input maxLength={30} />
              </Form.Item>
              <Form.Item name="nationality" label="Kewarganegaraan">
                <Input maxLength={60} />
              </Form.Item>
              <Form.Item
                name="employmentStatus"
                label="Status pegawai"
                rules={required("Status pegawai wajib dipilih.")}
              >
                <Select
                  options={[
                    { value: "active", label: "Aktif" },
                    { value: "probation", label: "Masa percobaan" },
                    { value: "leave", label: "Cuti" },
                    { value: "suspended", label: "Ditangguhkan" },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name={["contact", "personalEmail"]}
                label="Email pribadi"
                rules={[{ type: "email", message: "Email tidak valid." }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name={["contact", "whatsapp"]}
                label="Nomor WhatsApp"
                rules={getIndonesianMobileFormRules()}
                extra="Masukkan nomor setelah +62 tanpa angka 0 di awal."
              >
                <IndonesiaPhoneInput aria-label="Nomor WhatsApp" />
              </Form.Item>
            </Box>
            <Form.Item name={["contact", "ktpAddress"]} label="Alamat sesuai KTP">
              <Input.TextArea
                rows={2}
                onChange={(event) => {
                  if (domicileSameAsKtp)
                    form.setFieldValue(["contact", "domicileAddress"], event.target.value);
                }}
              />
            </Form.Item>
            <Box sx={{ mt: -1, mb: 2 }}>
              <Checkbox
                checked={domicileSameAsKtp}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setDomicileSameAsKtp(checked);
                  if (checked)
                    form.setFieldValue(
                      ["contact", "domicileAddress"],
                      form.getFieldValue(["contact", "ktpAddress"]) || null,
                    );
                  markDraftDirty();
                }}
              >
                Alamat domisili sama dengan alamat KTP
              </Checkbox>
            </Box>
            <Form.Item name={["contact", "domicileAddress"]} label="Alamat domisili">
              <Input.TextArea
                rows={2}
                disabled={domicileSameAsKtp}
                placeholder={
                  domicileSameAsKtp
                    ? "Mengikuti alamat sesuai KTP"
                    : "Masukkan alamat tempat tinggal saat ini"
                }
              />
            </Form.Item>
          </Box>
          {!editing ? (
            <>
              <Box sx={{ ...gridSx, display: step === 1 ? "grid" : "none" }}>
                <Form.Item
                  name={["contract", "employmentTypeId"]}
                  label="Jenis kepegawaian"
                  rules={required("Jenis kepegawaian wajib dipilih.")}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={(references.employmentTypes || []).map((value) => ({
                      value: value.id,
                      label: `${value.code} - ${value.name}`,
                    }))}
                  />
                </Form.Item>
                <Form.Item
                  name={["contract", "contractNo"]}
                  label="Nomor kontrak"
                  rules={required("Nomor kontrak aktif wajib diisi.")}
                >
                  <Input maxLength={100} />
                </Form.Item>
                <Form.Item
                  name={["contract", "startDate"]}
                  label="Tanggal mulai"
                  rules={required("Tanggal mulai wajib diisi.")}
                >
                  <DatePicker style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item name={["contract", "endDate"]} label="Tanggal akhir">
                  <DatePicker style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item label="Dokumen kontrak" required>
                  <PrivatePdfUpload
                    value={contractFile}
                    uploadUrl={`/api/employees/drafts/${draft?.id}/files`}
                    removeUrl={
                      contractFile
                        ? `/api/employees/drafts/${draft?.id}/files/${contractFile.id}${query}`
                        : null
                    }
                    fields={{ fileKind: "kontrak" }}
                    organizationId={targetOrganizationId}
                    onChange={(file) =>
                      setFiles((current) => [
                        ...current.filter((value) => value.category !== "contract"),
                        ...(file ? [file] : []),
                      ])
                    }
                    onError={onError}
                    disabled={!draft}
                    helpText="Unggah kontrak yang telah ditandatangani dalam format PDF, maksimal 10 MB."
                  />
                </Form.Item>
                <Form.Item name={["contract", "notes"]} label="Catatan kontrak">
                  <Input.TextArea rows={3} maxLength={2000} showCount />
                </Form.Item>
              </Box>
              <Box sx={{ ...gridSx, display: step === 2 ? "grid" : "none" }}>
                <Form.Item
                  name={["assignment", "locationId"]}
                  label="Lokasi"
                  rules={required("Lokasi wajib dipilih.")}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={(references.locations || []).map((value) => ({
                      value: value.id,
                      label: `${value.code} - ${value.name}`,
                    }))}
                  />
                </Form.Item>
                <Form.Item
                  name={["assignment", "organizationUnitId"]}
                  label="Divisi & Unit"
                  rules={required("Divisi atau unit wajib dipilih.")}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={availableUnits.map((value) => ({
                      value: value.id,
                      label: value.name,
                    }))}
                  />
                </Form.Item>
                <Form.Item name={["assignment", "positionId"]} label="Jabatan">
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
                <Form.Item name={["assignment", "supervisorEmployeeId"]} label="Atasan langsung">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    options={(references.employees || []).map((value) => ({
                      value: value.id,
                      label: `${value.employee_no} - ${value.full_name}`,
                    }))}
                  />
                </Form.Item>
                <Form.Item
                  name={["assignment", "effectiveFrom"]}
                  label="Tanggal efektif"
                  rules={required("Tanggal efektif wajib diisi.")}
                >
                  <DatePicker style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item
                  name={["assignment", "decreeNo"]}
                  label="Nomor SK"
                  rules={required("Nomor SK wajib diisi.")}
                >
                  <Input maxLength={100} />
                </Form.Item>
                <Form.Item label="Dokumen SK penempatan" required>
                  <PrivatePdfUpload
                    value={assignmentFile}
                    uploadUrl={`/api/employees/drafts/${draft?.id}/files`}
                    removeUrl={
                      assignmentFile
                        ? `/api/employees/drafts/${draft?.id}/files/${assignmentFile.id}${query}`
                        : null
                    }
                    fields={{ fileKind: "sk_penempatan" }}
                    organizationId={targetOrganizationId}
                    onChange={(file) =>
                      setFiles((current) => [
                        ...current.filter((value) => value.category !== "assignment_decree"),
                        ...(file ? [file] : []),
                      ])
                    }
                    onError={onError}
                    disabled={!draft}
                    helpText="Unggah SK penempatan awal dalam format PDF, maksimal 10 MB."
                  />
                </Form.Item>
                <Form.Item name={["assignment", "notes"]} label="Catatan penempatan">
                  <Input.TextArea rows={3} maxLength={2000} showCount />
                </Form.Item>
              </Box>
            </>
          ) : null}
        </Form>
      </AppModal>
      <ConfirmDialog
        open={discardOpen}
        title="Mulai ulang data pegawai?"
        message="Seluruh isian dan dokumen pada draft ini akan dibuang. Tindakan ini tidak memengaruhi pegawai yang sudah tersimpan."
        confirmText="Buang draft"
        danger
        onConfirm={discardDraft}
        onClose={() => setDiscardOpen(false)}
      />
    </>
  );
}
