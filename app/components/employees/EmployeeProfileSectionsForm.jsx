"use client";

import { useEffect, useRef } from "react";
import { Button, Checkbox, Collapse, Form, Input, Select } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Box } from "@mui/material";
import AppModal from "@/app/components/modals/AppModal";
import FontStyle from "@/app/components/font-style/FontStyle";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import IndonesiaPhoneInput from "@/app/components/forms/IndonesiaPhoneInput";
import PrivateFileUpload from "@/app/components/forms/PrivateFileUpload";
import { getIndonesianMobileFormRules } from "@/lib/validation/indonesianPhone";

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
    ),
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
    }),
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
    ),
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
    ),
  };
}

/** Menjaga section Collapse yang belum pernah dibuka tetap dikirim sebagai array kosong. */
function normalizeProfileSubmission(profile) {
  const source = profile || {};
  const array = (value) => (Array.isArray(value) ? value : []);
  return {
    identifiers: array(source.identifiers),
    bankAccounts: array(source.bankAccounts),
    dependents: array(source.dependents),
    emergencyContacts: array(source.emergencyContacts),
    socialAccounts: array(source.socialAccounts),
    educations: array(source.educations),
    skills: array(source.skills),
    certifications: array(source.certifications),
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

const PROFICIENCY_OPTIONS = [
  { value: "pemula", label: "Pemula" },
  { value: "dasar", label: "Dasar" },
  { value: "menengah", label: "Menengah" },
  { value: "mahir", label: "Mahir" },
  { value: "ahli", label: "Ahli" },
];

/** Mengunggah file sesuai jenis yang dipilih tanpa membuka akses path penyimpanan privat. */
function IdentityDocumentField({ field, form, employee, organizationId, onError }) {
  const type = Form.useWatch(["identifiers", field.name, "identifierType"], form) || "other";
  const file = Form.useWatch(["identifiers", field.name, "documentFile"], form);
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
      uploadUrl="/api/uploads"
      removeUrl={file ? `/api/uploads/${file.id}?organizationId=${organizationId}` : undefined}
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
        rules={[{ required: true, message: `${config.numberLabel} wajib diisi.` }]}
      >
        <Input maxLength={100} inputMode={type === "ktp" ? "numeric" : undefined} />
      </Form.Item>
      {hasValidityPeriod ? (
        <>
          <Form.Item name={[field.name, "issuedAt"]} label="Tanggal terbit">
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name={[field.name, "expiresAt"]} label="Tanggal berakhir">
            <Input placeholder="YYYY-MM-DD" />
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
function CredentialImageField({ listName, field, form, employee, organizationId, onError }) {
  const file = Form.useWatch([listName, field.name, "certificateFile"], form);
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
      uploadUrl="/api/uploads"
      removeUrl={file ? `/api/uploads/${file.id}?organizationId=${organizationId}` : undefined}
      fields={{ fileKind, employeeId: employee.id }}
      organizationId={organizationId}
      onChange={setFile}
      onError={onError}
      accept="image/jpeg,image/png,image/webp"
      maxSizeBytes={5 * 1024 * 1024}
      emptyTitle={`Pilih atau tarik foto ${listName === "educations" ? "ijazah" : "sertifikat"} ke area ini`}
      helpText="Gunakan JPEG, PNG, atau WebP maksimal 5 MB."
      selectedText="Gambar tersimpan secara privat"
    />
  );
}

/** Wrapper daftar memberi pola tambah/hapus konsisten untuk setiap section profil. */
function ListSection({ name, addLabel, initialValue, children }) {
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
                  onClick={() => remove(field.name)}
                />
              </Box>
              {children(field)}
            </Box>
          ))}
          <Button icon={<PlusOutlined />} onClick={() => add(initialValue)}>
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
          const response = await fetch(`/api/employees/${employee.id}/profile`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              organizationId,
              profile: {
                ...normalizedProfile,
                identifiers: normalizedProfile.identifiers
                  .filter((item) => item.identifierType !== "pas_foto")
                  .map(({ documentFile: _file, ...item }) => item),
                educations: normalizedProfile.educations.map(
                  ({ certificateFile: _file, ...item }) => item,
                ),
                certifications: normalizedProfile.certifications.map(
                  ({ certificateFile: _file, ...item }) => item,
                ),
              },
            }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.message);
          await onSaved(body.message);
        },
        { message: "Menyimpan profil lengkap..." },
      );
    } catch (error) {
      onError(error.message);
    }
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
          initialValue={{ identifierType: "bpjs_health", isVerified: false, documentFileId: null }}
        >
          {(field) => (
            <Box sx={twoColumns}>
              <Form.Item
                name={[field.name, "identifierType"]}
                label="Jenis"
                rules={[{ required: true }]}
              >
                <Select
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
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
              <Form.Item name={[field.name, "nationalId"]} label="NIK anggota keluarga">
                <Input inputMode="numeric" maxLength={16} />
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
        >
          {(field) => (
            <Box sx={twoColumns}>
              <Form.Item
                name={[field.name, "educationLevel"]}
                label="Jenjang"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name={[field.name, "institution"]} label="Institusi">
                <Input />
              </Form.Item>
              <Form.Item name={[field.name, "fieldOfStudy"]} label="Bidang studi">
                <Input />
              </Form.Item>
              <Form.Item name={[field.name, "graduationYear"]} label="Tahun lulus">
                <Input type="number" />
              </Form.Item>
              <Form.Item name={[field.name, "isHighest"]} valuePropName="checked">
                <Checkbox>Pendidikan tertinggi</Checkbox>
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
        <ListSection name="skills" addLabel="Tambah keahlian" initialValue={{}}>
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
        <ListSection name="certifications" addLabel="Tambah sertifikasi" initialValue={{}}>
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
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
              <Form.Item name={[field.name, "expiresAt"]} label="Kedaluwarsa">
                <Input placeholder="YYYY-MM-DD" />
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
        <ListSection name="socialAccounts" addLabel="Tambah akun sosial" initialValue={{}}>
          {(field) => (
            <Box sx={twoColumns}>
              <Form.Item
                name={[field.name, "platform"]}
                label="Platform"
                rules={[{ required: true }]}
              >
                <Select
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
  return (
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
        <Collapse items={items} />
      </Form>
    </AppModal>
  );
}
