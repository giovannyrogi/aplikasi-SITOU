"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Checkbox, Collapse, DatePicker, Form, Input, Select } from "antd";
import { DeleteOutlined, PlusOutlined, WarningOutlined } from "@ant-design/icons";
import { Box } from "@mui/material";
import dayjs from "dayjs";
import AppModal from "@/app/components/modals/AppModal";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import FontStyle from "@/app/components/font-style/FontStyle";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import IndonesiaPhoneInput from "@/app/components/forms/IndonesiaPhoneInput";
import IndonesianNationalIdInput from "@/app/components/forms/IndonesianNationalIdInput";
import PrivateFileUpload from "@/app/components/forms/PrivateFileUpload";
import { getIndonesianMobileFormRules } from "@/lib/validation/indonesianPhone";
import { getIndonesianNationalIdFormRules } from "@/lib/validation/indonesianNationalId";
import { EDUCATION_LEVEL_OPTIONS } from "@/lib/employees/profileOptions";

/** Mengubah tanggal API menjadi nilai Day.js yang diterima DatePicker AntD. */
function toDatePickerValue(value) {
  if (!value) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
}

/** Mengubah nilai DatePicker kembali menjadi tanggal kalender ISO untuk API. */
function toIsoDate(value) {
  if (!value) return null;
  if (typeof value?.format === "function") return value.format("YYYY-MM-DD");
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
}

/** Mengubah tahun numerik API menjadi nilai Day.js untuk DatePicker mode tahun. */
function toYearPickerValue(value) {
  if (!value) return null;
  const parsed = dayjs(String(value), "YYYY", true);
  return parsed.isValid() ? parsed : null;
}

/** Mengubah pilihan tahun menjadi angka yang disimpan oleh kontrak API pendidikan. */
function toYearNumber(value) {
  if (!value) return null;
  if (typeof value?.year === "function") return value.year();
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

/** Menyatukan metadata file dari respons upload dan join database untuk komponen upload. */
function normalizeStoredFile(file, fallback = {}) {
  const source = file || {};
  const id = source.id ?? fallback.id;
  if (!id) return null;
  const name =
    source.name ?? source.original_name ?? source.originalName ?? fallback.name ?? "File tersimpan";
  const mimeType = source.type ?? source.mime_type ?? source.mimeType ?? fallback.mimeType ?? "";
  const size = source.size ?? source.size_bytes ?? source.sizeBytes ?? fallback.size ?? null;

  return {
    ...source,
    id: String(id),
    name,
    original_name: name,
    type: mimeType,
    mime_type: mimeType,
    size,
    size_bytes: size,
  };
}

/** Mengubah kontrak snake_case API ke field camelCase yang digunakan form. */
function normalizeProfile(profile) {
  const map = (items, mapping) =>
    (Array.isArray(items) ? items : []).map((item) =>
      Object.fromEntries(
        Object.entries(mapping).map(([target, source]) => [target, item[source] ?? item[target]]),
      ),
    );
  const mapFiles = (items, mapping, fileField, fileIdField, fileMetadata) =>
    (Array.isArray(items) ? items : []).map((item) => {
      const normalized = Object.fromEntries(
        Object.entries(mapping).map(([target, source]) => [target, item[source] ?? item[target]]),
      );
      const storedFile = normalizeStoredFile(item[fileMetadata.object] ?? item[fileField], {
        id: normalized[fileIdField],
        name: item[fileMetadata.name],
        mimeType: item[fileMetadata.mimeType],
        size: item[fileMetadata.size],
      });
      return {
        ...normalized,
        [fileIdField]: storedFile?.id ?? normalized[fileIdField] ?? null,
        [fileField]: storedFile,
      };
    });
  return {
    identifiers: mapFiles(
      profile.identifiers,
      {
        identifierType: "identifier_type",
        identifierLabel: "identifier_label",
        identifierValue: "identifier_value",
        issuedAt: "issued_at",
        expiresAt: "expires_at",
        isVerified: "is_verified",
        documentFileId: "document_file_id",
      },
      "documentFile",
      "documentFileId",
      {
        object: "document_file",
        name: "document_name",
        mimeType: "document_mime_type",
        size: "document_size_bytes",
      },
    ).map((item) => ({
      ...item,
      issuedAt: toDatePickerValue(item.issuedAt),
      expiresAt: toDatePickerValue(item.expiresAt),
    })),
    bankAccounts: map(profile.bankAccounts, {
      bankName: "bank_name",
      accountNumber: "account_number",
      accountHolder: "account_holder",
      isPrimary: "is_primary",
    }),
    dependents: map(profile.dependents, {
      relationship: "relationship",
      fullName: "full_name",
      birthDate: "birth_date",
      nationalId: "national_id",
      phone: "phone",
      isDependent: "is_dependent",
      isEmergencyContact: "is_emergency_contact",
      notes: "notes",
    }).map((item) => ({ ...item, birthDate: toDatePickerValue(item.birthDate) })),
    emergencyContacts: map(profile.emergencyContacts, {
      fullName: "full_name",
      relationship: "relationship",
      phone: "phone",
      address: "address",
      isPrimary: "is_primary",
    }),
    socialAccounts: map(profile.socialAccounts, {
      platform: "platform",
      handleOrUrl: "handle_or_url",
    }),
    educations: mapFiles(
      profile.educations,
      {
        educationLevel: "education_level",
        institution: "institution",
        fieldOfStudy: "field_of_study",
        graduationYear: "graduation_year",
        isHighest: "is_highest",
        certificateFileId: "certificate_file_id",
      },
      "certificateFile",
      "certificateFileId",
      {
        object: "certificate_file",
        name: "certificate_name",
        mimeType: "certificate_mime_type",
        size: "certificate_size_bytes",
      },
    ).map((item) => ({
      ...item,
      graduationYear: toYearPickerValue(item.graduationYear),
    })),
    skills: map(profile.skills, {
      skillName: "skill_name",
      proficiencyLevel: "proficiency_level",
      notes: "notes",
    }),
    certifications: mapFiles(
      profile.certifications,
      {
        certificationName: "certification_name",
        issuer: "issuer",
        credentialNo: "credential_no",
        issuedAt: "issued_at",
        expiresAt: "expires_at",
        certificateFileId: "certificate_file_id",
      },
      "certificateFile",
      "certificateFileId",
      {
        object: "certificate_file",
        name: "certificate_name",
        mimeType: "certificate_mime_type",
        size: "certificate_size_bytes",
      },
    ).map((item) => ({
      ...item,
      issuedAt: toDatePickerValue(item.issuedAt),
      expiresAt: toDatePickerValue(item.expiresAt),
    })),
  };
}

/** Menjaga section Collapse yang belum pernah dibuka tetap dikirim sebagai array kosong. */
function normalizeProfileSubmission(profile) {
  const source = profile || {};
  const array = (value) => (Array.isArray(value) ? value : []);
  return {
    identifiers: array(source.identifiers).map((item) => ({
      ...item,
      issuedAt: toIsoDate(item.issuedAt),
      expiresAt: toIsoDate(item.expiresAt),
    })),
    bankAccounts: array(source.bankAccounts),
    dependents: array(source.dependents).map((item) => ({
      ...item,
      birthDate: toIsoDate(item.birthDate),
    })),
    emergencyContacts: array(source.emergencyContacts),
    socialAccounts: array(source.socialAccounts),
    educations: array(source.educations).map((item) => ({
      ...item,
      graduationYear: toYearNumber(item.graduationYear),
    })),
    skills: array(source.skills),
    certifications: array(source.certifications).map((item) => ({
      ...item,
      issuedAt: toIsoDate(item.issuedAt),
      expiresAt: toIsoDate(item.expiresAt),
    })),
  };
}

const IDENTITY_CONFIG = {
  pas_foto: { label: "Pas foto", fileKind: "pas_foto" },
  ktp: { label: "KTP", numberLabel: "NIK", fileKind: "ktp" },
  family_card: { label: "Kartu Keluarga", numberLabel: "Nomor KK", fileKind: "kk" },
  bpjs_health: {
    label: "BPJS Kesehatan",
    numberLabel: "Nomor peserta",
    fileKind: "bpjs_kesehatan",
  },
  bpjs_employment: {
    label: "BPJS Ketenagakerjaan",
    numberLabel: "Nomor kepesertaan",
    fileKind: "bpjs_ketenagakerjaan",
  },
  tax_npwp: { label: "NPWP", numberLabel: "Nomor NPWP", fileKind: "npwp" },
  other: { label: "Identitas lainnya", numberLabel: "Nomor identitas", fileKind: "identitas_lain" },
};

const IDENTITY_OPTIONS = [
  { value: "pas_foto", label: "Pas foto" },
  { value: "ktp", label: "KTP" },
  { value: "family_card", label: "Kartu Keluarga" },
  { value: "bpjs_health", label: "BPJS Kesehatan" },
  { value: "bpjs_employment", label: "BPJS Ketenagakerjaan" },
  { value: "tax_npwp", label: "NPWP" },
  { value: "other", label: "Lainnya" },
];

const SOCIAL_PLATFORM_OPTIONS = [
  "Facebook",
  "Instagram",
  "TikTok",
  "LinkedIn",
  "X",
  "YouTube",
  "Telegram",
  "WhatsApp",
  "Threads",
].map((platform) => ({ value: platform, label: platform }));

/** Menyamakan pilihan kategorikal agar pemeriksaan duplikat tidak peka kapitalisasi. */
function normalizeUniqueChoice(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("id-ID");
}

/** Mengembalikan pilihan pertama yang belum digunakan pada baris berulang. */
function getFirstAvailableChoice(options, rows, valueKey) {
  const usedValues = new Set(
    (rows || []).map((item) => normalizeUniqueChoice(item?.[valueKey])).filter(Boolean),
  );
  return (
    options.find((option) => !usedValues.has(normalizeUniqueChoice(option.value)))?.value || null
  );
}

/** Dropdown unik mempertahankan pilihan baris sendiri dan mengunci pilihan milik baris lain. */
function UniqueListSelect({ form, listName, fieldIndex, valueKey, options, ...props }) {
  const rows = Form.useWatch(listName, form) || [];
  const currentValue = normalizeUniqueChoice(rows[fieldIndex]?.[valueKey]);
  const usedByOtherRows = new Set(
    rows
      .filter((_, index) => index !== fieldIndex)
      .map((item) => normalizeUniqueChoice(item?.[valueKey]))
      .filter(Boolean),
  );
  const resolvedOptions = options.map((option) => ({
    ...option,
    disabled:
      normalizeUniqueChoice(option.value) !== currentValue &&
      usedByOtherRows.has(normalizeUniqueChoice(option.value)),
  }));

  return <Select {...props} options={resolvedOptions} />;
}

/** Validator form mencegah nilai ganda walaupun state diubah tanpa melalui dropdown. */
function uniqueListChoiceRule(form, listName, valueKey, label) {
  return {
    validator: async (_, value) => {
      if (!value) return;
      const normalizedValue = normalizeUniqueChoice(value);
      const duplicates = (form.getFieldValue(listName) || []).filter(
        (item) => normalizeUniqueChoice(item?.[valueKey]) === normalizedValue,
      );
      if (duplicates.length > 1) throw new Error(`${label} sudah digunakan pada data lain.`);
    },
  };
}

const PROFICIENCY_OPTIONS = [
  { value: "pemula", label: "Pemula" },
  { value: "dasar", label: "Dasar" },
  { value: "menengah", label: "Menengah" },
  { value: "mahir", label: "Mahir" },
  { value: "ahli", label: "Ahli" },
];

const PROFILE_SECTION_BY_FIELD = {
  identifiers: "identifiers",
  bankAccounts: "banks",
  dependents: "family",
  emergencyContacts: "emergency",
  educations: "education",
  skills: "skills",
  certifications: "certifications",
  socialAccounts: "social",
};

/** Memetakan field AntD yang gagal ke panel profil agar panel dapat dibuka otomatis. */
function resolveErrorSections(errorFields = []) {
  return [
    ...new Set(
      errorFields.map((field) => PROFILE_SECTION_BY_FIELD[field?.name?.[0]]).filter(Boolean),
    ),
  ];
}

/** Mengunggah file sesuai jenis yang dipilih tanpa membuka akses path penyimpanan privat. */
function IdentityDocumentField({
  field,
  form,
  employee,
  organizationId,
  onError,
  onRemoveRequest,
}) {
  const type = Form.useWatch(["identifiers", field.name, "identifierType"], form) || "other";
  const file = Form.useWatch(["identifiers", field.name, "documentFile"], {
    form,
    preserve: true,
  });
  const fileId = Form.useWatch(["identifiers", field.name, "documentFileId"], form);
  const config = IDENTITY_CONFIG[type] || IDENTITY_CONFIG.other;
  const isProfilePhoto = type === "pas_foto";
  const setFile = (nextFile) => {
    form.setFieldValue(["identifiers", field.name, "documentFile"], nextFile);
    form.setFieldValue(["identifiers", field.name, "documentFileId"], nextFile?.id || null);
  };
  return (
    <PrivateFileUpload
      value={file}
      fileId={fileId}
      deferred
      removeUrl={
        file?.id || fileId
          ? `/api/uploads/${file?.id || fileId}?organizationId=${organizationId}`
          : undefined
      }
      fields={{ fileKind: config.fileKind, employeeId: employee.id }}
      organizationId={organizationId}
      onChange={setFile}
      onError={onError}
      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
      maxSizeBytes={5 * 1024 * 1024}
      emptyTitle={
        isProfilePhoto
          ? "Pilih atau tarik pas foto ke area ini"
          : `Pilih atau tarik gambar ${config.label}`
      }
      helpText={
        isProfilePhoto
          ? "Opsional. Gunakan JPEG, PNG, atau WebP maksimal 5 MB."
          : "Gunakan JPEG, PNG, atau WebP yang jelas maksimal 5 MB."
      }
      selectedText={isProfilePhoto ? "Pas foto tersimpan secara privat" : undefined}
      onRemoveRequest={({ fileId: selectedFileId }) =>
        onRemoveRequest({
          fileId: selectedFileId,
          label: config.label,
          apply: () => setFile(null),
        })
      }
    />
  );
}

/** Field nomor dan periode menyesuaikan jenis identitas yang dipilih pengguna. */
function IdentityMetadataFields({ field, form }) {
  const type = Form.useWatch(["identifiers", field.name, "identifierType"], form) || "other";
  const config = IDENTITY_CONFIG[type] || IDENTITY_CONFIG.other;
  if (type === "pas_foto") return null;
  const hasValidityPeriod = !["ktp", "family_card"].includes(type);
  return (
    <>
      <Form.Item
        name={[field.name, "identifierValue"]}
        label={config.numberLabel}
        rules={
          type === "ktp"
            ? getIndonesianNationalIdFormRules({ required: true })
            : [{ required: true, message: `${config.numberLabel} wajib diisi.` }]
        }
      >
        {type === "ktp" ? <IndonesianNationalIdInput /> : <Input maxLength={100} />}
      </Form.Item>
      {hasValidityPeriod ? (
        <>
          <Form.Item name={[field.name, "issuedAt"]} label="Tanggal terbit">
            <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
          </Form.Item>
          <Form.Item name={[field.name, "expiresAt"]} label="Tanggal berakhir">
            <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
          </Form.Item>
        </>
      ) : null}
    </>
  );
}

/** Membersihkan metadata jenis lama agar nomor atau file tidak terbawa ke identitas baru. */
function resetIdentityFields(form, index, identifierType) {
  const prefix = ["identifiers", index];
  form.setFields([
    { name: [...prefix, "identifierType"], value: identifierType },
    { name: [...prefix, "identifierLabel"], value: null },
    { name: [...prefix, "identifierValue"], value: null },
    { name: [...prefix, "issuedAt"], value: null },
    { name: [...prefix, "expiresAt"], value: null },
    { name: [...prefix, "isVerified"], value: false },
    { name: [...prefix, "documentFileId"], value: null },
    { name: [...prefix, "documentFile"], value: null },
  ]);
}

/** Menghubungkan foto ijazah atau sertifikat ke record profil yang sedang diedit. */
function CredentialImageField({
  listName,
  field,
  form,
  employee,
  organizationId,
  onError,
  onRemoveRequest,
}) {
  const file = Form.useWatch([listName, field.name, "certificateFile"], {
    form,
    preserve: true,
  });
  const fileId = Form.useWatch([listName, field.name, "certificateFileId"], form);
  const fileKind = listName === "educations" ? "pendidikan" : "sertifikasi";
  const setFile = (nextFile) => {
    form.setFieldValue([listName, field.name, "certificateFile"], nextFile);
    form.setFieldValue([listName, field.name, "certificateFileId"], nextFile?.id || null);
  };
  return (
    <PrivateFileUpload
      value={file}
      fileId={fileId}
      deferred
      removeUrl={
        file?.id || fileId
          ? `/api/uploads/${file?.id || fileId}?organizationId=${organizationId}`
          : undefined
      }
      fields={{ fileKind, employeeId: employee.id }}
      organizationId={organizationId}
      onChange={setFile}
      onError={onError}
      accept="image/jpeg,image/png,image/webp"
      maxSizeBytes={5 * 1024 * 1024}
      emptyTitle={`Pilih atau tarik foto ${listName === "educations" ? "ijazah" : "sertifikat"} ke area ini`}
      helpText="Gunakan JPEG, PNG, atau WebP maksimal 5 MB."
      selectedText="Gambar tersimpan secara privat"
      onRemoveRequest={({ fileId: selectedFileId }) =>
        onRemoveRequest({
          fileId: selectedFileId,
          label: listName === "educations" ? "foto ijazah" : "foto sertifikat",
          apply: () => setFile(null),
        })
      }
    />
  );
}

/** Wrapper daftar memberi pola tambah/hapus konsisten untuk setiap section profil. */
function ListSection({ name, addLabel, initialValue, children, onRemoveItem, onAddUnavailable }) {
  return (
    <Form.List name={name}>
      {(fields, { add, remove }) => (
        <Box sx={{ display: "grid", gap: 1.5 }}>
          {fields.map((field, index) => (
            <Box
              key={field.key}
              sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 1.5,
                }}
              >
                <FontStyle fontSize={12} fontWeight={700}>
                  Data {index + 1}
                </FontStyle>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={`Hapus ${addLabel} ${index + 1}`}
                  onClick={() => onRemoveItem(field.name, remove)}
                />
              </Box>
              {children(field)}
            </Box>
          ))}
          <Button
            icon={<PlusOutlined />}
            onClick={() => {
              const nextValue = typeof initialValue === "function" ? initialValue() : initialValue;
              if (nextValue === null) {
                onAddUnavailable?.();
                return;
              }
              add(nextValue);
            }}
          >
            {addLabel}
          </Button>
        </Box>
      )}
    </Form.List>
  );
}

/** Editor seluruh data administratif sensitif memakai satu endpoint dan satu transaksi. */
export default function EmployeeProfileSectionsForm({
  open,
  employee,
  organizationId,
  onClose,
  onSaved,
  onError,
}) {
  const [form] = Form.useForm();
  const [activeSections, setActiveSections] = useState([]);
  const [errorSections, setErrorSections] = useState([]);
  const [removedFileIds, setRemovedFileIds] = useState([]);
  const [removalConfirmation, setRemovalConfirmation] = useState(null);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const onErrorRef = useRef(onError);
  const loadedProfileRef = useRef(null);

  /** Callback terbaru disimpan tanpa menjadikannya dependency request profil. */
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  /** Memuat satu snapshot profil per pembukaan modal tanpa restart akibat render backdrop. */
  useEffect(() => {
    if (!open) return;
    let active = true;
    const controller = new AbortController();
    form.resetFields();
    void runWithLoadingBackdrop(
      async () => {
        const response = await fetch(
          `/api/employees/${employee.id}/profile?organizationId=${organizationId}`,
          { signal: controller.signal },
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body.message);
        if (active) {
          setActiveSections([]);
          setErrorSections([]);
          setRemovedFileIds([]);
          setRemovalConfirmation(null);
          const normalized = normalizeProfile(body.data || {});
          // Pas foto memakai upload yang sama, tetapi tidak dikirim sebagai nomor identitas.
          if (body.data?.profilePhoto) {
            const profilePhoto = normalizeStoredFile(body.data.profilePhoto);
            normalized.identifiers.unshift({
              identifierType: "pas_foto",
              identifierLabel: null,
              identifierValue: null,
              issuedAt: null,
              expiresAt: null,
              isVerified: false,
              documentFileId: profilePhoto?.id || null,
              documentFile: profilePhoto,
            });
          }
          // Snapshot melindungi panel Collapse yang belum dibuka dari payload kosong saat submit.
          loadedProfileRef.current = normalized;
          form.setFieldsValue(normalized);
        }
      },
      { message: "Memuat profil lengkap..." },
    ).catch((error) => {
      if (error.name !== "AbortError") onErrorRef.current(error.message);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [employee.id, form, open, organizationId, runWithLoadingBackdrop]);

  /** Meminta persetujuan sebelum data atau file dikeluarkan dari perubahan profil. */
  const requestRemoval = ({ label, fileId, fileIds = [], apply }) => {
    const ids = [...fileIds, fileId].filter(Boolean).map(String);
    setRemovalConfirmation({ label, fileIds: ids, apply });
  };

  /** Menghapus baris form setelah konfirmasi dan mengantrekan file terkait untuk soft delete saat simpan. */
  const requestListRemoval = (name, addLabel, fieldName, remove) => {
    const value = form.getFieldValue([name, fieldName]) || {};
    requestRemoval({
      label: addLabel.replace(/^Tambah\s+/i, "").toLowerCase(),
      fileIds: [value.documentFileId, value.certificateFileId],
      apply: () => remove(fieldName),
    });
  };

  /** Konfirmasi hanya mengubah state form; database baru berubah saat profil disimpan. */
  const confirmRemoval = () => {
    if (!removalConfirmation) return;
    removalConfirmation.apply();
    setRemovedFileIds((current) => [
      ...new Set([...current, ...removalConfirmation.fileIds].map(String)),
    ]);
    setRemovalConfirmation(null);
  };

  /** Menyimpan semua section sekaligus agar constraint rekening/kontak utama konsisten. */
  const submit = async () => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          // Semua path form dibaca, termasuk panel Collapse yang masih tertutup.
          const normalizedProfile = normalizeProfileSubmission({
            ...(loadedProfileRef.current || {}),
            ...form.getFieldsValue(true),
          });
          const uploads = [];
          const multipart = new FormData();
          const registerUpload = (file, target, index = null) => {
            if (!file?.localFile || !file?.uploadToken) return;
            uploads.push({ token: file.uploadToken, target, index });
            multipart.append(`upload:${file.uploadToken}`, file.localFile, file.localFile.name);
          };
          const identifiers = [];
          for (const item of normalizedProfile.identifiers) {
            if (item.identifierType === "pas_foto") {
              registerUpload(item.documentFile, "profilePhoto");
              continue;
            }
            const index = identifiers.length;
            registerUpload(item.documentFile, "identifier", index);
            const { documentFile: _file, ...identifier } = item;
            identifiers.push({
              ...identifier,
              documentFileId: _file?.pending ? null : identifier.documentFileId,
            });
          }
          const educations = normalizedProfile.educations.map((item, index) => {
            registerUpload(item.certificateFile, "education", index);
            const { certificateFile: _file, ...education } = item;
            return {
              ...education,
              certificateFileId: _file?.pending ? null : education.certificateFileId,
            };
          });
          const certifications = normalizedProfile.certifications.map((item, index) => {
            registerUpload(item.certificateFile, "certification", index);
            const { certificateFile: _file, ...certification } = item;
            return {
              ...certification,
              certificateFileId: _file?.pending ? null : certification.certificateFileId,
            };
          });
          multipart.append(
            "payload",
            JSON.stringify({
              organizationId,
              removedFileIds,
              uploads,
              profile: {
                ...normalizedProfile,
                identifiers,
                educations,
                certifications,
              },
            }),
          );
          const response = await fetch(`/api/employees/${employee.id}/profile`, {
            method: "PATCH",
            body: multipart,
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.message);
          await onSaved(body.message);
          setRemovedFileIds([]);
        },
        { message: "Menyimpan profil lengkap..." },
      );
    } catch (error) {
      onError(error.message);
    }
  };

  /** Validasi gagal membuka panel terkait, menandainya, lalu memfokuskan field pertama. */
  const handleFinishFailed = ({ errorFields = [] }) => {
    const sections = resolveErrorSections(errorFields);
    const firstError = errorFields[0]?.name;
    setErrorSections(sections);
    setActiveSections((current) => [...new Set([...current, ...sections])]);
    onError?.(
      sections.length > 1
        ? `Profil belum dapat disimpan. Periksa ${sections.length} bagian yang ditandai merah.`
        : "Profil belum dapat disimpan. Periksa bagian yang ditandai merah.",
    );
    if (firstError) {
      window.setTimeout(() => {
        form.scrollToField(firstError, { behavior: "smooth", block: "center", focus: true });
      }, 250);
    }
  };

  /** Border error hilang segera setelah seluruh field bermasalah pada panel diperbaiki. */
  const refreshErrorSections = () => {
    const remainingErrors = form
      .getFieldsError()
      .filter((field) => Array.isArray(field.errors) && field.errors.length > 0);
    setErrorSections(resolveErrorSections(remainingErrors));
  };

  const twoColumns = {
    display: "grid",
    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
    gap: { sm: "0 16px" },
  };
  const items = [
    {
      key: "identifiers",
      forceRender: true,
      label: "Identitas administratif",
      children: (
        <ListSection
          name="identifiers"
          addLabel="Tambah identitas"
          initialValue={() => {
            const identifierType = getFirstAvailableChoice(
              IDENTITY_OPTIONS,
              form.getFieldValue("identifiers"),
              "identifierType",
            );
            return identifierType
              ? { identifierType, isVerified: false, documentFileId: null }
              : null;
          }}
          onAddUnavailable={() =>
            onError?.("Semua jenis identitas administratif sudah ditambahkan.")
          }
          onRemoveItem={(fieldName, remove) =>
            requestListRemoval("identifiers", "Tambah identitas", fieldName, remove)
          }
        >
          {(field) => (
            <Box sx={twoColumns}>
              <Form.Item
                name={[field.name, "identifierType"]}
                label="Jenis"
                rules={[
                  { required: true, message: "Jenis identitas wajib dipilih." },
                  uniqueListChoiceRule(form, "identifiers", "identifierType", "Jenis identitas"),
                ]}
              >
                <UniqueListSelect
                  form={form}
                  listName="identifiers"
                  fieldIndex={field.name}
                  valueKey="identifierType"
                  options={IDENTITY_OPTIONS}
                  onChange={(identifierType) =>
                    resetIdentityFields(form, field.name, identifierType)
                  }
                />
              </Form.Item>
              <Form.Item
                noStyle
                shouldUpdate={(previous, current) =>
                  previous.identifiers?.[field.name]?.identifierType !==
                  current.identifiers?.[field.name]?.identifierType
                }
              >
                {() =>
                  form.getFieldValue(["identifiers", field.name, "identifierType"]) === "other" ? (
                    <Form.Item
                      name={[field.name, "identifierLabel"]}
                      label="Nama identitas"
                      rules={[{ required: true, message: "Nama identitas wajib diisi." }]}
                    >
                      <Input maxLength={100} placeholder="Contoh: Kartu anggota profesi" />
                    </Form.Item>
                  ) : null
                }
              </Form.Item>
              <IdentityMetadataFields field={field} form={form} />
              <Form.Item name={[field.name, "documentFileId"]} hidden>
                <Input />
              </Form.Item>
              <Box sx={{ gridColumn: "1 / -1" }}>
                <IdentityDocumentField
                  field={field}
                  form={form}
                  employee={employee}
                  organizationId={organizationId}
                  onError={onError}
                  onRemoveRequest={requestRemoval}
                />
              </Box>
            </Box>
          )}
        </ListSection>
      ),
    },
    {
      key: "banks",
      forceRender: true,
      label: "Rekening",
      children: (
        <ListSection
          name="bankAccounts"
          addLabel="Tambah rekening"
          initialValue={{ isPrimary: false }}
          onRemoveItem={(fieldName, remove) =>
            requestListRemoval("bankAccounts", "Tambah rekening", fieldName, remove)
          }
        >
          {(field) => (
            <Box sx={twoColumns}>
              <Form.Item name={[field.name, "bankName"]} label="Bank" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item
                name={[field.name, "accountNumber"]}
                label="Nomor rekening"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name={[field.name, "accountHolder"]}
                label="Nama pemilik"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Box sx={{ gridColumn: { xs: "1 / -1", sm: "1" }, mt: -0.5 }}>
                <Form.Item
                  name={[field.name, "isPrimary"]}
                  valuePropName="checked"
                  style={{ marginBottom: 0 }}
                >
                  <Checkbox>Rekening utama</Checkbox>
                </Form.Item>
              </Box>
            </Box>
          )}
        </ListSection>
      ),
    },
    {
      key: "family",
      forceRender: true,
      label: "Keluarga dan tanggungan",
      children: (
        <ListSection
          name="dependents"
          addLabel="Tambah keluarga"
          initialValue={{ relationship: "child", isDependent: true, isEmergencyContact: false }}
          onRemoveItem={(fieldName, remove) =>
            requestListRemoval("dependents", "Tambah keluarga", fieldName, remove)
          }
        >
          {(field) => (
            <Box sx={twoColumns}>
              <Form.Item name={[field.name, "relationship"]} label="Hubungan">
                <Select
                  options={[
                    { value: "spouse", label: "Pasangan" },
                    { value: "child", label: "Anak" },
                    { value: "parent", label: "Orang tua" },
                    { value: "sibling", label: "Saudara" },
                    { value: "other", label: "Lainnya" },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name={[field.name, "fullName"]}
                label="Nama lengkap"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name={[field.name, "birthDate"]} label="Tanggal lahir">
                <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
              </Form.Item>
              <Form.Item
                name={[field.name, "nationalId"]}
                label="NIK anggota keluarga"
                rules={getIndonesianNationalIdFormRules()}
              >
                <IndonesianNationalIdInput />
              </Form.Item>
              <Form.Item
                name={[field.name, "phone"]}
                label="Nomor kontak"
                rules={getIndonesianMobileFormRules()}
              >
                <IndonesiaPhoneInput />
              </Form.Item>
              <Box
                sx={{
                  gridColumn: "1 / -1",
                  display: "grid",
                  gap: 0.5,
                  mt: -0.5,
                }}
              >
                <Form.Item
                  name={[field.name, "isEmergencyContact"]}
                  valuePropName="checked"
                  style={{ marginBottom: 0 }}
                >
                  <Checkbox>Dapat dihubungi saat darurat</Checkbox>
                </Form.Item>
                <Form.Item
                  name={[field.name, "isDependent"]}
                  valuePropName="checked"
                  style={{ marginBottom: 0 }}
                >
                  <Checkbox>Termasuk tanggungan</Checkbox>
                </Form.Item>
              </Box>
              <Form.Item
                name={[field.name, "notes"]}
                label="Catatan"
                style={{ gridColumn: "1 / -1" }}
              >
                <Input.TextArea rows={2} />
              </Form.Item>
            </Box>
          )}
        </ListSection>
      ),
    },
    {
      key: "emergency",
      forceRender: true,
      label: "Kontak darurat",
      children: (
        <ListSection
          name="emergencyContacts"
          addLabel="Tambah kontak darurat"
          initialValue={{ isPrimary: false }}
          onRemoveItem={(fieldName, remove) =>
            requestListRemoval("emergencyContacts", "Tambah kontak darurat", fieldName, remove)
          }
        >
          {(field) => (
            <Box sx={twoColumns}>
              <Form.Item
                name={[field.name, "fullName"]}
                label="Nama lengkap"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name={[field.name, "relationship"]} label="Hubungan">
                <Input />
              </Form.Item>
              <Form.Item
                name={[field.name, "phone"]}
                label="Nomor kontak"
                rules={getIndonesianMobileFormRules({ required: true })}
              >
                <IndonesiaPhoneInput />
              </Form.Item>
              <Box sx={{ gridColumn: "1 / -1", mt: -0.5 }}>
                <Form.Item
                  name={[field.name, "isPrimary"]}
                  valuePropName="checked"
                  style={{ marginBottom: 0 }}
                >
                  <Checkbox>Kontak utama</Checkbox>
                </Form.Item>
              </Box>
              <Form.Item
                name={[field.name, "address"]}
                label="Alamat"
                style={{ gridColumn: "1 / -1" }}
              >
                <Input.TextArea rows={2} />
              </Form.Item>
            </Box>
          )}
        </ListSection>
      ),
    },
    {
      key: "education",
      forceRender: true,
      label: "Pendidikan",
      children: (
        <ListSection
          name="educations"
          addLabel="Tambah pendidikan"
          initialValue={{ isHighest: false }}
          onRemoveItem={(fieldName, remove) =>
            requestListRemoval("educations", "Tambah pendidikan", fieldName, remove)
          }
        >
          {(field) => (
            <Box sx={twoColumns}>
              <Form.Item
                name={[field.name, "educationLevel"]}
                label="Jenjang pendidikan"
                rules={[{ required: true, message: "Pilih jenjang pendidikan." }]}
              >
                <Select
                  options={EDUCATION_LEVEL_OPTIONS}
                  placeholder="Pilih jenjang pendidikan"
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
              <Form.Item name={[field.name, "institution"]} label="Nama institusi pendidikan">
                <Input placeholder="Contoh: Universitas Sam Ratulangi" maxLength={200} />
              </Form.Item>
              <Form.Item name={[field.name, "fieldOfStudy"]} label="Program studi atau jurusan">
                <Input placeholder="Contoh: Teknik Informatika" maxLength={150} />
              </Form.Item>
              <Form.Item name={[field.name, "graduationYear"]} label="Tahun kelulusan">
                <DatePicker
                  picker="year"
                  format="YYYY"
                  placeholder="Pilih tahun kelulusan"
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item
                name={[field.name, "isHighest"]}
                valuePropName="checked"
                style={{ gridColumn: "1 / -1", marginBottom: 0 }}
              >
                <Checkbox>Tandai sebagai pendidikan tertinggi</Checkbox>
              </Form.Item>
              <Form.Item name={[field.name, "certificateFileId"]} hidden>
                <Input />
              </Form.Item>
              <Box sx={{ gridColumn: "1 / -1" }}>
                <CredentialImageField
                  listName="educations"
                  field={field}
                  form={form}
                  employee={employee}
                  organizationId={organizationId}
                  onError={onError}
                  onRemoveRequest={requestRemoval}
                />
              </Box>
            </Box>
          )}
        </ListSection>
      ),
    },
    {
      key: "skills",
      forceRender: true,
      label: "Keahlian",
      children: (
        <ListSection
          name="skills"
          addLabel="Tambah keahlian"
          initialValue={{}}
          onRemoveItem={(fieldName, remove) =>
            requestListRemoval("skills", "Tambah keahlian", fieldName, remove)
          }
        >
          {(field) => (
            <Box sx={twoColumns}>
              <Form.Item
                name={[field.name, "skillName"]}
                label="Keahlian"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name={[field.name, "proficiencyLevel"]} label="Tingkat">
                <Select options={PROFICIENCY_OPTIONS} placeholder="Pilih tingkat keahlian" />
              </Form.Item>
              <Form.Item
                name={[field.name, "notes"]}
                label="Catatan"
                style={{ gridColumn: "1 / -1" }}
              >
                <Input.TextArea rows={2} />
              </Form.Item>
            </Box>
          )}
        </ListSection>
      ),
    },
    {
      key: "certifications",
      forceRender: true,
      label: "Sertifikasi",
      children: (
        <ListSection
          name="certifications"
          addLabel="Tambah sertifikasi"
          initialValue={{}}
          onRemoveItem={(fieldName, remove) =>
            requestListRemoval("certifications", "Tambah sertifikasi", fieldName, remove)
          }
        >
          {(field) => (
            <Box sx={twoColumns}>
              <Form.Item
                name={[field.name, "certificationName"]}
                label="Nama sertifikasi"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name={[field.name, "issuer"]} label="Penerbit">
                <Input />
              </Form.Item>
              <Form.Item name={[field.name, "credentialNo"]} label="Nomor kredensial">
                <Input />
              </Form.Item>
              <Form.Item name={[field.name, "issuedAt"]} label="Tanggal terbit">
                <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
              </Form.Item>
              <Form.Item name={[field.name, "expiresAt"]} label="Kedaluwarsa">
                <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
              </Form.Item>
              <Form.Item name={[field.name, "certificateFileId"]} hidden>
                <Input />
              </Form.Item>
              <Box sx={{ gridColumn: "1 / -1" }}>
                <CredentialImageField
                  listName="certifications"
                  field={field}
                  form={form}
                  employee={employee}
                  organizationId={organizationId}
                  onError={onError}
                  onRemoveRequest={requestRemoval}
                />
              </Box>
            </Box>
          )}
        </ListSection>
      ),
    },
    {
      key: "social",
      forceRender: true,
      label: "Akun sosial",
      children: (
        <ListSection
          name="socialAccounts"
          addLabel="Tambah akun sosial"
          initialValue={() => {
            const platform = getFirstAvailableChoice(
              SOCIAL_PLATFORM_OPTIONS,
              form.getFieldValue("socialAccounts"),
              "platform",
            );
            return platform ? { platform } : null;
          }}
          onAddUnavailable={() => onError?.("Semua platform akun sosial sudah ditambahkan.")}
          onRemoveItem={(fieldName, remove) =>
            requestListRemoval("socialAccounts", "Tambah akun sosial", fieldName, remove)
          }
        >
          {(field) => (
            <Box sx={twoColumns}>
              <Form.Item
                name={[field.name, "platform"]}
                label="Platform"
                rules={[
                  { required: true, message: "Platform wajib dipilih." },
                  uniqueListChoiceRule(form, "socialAccounts", "platform", "Platform"),
                ]}
              >
                <UniqueListSelect
                  form={form}
                  listName="socialAccounts"
                  fieldIndex={field.name}
                  valueKey="platform"
                  options={SOCIAL_PLATFORM_OPTIONS}
                  placeholder="Pilih platform"
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
              <Form.Item
                name={[field.name, "handleOrUrl"]}
                label="Username atau URL"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Box>
          )}
        </ListSection>
      ),
    },
  ];
  const collapseItems = items.map((item) => {
    const hasError = errorSections.includes(item.key);
    return {
      ...item,
      className: hasError ? "profile-section-error" : undefined,
      label: (
        <Box
          component="span"
          sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}
        >
          <span>{item.label}</span>
          {hasError ? (
            <Box
              component="span"
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, color: "error.main" }}
            >
              <WarningOutlined aria-hidden="true" />
              <FontStyle component="span" fontSize={11.5} fontWeight={600}>
                Periksa isian
              </FontStyle>
            </Box>
          ) : null}
        </Box>
      ),
    };
  });
  return (
    <>
      <AppModal
        open={open}
        title="Profil lengkap pegawai"
        description="Kelola data administratif sensitif pada satu transaksi."
        size="xl"
        onClose={onClose}
        footer={
          <>
            <Button onClick={onClose}>Batal</Button>
            <Button type="primary" onClick={() => form.submit()}>
              Simpan profil lengkap
            </Button>
          </>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          onFinishFailed={handleFinishFailed}
          onFieldsChange={refreshErrorSections}
          initialValues={{
            identifiers: [],
            bankAccounts: [],
            dependents: [],
            emergencyContacts: [],
            socialAccounts: [],
            educations: [],
            skills: [],
            certifications: [],
          }}
        >
          <Box
            sx={{
              "& .profile-section-error": {
                border: "1px solid",
                borderColor: "error.main",
                borderRadius: "8px",
                overflow: "hidden",
              },
            }}
          >
            <Collapse
              items={collapseItems}
              activeKey={activeSections}
              onChange={(keys) => setActiveSections(Array.isArray(keys) ? keys : [keys])}
            />
          </Box>
        </Form>
      </AppModal>
      <ConfirmDialog
        open={Boolean(removalConfirmation)}
        title="Hapus data profil?"
        message={
          removalConfirmation?.fileIds?.length
            ? `Data ${removalConfirmation.label} dan file terkait akan dihapus setelah Anda menekan Simpan profil lengkap. Yakin ingin melanjutkan?`
            : `Data ${removalConfirmation?.label || "ini"} akan dihapus setelah Anda menekan Simpan profil lengkap. Yakin ingin melanjutkan?`
        }
        confirmText="Hapus"
        danger
        onConfirm={confirmRemoval}
        onClose={() => setRemovalConfirmation(null)}
      />
    </>
  );
}
