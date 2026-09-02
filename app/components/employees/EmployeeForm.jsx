"use client";

import { readApiResponse } from "@/lib/api/clientError";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import IndonesianNationalIdInput from "@/app/components/forms/IndonesianNationalIdInput";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { getIndonesianMobileFormRules } from "@/lib/validation/indonesianPhone";
import { getIndonesianNationalIdFormRules } from "@/lib/validation/indonesianNationalId";
import {
  BLOOD_TYPE_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  normalizeMaritalStatus,
} from "@/lib/employees/profileOptions";

const required = (message) => [{ required: true, message }];
const dateValue = (value) => (value ? dayjs(value) : null);
const WIZARD_FILE_BACKDROP_MESSAGES = Object.freeze({
  upload: "Mengunggah dokumen pegawai...",
  remove: "Menghapus dokumen pegawai...",
});

const FIELD_LABELS = {
  organizationId: "Organisasi",
  employeeNo: "NIP",
  fullName: "Nama lengkap",
  preferredName: "Nama panggilan",
  nationalId: "NIK",
  birthPlace: "Tempat lahir",
  birthDate: "Tanggal lahir",
  joinedDate: "Tanggal bergabung",
  gender: "Jenis kelamin",
  religion: "Agama",
  maritalStatus: "Status perkawinan",
  bloodType: "Golongan darah",
  nationality: "Kewarganegaraan",
  employmentStatus: "Status pegawai",
  "contact.personalEmail": "Email pribadi",
  "contact.whatsapp": "Nomor WhatsApp",
  "contact.ktpAddress": "Alamat sesuai KTP",
  "contact.domicileAddress": "Alamat domisili",
  "profile.educations.0.educationLevel": "Jenjang pendidikan",
  "profile.educations.0.institution": "Nama institusi pendidikan",
  "profile.educations.0.fieldOfStudy": "Program studi atau jurusan",
  "profile.educations.0.graduationYear": "Tahun kelulusan",
  "contract.employmentTypeId": "Jenis kepegawaian",
  "contract.contractNo": "Nomor kontrak",
  "contract.startDate": "Tanggal mulai kontrak",
  "contract.endDate": "Tanggal akhir kontrak",
  "assignment.locationId": "Lokasi",
  "assignment.organizationUnitId": "Divisi atau unit",
  "assignment.positionId": "Jabatan",
  "assignment.supervisorEmployeeId": "Atasan langsung",
  "assignment.effectiveFrom": "Tanggal efektif penempatan",
  "assignment.decreeNo": "Nomor SK",
};

/** Mengubah path dari API menjadi NamePath AntD dengan indeks array bertipe angka. */
function normalizeFieldPath(name) {
  const parts = Array.isArray(name) ? name : String(name).split(".");
  const formParts = parts[0] === "payload" ? parts.slice(1) : parts;
  return formParts.map((part) => (/^\d+$/.test(String(part)) ? Number(part) : part));
}

/** Menentukan langkah wizard yang memiliki field bermasalah. */
function getStepFromFieldPath(name) {
  const key = normalizeFieldPath(name).join(".");
  if (key.startsWith("profile.educations")) return 1;
  if (key.startsWith("contract.")) return 2;
  if (key.startsWith("assignment.")) return 3;
  return 0;
}

/** Menghasilkan label ramah pengguna untuk notifikasi validasi. */
function getFieldLabel(name) {
  const key = normalizeFieldPath(name).join(".");
  return FIELD_LABELS[key] || FIELD_LABELS[key.split(".").at(-1)] || "Field yang ditandai";
}

/** Menyusun pesan yang menyebut field pertama dan jumlah koreksi lain bila ada. */
function getValidationMessage(errorFields = []) {
  const first = errorFields[0];
  if (!first) return "Periksa field yang ditandai merah, lalu coba kembali.";
  const detail = first.errors?.[0] || "Nilai belum sesuai.";
  const remaining = errorFields.length - 1;
  return `Perbaiki ${getFieldLabel(first.name)}: ${detail}${
    remaining > 0 ? ` Masih ada ${remaining} field lain yang perlu diperiksa.` : ""
  }`;
}

/** Menyiapkan nilai awal konsisten untuk draft pegawai baru. */
function getCreateDefaults(organizationId) {
  return {
    organizationId,
    nationality: "Indonesia",
    employmentStatus: "active",
    contact: {},
    profile: {
      educations: [{ isHighest: true }],
    },
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
    maritalStatus: normalizeMaritalStatus(payload.maritalStatus),
    birthDate: dateValue(payload.birthDate),
    joinedDate: dateValue(payload.joinedDate),
    contact: { ...defaults.contact, ...(payload.contact || {}) },
    profile: {
      educations: (payload.profile?.educations?.length
        ? payload.profile.educations
        : defaults.profile.educations
      ).map((education) => ({
        ...education,
        graduationYear: education.graduationYear
          ? dayjs(String(education.graduationYear), "YYYY")
          : null,
        isHighest: true,
      })),
    },
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
  const onErrorRef = useRef(onError);
  const selectedOrganizationId = Form.useWatch("organizationId", form);
  const selectedLocationId = Form.useWatch(["assignment", "locationId"], form);
  const selectedEmploymentTypeId = Form.useWatch(["contract", "employmentTypeId"], form);
  const editing = Boolean(item);
  const targetOrganizationId = String(organizationId || user.organization_id || "");
  const contractFile = files.find((file) => file.category === "contract") || null;
  const assignmentFile = files.find((file) => file.category === "assignment_decree") || null;
  const profilePhotoFile = files.find((file) => file.category === "employee_photo") || null;
  const ktpFile = files.find((file) => file.category === "identity") || null;
  const educationFile = files.find((file) => file.category === "education") || null;

  /** Menjaga callback notifikasi terbaru tanpa memicu ulang efek inisialisasi form. */
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  /** Melaporkan error melalui callback stabil agar render Notification tidak mereset isian. */
  const reportError = useCallback((message) => {
    onErrorRef.current?.(message);
  }, []);

  /** Membuka langkah pemilik field, menggulir halus, lalu memindahkan fokus untuk koreksi. */
  const guideToField = useCallback(
    (name, targetStep = getStepFromFieldPath(name)) => {
      const fieldPath = normalizeFieldPath(name);
      setStep(targetStep);
      window.setTimeout(() => {
        form.scrollToField(fieldPath, { behavior: "smooth", block: "center" });
        window.setTimeout(() => {
          form.getFieldInstance(fieldPath)?.focus?.({ preventScroll: true });
        }, 350);
      }, 80);
    },
    [form],
  );

  /** Mengarahkan pengguna ke kontrol non-Form seperti dropzone dokumen wajib. */
  const guideToElement = useCallback((elementId) => {
    document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  /** Menampilkan detail validasi dan mengarahkan pengguna ke field pertama yang salah. */
  const handleValidationFailure = useCallback(
    (validationError) => {
      const errorFields = validationError?.errorFields || [];
      reportError(getValidationMessage(errorFields));
      if (errorFields[0]?.name) guideToField(errorFields[0].name);
    },
    [guideToField, reportError],
  );

  /** Menempelkan error API ke field form, membuka step terkait, dan memberi pesan yang dapat ditindaklanjuti. */
  const handleApiFieldErrors = useCallback(
    (fieldErrors) => {
      const entries = Object.entries(fieldErrors || {});
      if (!entries.length) return false;
      const normalizedEntries = entries.map(([name, error]) => [normalizeFieldPath(name), error]);
      form.setFields(
        normalizedEntries.map(([name, error]) => ({
          name,
          errors: [error],
        })),
      );
      const [firstName, firstError] = normalizedEntries[0];
      guideToField(firstName);
      const remaining = normalizedEntries.length - 1;
      reportError(
        `Perbaiki ${getFieldLabel(firstName)}: ${firstError}${
          remaining > 0 ? ` Masih ada ${remaining} field lain yang perlu diperiksa.` : ""
        }`,
      );
      return true;
    },
    [form, guideToField, reportError],
  );

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
        maritalStatus: normalizeMaritalStatus(item.marital_status),
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
      void runWithLoadingBackdrop(
        async () => {
          try {
            const response = await fetch(
              `/api/uploads?organizationId=${targetOrganizationId}&employeeId=${item.id}`,
              { signal: controller.signal },
            );
            const body = await readApiResponse(response);
            setFiles(
              (body.data || []).filter(
                (file) =>
                  file.category === "employee_photo" ||
                  (file.category === "identity" && file.document_type === "ktp"),
              ),
            );
          } catch (error) {
            if (error.name !== "AbortError")
              reportError(error.message || "Dokumen pegawai gagal dimuat.");
          }
        },
        { message: "Memuat dokumen pegawai..." },
      );
      return () => controller.abort();
    }
    if (!targetOrganizationId) return;
    let active = true;
    const controller = new AbortController();
    queueMicrotask(() => active && setDraftStatus("loading"));
    void runWithLoadingBackdrop(
      async () => {
        try {
          const query = `?organizationId=${targetOrganizationId}`;
          let response = await fetch(`/api/employees/drafts${query}`, {
            signal: controller.signal,
          });
          let body = await readApiResponse(response, "Draft pegawai tidak dapat dimuat.");
          if (!body.data) {
            response = await fetch("/api/employees/drafts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ organizationId: targetOrganizationId }),
              signal: controller.signal,
            });
            body = await readApiResponse(response, "Draft pegawai tidak dapat dibuat.");
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
          if (active && error.name !== "AbortError") {
            setDraftStatus("error");
            reportError(error.message || "Draft pegawai tidak dapat dimuat.");
          }
        }
      },
      { message: "Memuat draft pegawai..." },
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    editing,
    form,
    item,
    open,
    organizationId,
    reportError,
    targetOrganizationId,
    user.organization_id,
    runWithLoadingBackdrop,
  ]);

  /** Referensi form dimuat bersama untuk mencegah waterfall request. */
  useEffect(() => {
    const target = selectedOrganizationId || organizationId || user.organization_id;
    if (!open || !target) return;
    let active = true;
    const controller = new AbortController();
    void runWithLoadingBackdrop(
      async () => {
        try {
          const response = await fetch(
            `/api/employees/reference-options?organizationId=${target}`,
            { signal: controller.signal },
          );
          const body = await readApiResponse(
            response,
            "Referensi form pegawai tidak dapat dimuat.",
          );
          if (active) setReferences(body.data || {});
        } catch (error) {
          if (active && error.name !== "AbortError")
            reportError(error.message || "Referensi form pegawai tidak dapat dimuat.");
        }
      },
      { message: "Memuat referensi form pegawai..." },
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    open,
    organizationId,
    reportError,
    runWithLoadingBackdrop,
    selectedOrganizationId,
    user.organization_id,
  ]);

  const availableUnits = useMemo(
    () =>
      (references.organizationUnits || []).filter(
        (unit) =>
          !selectedLocationId || (unit.location_ids || []).includes(String(selectedLocationId)),
      ),
    [references.organizationUnits, selectedLocationId],
  );

  const selectedEmploymentType = useMemo(
    () =>
      (references.employmentTypes || []).find(
        (value) => String(value.id) === String(selectedEmploymentTypeId || ""),
      ) || null,
    [references.employmentTypes, selectedEmploymentTypeId],
  );
  const contractRequiresEndDate = Boolean(selectedEmploymentType?.requires_end_date);

  /** Mengubah dayjs menjadi tanggal ISO sebelum draft disimpan atau data difinalisasi. */
  const serialize = (values) => {
    const formatDate = (value) => (value?.format ? value.format("YYYY-MM-DD") : value || null);
    const contact = { ...(values.contact || {}) };
    // Checkbox ini hanya state UI; payload selalu membawa nilai domisili final untuk database.
    if (domicileSameAsKtp) contact.domicileAddress = contact.ktpAddress || null;
    return {
      ...values,
      maritalStatus: normalizeMaritalStatus(values.maritalStatus),
      birthDate: formatDate(values.birthDate),
      joinedDate: formatDate(values.joinedDate),
      contact,
      profile: {
        educations: (values.profile?.educations || []).map((education) => ({
          ...education,
          graduationYear: education.graduationYear?.year
            ? education.graduationYear.year()
            : education.graduationYear || null,
          isHighest: true,
        })),
      },
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
              endDate: contractRequiresEndDate ? formatDate(values.contract?.endDate) : null,
            },
          }),
    };
  };

  /** Menyimpan snapshot terbaru secara berurutan agar version draft tidak saling mendahului. */
  const saveDraftNow = (stepOverride = step) => {
    if (editing || !draftRef.current) return Promise.resolve(true);
    saveQueueRef.current = saveQueueRef.current.then(() =>
      runWithLoadingBackdrop(
        async () => {
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
            let body;
            try {
              body = await readApiResponse(response, "Draft tidak dapat disimpan.");
            } catch (error) {
              if (handleApiFieldErrors(error.fieldErrors)) {
                setDraftStatus("error");
                return false;
              }
              throw error;
            }
            rememberDraft(body.data);
            dirtyRef.current = false;
            setDraftStatus("saved");
            return true;
          } catch (error) {
            setDraftStatus("error");
            reportError(error.message);
            return false;
          }
        },
        { message: "Menyimpan draft pegawai..." },
      ),
    );
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
    const fieldsByStep = [
      [
        "organizationId",
        "employeeNo",
        "fullName",
        "nationalId",
        "joinedDate",
        "employmentStatus",
        ["contact", "personalEmail"],
        ["contact", "whatsapp"],
      ],
      [
        ["profile", "educations", 0, "educationLevel"],
        ["profile", "educations", 0, "institution"],
      ],
      [
        ["contract", "employmentTypeId"],
        ["contract", "startDate"],
        ...(contractRequiresEndDate ? [["contract", "endDate"]] : []),
      ],
    ];
    try {
      await form.validateFields(fieldsByStep[step] || []);
    } catch (validationError) {
      handleValidationFailure(validationError);
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
            const saved = await saveDraftNow(3);
            if (!saved) throw new Error("Draft belum berhasil disimpan.");
            response = await fetch(`/api/employees/drafts/${draftRef.current.id}/submit`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ organizationId: targetOrganizationId }),
            });
          }
          let body;
          try {
            body = await readApiResponse(response, "Data pegawai tidak dapat disimpan.");
          } catch (error) {
            if (handleApiFieldErrors(error.fieldErrors)) return;
            throw error;
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
      reportError(error.message);
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
          let body = await readApiResponse(response, "Draft tidak dapat dibuang.");
          response = await fetch("/api/employees/drafts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ organizationId: targetOrganizationId }),
          });
          body = await readApiResponse(response, "Draft baru tidak dapat dibuat.");
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
      reportError(error.message);
    }
  };

  const gridSx = {
    gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" },
    columnGap: { xs: 0, sm: 2 },
    rowGap: { xs: 0.75, sm: 1 },
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
        description="Lengkapi profil, pendidikan, kontrak, dokumen, dan penempatan dalam satu alur."
        size="xl"
        onClose={requestClose}
        disableClose={!editing && draftStatus === "loading"}
        footer={
          <>
            <Button onClick={step ? previousStep : requestClose}>
              {step ? "Kembali" : editing ? "Batal" : "Simpan draft & tutup"}
            </Button>
            {!editing && step < 3 ? (
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
                items={[
                  { title: "Profil" },
                  { title: "Pendidikan" },
                  { title: "Kontrak" },
                  { title: "Penempatan" },
                ]}
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
                description="Periksa field yang ditandai atau koneksi, lalu simpan draft kembali."
                style={{ marginBottom: 16 }}
              />
            ) : null}
          </>
        ) : null}
        <Box
          sx={{
            "& .employee-form .ant-form-item:not(.employee-upload-field)": {
              mb: "14px",
            },
            "& .employee-form .ant-form-item-additional": {
              minHeight: 22,
              pt: "4px",
            },
            "& .employee-form .ant-form-item-explain": {
              minHeight: 18,
              fontSize: 12,
              lineHeight: 1.45,
            },
            "& .employee-form .ant-form-item-explain-error": {
              overflowWrap: "anywhere",
            },
          }}
        >
          <Form
            className="employee-form"
            form={form}
            layout="vertical"
            onFinish={submit}
            onFinishFailed={handleValidationFailure}
            onValuesChange={markDraftDirty}
            requiredMark
          >
            <Box sx={{ display: editing || step === 0 ? "block" : "none" }}>
              <Box sx={{ display: "grid", ...gridSx }}>
                <OrganizationScopeField disabled />
                <Form.Item
                  name="employeeNo"
                  label="NIP (Nomor Induk Pegawai)"
                  rules={required("NIP wajib diisi.")}
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
                  rules={getIndonesianNationalIdFormRules({ required: true })}
                >
                  <IndonesianNationalIdInput />
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
                  <Form.Item
                    className="employee-upload-field"
                    label="KTP (opsional)"
                    style={{ marginBottom: 0 }}
                  >
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
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      maxSizeBytes={5 * 1024 * 1024}
                      emptyTitle="Pilih atau tarik KTP ke area ini"
                      helpText="Opsional. Gunakan JPEG, PNG, atau WebP maksimal 5 MB."
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
                      onError={reportError}
                      disabled={!editing && !draft}
                      backdropMessages={WIZARD_FILE_BACKDROP_MESSAGES}
                    />
                  </Form.Item>
                  <Form.Item
                    className="employee-upload-field"
                    label="Pas foto (opsional)"
                    style={{ marginBottom: 0 }}
                  >
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
                      onError={reportError}
                      disabled={!editing && !draft}
                      backdropMessages={WIZARD_FILE_BACKDROP_MESSAGES}
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
                  <Select
                    allowClear
                    placeholder="Pilih status perkawinan"
                    options={MARITAL_STATUS_OPTIONS}
                  />
                </Form.Item>
                <Form.Item name="bloodType" label="Golongan darah">
                  <Select
                    allowClear
                    placeholder="Pilih golongan darah"
                    options={BLOOD_TYPE_OPTIONS}
                  />
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
                    name={["profile", "educations", 0, "educationLevel"]}
                    label="Jenjang pendidikan"
                    rules={required("Jenjang pendidikan wajib dipilih.")}
                  >
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="Pilih jenjang pendidikan"
                      options={EDUCATION_LEVEL_OPTIONS}
                    />
                  </Form.Item>
                  <Form.Item
                    name={["profile", "educations", 0, "institution"]}
                    label="Nama institusi pendidikan"
                    rules={required("Nama institusi pendidikan wajib diisi.")}
                  >
                    <Input maxLength={200} placeholder="Contoh: Universitas Sam Ratulangi" />
                  </Form.Item>
                  <Form.Item
                    name={["profile", "educations", 0, "fieldOfStudy"]}
                    label="Program studi atau jurusan"
                  >
                    <Input maxLength={150} placeholder="Contoh: Teknik Informatika" />
                  </Form.Item>
                  <Form.Item
                    name={["profile", "educations", 0, "graduationYear"]}
                    label="Tahun kelulusan"
                  >
                    <DatePicker
                      picker="year"
                      format="YYYY"
                      placeholder="Pilih tahun kelulusan"
                      disabledDate={(current) => current && current.year() > dayjs().year()}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                  <Form.Item
                    className="employee-upload-field"
                    label="Foto ijazah (opsional)"
                    style={{ gridColumn: "1 / -1" }}
                  >
                    <PrivateFileUpload
                      value={educationFile}
                      uploadUrl={`/api/employees/drafts/${draft?.id}/files`}
                      removeUrl={
                        educationFile
                          ? `/api/employees/drafts/${draft?.id}/files/${educationFile.id}${query}`
                          : null
                      }
                      fields={{ fileKind: "pendidikan" }}
                      organizationId={targetOrganizationId}
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      maxSizeBytes={5 * 1024 * 1024}
                      emptyTitle="Pilih atau tarik foto ijazah ke area ini"
                      helpText="Gunakan JPEG, PNG, atau WebP maksimal 5 MB. Data dapat dilengkapi kembali melalui profil pegawai."
                      selectedText="Foto ijazah tersimpan pada draft privat"
                      onChange={(file) =>
                        setFiles((current) => [
                          ...current.filter((value) => value.category !== "education"),
                          ...(file ? [file] : []),
                        ])
                      }
                      onError={reportError}
                      disabled={!draft}
                      backdropMessages={WIZARD_FILE_BACKDROP_MESSAGES}
                    />
                  </Form.Item>
                </Box>
                <Box sx={{ ...gridSx, display: step === 2 ? "grid" : "none" }}>
                  <Form.Item
                    name={["contract", "employmentTypeId"]}
                    label="Jenis kepegawaian"
                    rules={required("Jenis kepegawaian wajib dipilih.")}
                  >
                    <Select
                      showSearch
                      optionFilterProp="label"
                      onChange={(value) => {
                        const employmentType = (references.employmentTypes || []).find(
                          (option) => String(option.id) === String(value),
                        );
                        if (!employmentType?.requires_end_date)
                          form.setFieldValue(["contract", "endDate"], null);
                      }}
                      options={(references.employmentTypes || []).map((value) => ({
                        value: value.id,
                        label: value.name,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name={["contract", "contractNo"]} label="Nomor kontrak (opsional)">
                    <Input maxLength={100} />
                  </Form.Item>
                  <Form.Item
                    name={["contract", "startDate"]}
                    label="Tanggal mulai"
                    rules={required("Tanggal mulai wajib diisi.")}
                  >
                    <DatePicker style={{ width: "100%" }} />
                  </Form.Item>
                  {contractRequiresEndDate ? (
                    <Form.Item
                      name={["contract", "endDate"]}
                      label="Tanggal akhir"
                      rules={required("Tanggal akhir wajib diisi untuk jenis kepegawaian ini.")}
                    >
                      <DatePicker style={{ width: "100%" }} />
                    </Form.Item>
                  ) : null}
                  <Box id="employee-contract-document">
                    <Form.Item className="employee-upload-field" label="Dokumen kontrak (opsional)">
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
                        onError={reportError}
                        disabled={!draft}
                        helpText="Opsional. Gunakan dokumen PDF maksimal 10 MB."
                        backdropMessages={WIZARD_FILE_BACKDROP_MESSAGES}
                      />
                    </Form.Item>
                  </Box>
                </Box>
                <Box sx={{ ...gridSx, display: step === 3 ? "grid" : "none" }}>
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
                        label: value.name,
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
                  <Form.Item name={["assignment", "decreeNo"]} label="Nomor SK (opsional)">
                    <Input maxLength={100} />
                  </Form.Item>
                  <Box id="employee-assignment-document">
                    <Form.Item
                      className="employee-upload-field"
                      label="Dokumen SK penempatan (opsional)"
                    >
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
                        onError={reportError}
                        disabled={!draft}
                        helpText="Opsional. Gunakan dokumen PDF maksimal 10 MB."
                        backdropMessages={WIZARD_FILE_BACKDROP_MESSAGES}
                      />
                    </Form.Item>
                  </Box>
                </Box>
              </>
            ) : null}
          </Form>
        </Box>
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
