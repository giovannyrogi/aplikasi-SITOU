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
import PrivatePdfUpload from "@/app/components/forms/PrivatePdfUpload";
import { getIndonesianMobileFormRules } from "@/lib/validation/indonesianPhone";

/** Mengubah kontrak snake_case API ke field camelCase yang digunakan form. */
function normalizeProfile(profile) {
  const map = (items, mapping) =>
    (items || []).map((item) =>
      Object.fromEntries(Object.entries(mapping).map(([target, source]) => [target, item[source]])),
    );
  return {
    identifiers: map(profile.identifiers, {
      identifierType: "identifier_type",
      identifierLabel: "identifier_label",
      identifierValue: "identifier_value",
      issuedAt: "issued_at",
      expiresAt: "expires_at",
      isVerified: "is_verified",
      documentFileId: "document_file_id",
      documentFile: "document_file",
    }),
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
    educations: map(profile.educations, {
      educationLevel: "education_level",
      institution: "institution",
      fieldOfStudy: "field_of_study",
      graduationYear: "graduation_year",
      isHighest: "is_highest",
      certificateFileId: "certificate_file_id",
      certificateFile: "certificate_file",
    }),
    skills: map(profile.skills, {
      skillName: "skill_name",
      proficiencyLevel: "proficiency_level",
      notes: "notes",
    }),
    certifications: map(profile.certifications, {
      certificationName: "certification_name",
      issuer: "issuer",
      credentialNo: "credential_no",
      issuedAt: "issued_at",
      expiresAt: "expires_at",
      certificateFileId: "certificate_file_id",
      certificateFile: "certificate_file",
    }),
  };
}

const IDENTITY_CONFIG = {
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

/** Mengunggah dokumen identitas pada baris yang sama dengan nomor administrasinya. */
function IdentityDocumentField({ field, form, employee, organizationId, onError }) {
  const type = Form.useWatch(["identifiers", field.name, "identifierType"], form) || "other";
  const file = Form.useWatch(["identifiers", field.name, "documentFile"], form);
  const config = IDENTITY_CONFIG[type] || IDENTITY_CONFIG.other;
  const setFile = (nextFile) => {
    form.setFieldValue(["identifiers", field.name, "documentFile"], nextFile);
    form.setFieldValue(["identifiers", field.name, "documentFileId"], nextFile?.id || null);
  };
  return (
    <PrivateFileUpload
      value={file}
      uploadUrl="/api/uploads"
      removeUrl={file ? `/api/uploads/${file.id}?organizationId=${organizationId}` : undefined}
      fields={{ fileKind: config.fileKind, employeeId: employee.id }}
      organizationId={organizationId}
      onChange={setFile}
      onError={onError}
      accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
      maxSizeBytes={5 * 1024 * 1024}
      emptyTitle={`Pilih atau tarik foto/PDF ${config.label}`}
      helpText="Gunakan foto yang jelas atau PDF maksimal 5 MB."
    />
  );
}

/** Field nomor dan periode menyesuaikan jenis identitas yang dipilih pengguna. */
function IdentityMetadataFields({ field, form }) {
  const type = Form.useWatch(["identifiers", field.name, "identifierType"], form) || "other";
  const config = IDENTITY_CONFIG[type] || IDENTITY_CONFIG.other;
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

/** Menghubungkan ijazah atau sertifikat ke record profil yang sedang diedit. */
function CertificateDocumentField({ listName, field, form, employee, organizationId, onError }) {
  const file = Form.useWatch([listName, field.name, "certificateFile"], form);
  const fileKind = listName === "educations" ? "pendidikan" : "sertifikasi";
  const setFile = (nextFile) => {
    form.setFieldValue([listName, field.name, "certificateFile"], nextFile);
    form.setFieldValue([listName, field.name, "certificateFileId"], nextFile?.id || null);
  };
  return (
    <PrivatePdfUpload
      value={file}
      uploadUrl="/api/uploads"
      removeUrl={file ? `/api/uploads/${file.id}?organizationId=${organizationId}` : undefined}
      fields={{ fileKind, employeeId: employee.id }}
      organizationId={organizationId}
      onChange={setFile}
      onError={onError}
      helpText={`${listName === "educations" ? "Ijazah" : "Sertifikat"} PDF maksimal 10 MB.`}
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
          normalized.identifiers = normalized.identifiers.map((item) => ({
            ...item,
            documentFile: item.documentFileId
              ? {
                  id: item.documentFileId,
                  original_name: item.documentFile?.original_name,
                  mime_type: item.documentFile?.mime_type,
                  size_bytes: item.documentFile?.size_bytes,
                }
              : null,
          }));
          normalized.educations = normalized.educations.map((item) => ({
            ...item,
            certificateFile: item.certificateFileId
              ? {
                  id: item.certificateFileId,
                  original_name: item.certificateFile?.original_name,
                  mime_type: item.certificateFile?.mime_type,
                  size_bytes: item.certificateFile?.size_bytes,
                }
              : null,
          }));
          normalized.certifications = normalized.certifications.map((item) => ({
            ...item,
            certificateFile: item.certificateFileId
              ? {
                  id: item.certificateFileId,
                  original_name: item.certificateFile?.original_name,
                  mime_type: item.certificateFile?.mime_type,
                  size_bytes: item.certificateFile?.size_bytes,
                }
              : null,
          }));
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
  const submit = async (profile) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(`/api/employees/${employee.id}/profile`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              organizationId,
              profile: {
                ...profile,
                identifiers: profile.identifiers.map(({ documentFile: _file, ...item }) => item),
                educations: profile.educations.map(({ certificateFile: _file, ...item }) => item),
                certifications: profile.certifications.map(
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
                  options={[
                    { value: "ktp", label: "KTP" },
                    { value: "family_card", label: "Kartu Keluarga" },
                    { value: "bpjs_health", label: "BPJS Kesehatan" },
                    { value: "bpjs_employment", label: "BPJS Ketenagakerjaan" },
                    { value: "tax_npwp", label: "NPWP" },
                    { value: "other", label: "Lainnya" },
                  ]}
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
              <Form.Item name={[field.name, "isPrimary"]} valuePropName="checked">
                <Checkbox>Rekening utama</Checkbox>
              </Form.Item>
            </Box>
          )}
        </ListSection>
      ),
    },
    {
      key: "family",
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
              <Form.Item name={[field.name, "isDependent"]} valuePropName="checked">
                <Checkbox>Termasuk tanggungan</Checkbox>
              </Form.Item>
              <Form.Item name={[field.name, "isEmergencyContact"]} valuePropName="checked">
                <Checkbox>Dapat dihubungi saat darurat</Checkbox>
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
      key: "emergency",
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
              <Form.Item name={[field.name, "isPrimary"]} valuePropName="checked">
                <Checkbox>Kontak utama</Checkbox>
              </Form.Item>
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
                <CertificateDocumentField
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
                <Input />
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
                <CertificateDocumentField
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
                <Input />
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
