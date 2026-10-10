"use client";

import { applyApiFieldErrors, readApiResponse } from "@/lib/api/clientError";

import { useEffect, useRef, useState } from "react";
import { Button, Form, Input, Segmented, Select } from "antd";
import { Box } from "@mui/material";
import AppModal from "@/app/components/modals/AppModal";
import OrganizationScopeField from "@/app/components/forms/OrganizationScopeField";
import FormSettingSwitch, { FormSettingsGroup } from "@/app/components/forms/FormSettingSwitch";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { PASSWORD_FORM_RULES } from "@/app/utils/passwordRules";
import { ROLES } from "@/app/constants/roles";
import FeatureAccessFields from "./FeatureAccessFields";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import usePrerequisiteNavigation from "@/app/hooks/usePrerequisiteNavigation";
import { grantKey } from "@/lib/access/packagePolicy.mjs";
import { accountFeatureGroups } from "@/lib/access/accessDescriptions.mjs";

/** Form mengunci pembuatan HRD ke akun Pegawai; Superadmin tetap mengelola role organisasi. */
export default function OrganizationAccountForm({
  open,
  item,
  organizationId,
  onClose,
  onSaved,
  onError,
}) {
  const user = useAuthenticatedUser();
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const [options, setOptions] = useState({
    employees: [],
    locations: [],
    packages: [],
    warehouses: [],
    inventoryEnabled: false,
    canGrantAll: false,
  });
  const dirtyRef = useRef(false);
  const { close: closeGuard, navigate: navigatePrerequisite } = usePrerequisiteNavigation(
    form,
    onClose,
    () => dirtyRef.current,
  );
  const [pending, setPending] = useState(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsReady, setOptionsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  const targetOrganizationId = Form.useWatch("organizationId", form);
  const roleCode = Form.useWatch("roleCode", form);
  const scopeMode = Form.useWatch("locationScopeMode", form);
  const fullAdmin = Form.useWatch("isHrisAdmin", form);
  useEffect(() => {
    if (fullAdmin) {
      form.setFieldValue("locationScopeMode", "all");
      form.setFieldValue("locationIds", []);
    }
  }, [fullAdmin, form]);
  const editing = Boolean(item);
  const isHrd = user.role_code === ROLES.HRD && !user.access?.hris?.fullAdmin;

  useEffect(() => {
    if (!open) return;
    dirtyRef.current = false;
    form.resetFields();
    form.setFieldsValue({
      organizationId: organizationId || user.organization_id,
      roleCode: "employee",
      locationScopeMode: "all",
      locationIds: [],
      isActive: true,
      packageAccess: [],
      isHrisAdmin: false,
      hrisMenuAccess: [],
      expandedHrisGroups: ["Kepegawaian"],
      expandedFeatureSections: item
        ? [
            accountFeatureGroups(item).find((feature) => feature.key === "hris")?.key ||
              accountFeatureGroups(item)[0]?.key,
          ].filter(Boolean)
        : [],
      hrisAccountAccess: "none",
      featureModules: item ? accountFeatureGroups(item).map((feature) => feature.key) : [],
      ...(item
        ? {
            employeeId: item.employee_id,
            username: item.username,
            isHrisAdmin: Boolean(item.hrisAccess?.fullAdmin),
            hrisMenuAccess: item.hrisAccess?.grants || [],
            hrisAccountAccess: item.hrisAccess?.accountAccess || "none",
            roleCode: item.role_code,
            locationScopeMode: item.location_scope_mode,
            locationIds: item.location_ids,
            isActive: item.is_active,
            packageAccess: (item.packageAccess || []).map((grant) => ({
              packageCode: grant.packageCode,
              scopeMode: grant.scopeMode,
              warehouseIds: grant.warehouseIds,
            })),
          }
        : {}),
    });
  }, [form, item, open, organizationId, user.organization_id]);

  /** Hanya memuat profil bebas dan profil milik akun yang sedang diedit. */
  useEffect(() => {
    const target = targetOrganizationId;
    if (!open || !target) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ organizationId: String(target) });
    if (item?.id) query.set("accountId", String(item.id));
    Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return null;
        setOptions({
          employees: [],
          locations: [],
          packages: [],
          warehouses: [],
          inventoryEnabled: false,
          canGrantAll: false,
        });
        setOptionsReady(false);
        setOptionsLoading(true);
        return fetch(`/api/access/accounts/reference-options?${query}`, {
          signal: controller.signal,
          cache: "no-store",
        });
      })
      .then((response) => (response ? readApiResponse(response) : null))
      .then((body) => {
        if (controller.signal.aborted || !body) return;
        setOptions({
          employees: body.data?.employees || [],
          locations: body.data?.locations || [],
          packages: body.data?.packages || [],
          warehouses: body.data?.warehouses || [],
          inventoryEnabled: Boolean(body.data?.inventoryEnabled),
          canGrantAll: Boolean(body.data?.canGrantAll),
          lockedPackageCodes: body.data?.lockedPackageCodes || [],
          canSetHrisAdmin: Boolean(body.data?.canSetHrisAdmin),
          canGrantHris: Boolean(body.data?.canGrantHris),
          canDelegateNonHris: Boolean(body.data?.canDelegateNonHris),
          hrisConfigured: Boolean(body.data?.hrisConfigured),
          hrisPolicyVersion: body.data?.hrisPolicyVersion || 0,
          needsFirstHrisAdmin: Boolean(body.data?.needsFirstHrisAdmin),
        });
        if (!item && body.data?.needsFirstHrisAdmin && body.data?.canSetHrisAdmin) {
          form.setFieldValue("isHrisAdmin", true);
          form.setFieldValue("expandedFeatureSections", ["hris"]);
        }
        setOptionsReady(true);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          onErrorRef.current(error.message || "Referensi akun tidak dapat dimuat.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setOptionsLoading(false);
      });
    return () => controller.abort();
  }, [item, form, open, organizationId, targetOrganizationId, user.organization_id]);

  /** Backend memvalidasi password dan konfirmasinya; confirmPassword tidak pernah disimpan. */
  const submit = async (values) => {
    // Pertahankan pencabutan eksplisit dari section yang dilepas atau dilipat.
    values = { ...form.getFieldsValue(true), ...values };
    const {
      featureModules: _featureModules,
      expandedFeatureSections: _expandedFeatureSections,
      expandedHrisGroups: _expandedHrisGroups,
      ...accountValues
    } = values;
    if (savingRef.current || !optionsReady) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(
            editing ? `/api/access/accounts/${item.id}` : "/api/access/accounts",
            {
              method: editing ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...accountValues,
                roleCode: isHrd ? ROLES.EMPLOYEE : values.roleCode,
                locationIds:
                  !isHrd && values.roleCode === "hrd" && values.locationScopeMode === "selected"
                    ? values.locationIds
                    : [],
                locationScopeMode: isHrd ? "all" : values.locationScopeMode,
                ...(values.roleCode === "hrd" && options.canGrantHris
                  ? {
                      hrisMenuAccess: values.hrisMenuAccess || [],
                      isHrisAdmin: values.isHrisAdmin,
                      hrisPolicyVersion: options.hrisPolicyVersion || 0,
                      hrisAccountAccess: values.hrisAccountAccess,
                    }
                  : {
                      hrisMenuAccess: undefined,
                      isHrisAdmin: undefined,
                      hrisAccountAccess: undefined,
                    }),
                packageAccess: options.canDelegateNonHris ? values.packageAccess : undefined,
                ...(editing ? { version: item.updated_at } : {}),
              }),
            },
          );
          const body = await readApiResponse(response);
          window.dispatchEvent(new Event("sitou:access-changed"));
          await onSaved(body.message);
        },
        { message: "Menyimpan akun organisasi..." },
      );
    } catch (error) {
      applyApiFieldErrors(form, error);
      revealAccessErrors(
        Object.keys(error.fieldErrors || {}).map((name) => ({ name: name.split(".") })),
      );
      onError(error.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  /** Membuka section error sebelum memfokuskan field, tanpa mengubah hak akses. */
  const revealAccessErrors = (fields) => {
    const names = fields.map((field) =>
      Array.isArray(field.name) ? field.name[0] : String(field.name).split(".")[0],
    );
    const sections = [...(form.getFieldValue("expandedFeatureSections") || [])];
    if (names.includes("packageAccess")) sections.push("inventory");
    if (
      names.some((name) => ["hrisMenuAccess", "hrisAccountAccess", "isHrisAdmin"].includes(name))
    ) {
      sections.push("hris");
      form.setFieldValue("expandedHrisGroups", [
        "Data Master",
        "Kepegawaian",
        "Laporan",
        "Pengaturan Organisasi",
        "Akun & Akses",
      ]);
    }
    form.setFieldValue("expandedFeatureSections", [...new Set(sections)]);
    if (fields[0]) requestAnimationFrame(() => form.scrollToField(fields[0].name, { focus: true }));
  };
  const confirmSubmit = (values) => {
    values = { ...form.getFieldsValue(true), ...values };
    const reduced = (item?.packageAccess || []).some(
      (old) => !(values.packageAccess || []).some((grant) => grantKey(old) === grantKey(grant)),
    );
    const hrisReduced = (item?.hrisAccess?.grants || []).some(
      (old) =>
        !(values.hrisMenuAccess || []).some(
          (grant) =>
            grant.key === old.key && (grant.level === old.level || grant.level === "manage"),
        ),
    );
    const accountReduced =
      item?.hrisAccess?.accountAccess &&
      item.hrisAccess.accountAccess !== "none" &&
      (values.hrisAccountAccess === "none" ||
        (item.hrisAccess.accountAccess === "manage_and_delegate" &&
          values.hrisAccountAccess === "manage"));
    if (
      reduced ||
      hrisReduced ||
      accountReduced ||
      (values.isHrisAdmin && !item?.hrisAccess?.fullAdmin)
    )
      setPending(values);
    else void submit(values);
  };

  return (
    <>
      <AppModal
        open={open}
        title={
          editing
            ? "Edit akun organisasi"
            : isHrd
              ? "Tambah akun Pegawai"
              : "Tambah akun organisasi"
        }
        description={
          isHrd
            ? "Akun otomatis menggunakan role Pegawai dan wajib ditautkan ke profil pegawai."
            : "Buat kredensial akses; identitas bersumber dari profil pegawai yang ditautkan."
        }
        size="lg"
        onClose={closeGuard.requestClose}
        disableClose={saving}
        footer={
          <>
            <Button onClick={closeGuard.requestClose} disabled={saving}>
              Batal
            </Button>
            <Button
              type="primary"
              loading={saving}
              disabled={!optionsReady || optionsLoading}
              onClick={() => form.submit()}
            >
              Simpan akun
            </Button>
          </>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={() => {
            dirtyRef.current = true;
          }}
          onFinish={confirmSubmit}
          onFinishFailed={({ errorFields }) => {
            onError("Periksa kembali isian akun dan akses fitur.");
            revealAccessErrors(errorFields);
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" },
              minWidth: 0,
              "& .ant-form-item": { minWidth: 0 },
              gap: { sm: "0 16px" },
            }}
          >
            <Box sx={{ gridColumn: "1 / -1" }}>
              <OrganizationScopeField disabled={editing} />
            </Box>
            {isHrd ? (
              <Form.Item name="roleCode" hidden>
                <Input />
              </Form.Item>
            ) : (
              <Form.Item name="roleCode" label="Role" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: "hrd", label: "HRD" },
                    { value: "leader", label: "Pimpinan" },
                    { value: "employee", label: "Pegawai" },
                  ]}
                />
              </Form.Item>
            )}
            <Form.Item
              name="employeeId"
              label={roleCode === "employee" ? "Profil pegawai" : "Profil pegawai (opsional)"}
              rules={[
                {
                  validator: (_, value) =>
                    roleCode !== "employee" || value
                      ? Promise.resolve()
                      : Promise.reject(
                          new Error("Profil pegawai wajib dipilih untuk akun Pegawai."),
                        ),
                },
              ]}
              extra={
                roleCode === "employee"
                  ? "Akun Pegawai harus terhubung ke profil dan penempatan aktif."
                  : "Kosongkan untuk membuat akun akses tanpa profil pegawai."
              }
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Pilih profil bila diperlukan"
                loading={optionsLoading}
                disabled={optionsLoading || saving}
                options={options.employees.map((value) => ({
                  value: value.id,
                  label: `${value.employee_no} - ${value.full_name}`,
                }))}
              />
            </Form.Item>
            <Form.Item
              name="username"
              label="Username"
              rules={[{ required: true, min: 3 }]}
              style={!isHrd ? { gridColumn: "1 / -1" } : undefined}
            >
              <Input maxLength={80} autoComplete="off" />
            </Form.Item>
            {!editing ? (
              <>
                <Form.Item name="password" label="Password" rules={PASSWORD_FORM_RULES}>
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
                <Form.Item
                  name="confirmPassword"
                  label="Konfirmasi password"
                  dependencies={["password"]}
                  rules={[
                    { required: true, message: "Konfirmasi password wajib diisi." },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        return !value || getFieldValue("password") === value
                          ? Promise.resolve()
                          : Promise.reject(new Error("Konfirmasi password tidak sama."));
                      },
                    }),
                  ]}
                >
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
              </>
            ) : null}
          </Box>
          {!isHrd && roleCode === "hrd" ? (
            <>
              <Form.Item name="locationScopeMode" label="Cakupan lokasi">
                <Segmented
                  disabled={Boolean(fullAdmin)}
                  block
                  options={[
                    { value: "all", label: "Seluruh lokasi" },
                    { value: "selected", label: "Lokasi tertentu" },
                  ]}
                />
              </Form.Item>
              {scopeMode === "selected" ? (
                <Form.Item
                  name="locationIds"
                  label="Lokasi yang dapat dikelola"
                  rules={[{ required: true, type: "array", min: 1 }]}
                >
                  <Select
                    mode="multiple"
                    showSearch
                    optionFilterProp="label"
                    options={options.locations.map((value) => ({
                      value: value.id,
                      label: value.name,
                    }))}
                  />
                </Form.Item>
              ) : null}
            </>
          ) : null}
          <FeatureAccessFields
            form={form}
            roleCode={roleCode}
            item={item}
            options={options}
            optionsReady={optionsReady}
            organizationId={targetOrganizationId}
            onNavigate={navigatePrerequisite}
            onDirty={() => {
              dirtyRef.current = true;
            }}
          />
          <FormSettingsGroup sx={{ mt: 1 }}>
            <FormSettingSwitch
              name="isActive"
              title="Akun dapat digunakan untuk masuk"
              description="Nonaktifkan jika akses akun perlu dihentikan tanpa menghapus data dan riwayatnya."
            />
          </FormSettingsGroup>
        </Form>
      </AppModal>
      <ConfirmDialog
        open={Boolean(pending)}
        title={
          pending?.isHrisAdmin && !item?.hrisAccess?.fullAdmin
            ? "Tetapkan admin HRD penuh?"
            : "Ubah cakupan akses?"
        }
        message={
          pending?.isHrisAdmin && !item?.hrisAccess?.fullAdmin
            ? "Akun ini menjadi satu-satunya admin HRD penuh. Admin sebelumnya mengikuti hak menu yang tersimpan. Inventaris tetap terpisah."
            : "Hak menu dan cakupan diganti sesuai pilihan baru. Perubahan berlaku pada permintaan berikutnya, termasuk akun yang masih login."
        }
        confirmText="Simpan perubahan"
        onClose={() => setPending(null)}
        onConfirm={() => {
          const values = pending;
          setPending(null);
          void submit(values);
        }}
      />
      <ConfirmDialog
        open={closeGuard.confirmCloseOpen}
        title="Tutup tanpa menyimpan?"
        message="Perubahan akun dan akses fitur belum disimpan."
        confirmText="Tutup"
        onClose={closeGuard.keepEditing}
        onConfirm={closeGuard.discardChanges}
      />
    </>
  );
}

/** Modal reset password memvalidasi konfirmasi sebelum request dikirim. */
export function AccountPasswordForm({ open, item, onClose, onSaved, onError }) {
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const submit = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(`/api/access/accounts/${item.id}/password`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...values, organizationId: item.organization_id }),
          });
          const body = await readApiResponse(response);
          form.resetFields();
          await onSaved(body.message);
        },
        { message: "Memperbarui password..." },
      );
    } catch (error) {
      applyApiFieldErrors(form, error);
      onError(error.message);
    }
  };
  return (
    <AppModal
      open={open}
      title="Reset password"
      description={`Tetapkan password baru untuk ${item?.display_name || `@${item?.username}`}.`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="primary" onClick={() => form.submit()}>
            Simpan password
          </Button>
        </>
      }
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="password" label="Password baru" rules={PASSWORD_FORM_RULES}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="Konfirmasi password"
          dependencies={["password"]}
          rules={[
            { required: true },
            ({ getFieldValue }) => ({
              validator(_, value) {
                return !value || getFieldValue("password") === value
                  ? Promise.resolve()
                  : Promise.reject(new Error("Konfirmasi password tidak sama."));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </AppModal>
  );
}
