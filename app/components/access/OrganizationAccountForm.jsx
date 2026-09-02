"use client";

import { applyApiFieldErrors, readApiResponse } from "@/lib/api/clientError";

import { useEffect, useState } from "react";
import { Button, Form, Input, Segmented, Select } from "antd";
import { Box } from "@mui/material";
import AppModal from "@/app/components/modals/AppModal";
import OrganizationScopeField from "@/app/components/forms/OrganizationScopeField";
import FormSettingSwitch, { FormSettingsGroup } from "@/app/components/forms/FormSettingSwitch";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { PASSWORD_FORM_RULES } from "@/app/utils/passwordRules";
import { ROLES } from "@/app/constants/roles";

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
  const [options, setOptions] = useState({ employees: [], locations: [] });
  const targetOrganizationId = Form.useWatch("organizationId", form);
  const roleCode = Form.useWatch("roleCode", form);
  const scopeMode = Form.useWatch("locationScopeMode", form);
  const editing = Boolean(item);
  const isHrd = user.role_code === ROLES.HRD;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      organizationId: organizationId || user.organization_id,
      roleCode: "employee",
      locationScopeMode: "all",
      locationIds: [],
      isActive: true,
      ...(item
        ? {
            employeeId: item.employee_id,
            username: item.username,
            roleCode: item.role_code,
            locationScopeMode: item.location_scope_mode,
            locationIds: item.location_ids,
            isActive: item.is_active,
          }
        : {}),
    });
  }, [form, item, open, organizationId, user.organization_id]);

  /** Memuat pegawai dan lokasi dalam satu request master pegawai. */
  useEffect(() => {
    const target = targetOrganizationId || organizationId || user.organization_id;
    if (!open || !target) return;
    fetch(`/api/employees/reference-options?organizationId=${target}`)
      .then((response) => response.json())
      .then((body) =>
        setOptions({
          employees: body.data?.employees || [],
          locations: body.data?.locations || [],
        }),
      )
      .catch(() => onError("Referensi akun tidak dapat dimuat."));
  }, [onError, open, organizationId, targetOrganizationId, user.organization_id]);

  /** Backend memvalidasi password dan konfirmasinya; confirmPassword tidak pernah disimpan. */
  const submit = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(
            editing ? `/api/access/accounts/${item.id}` : "/api/access/accounts",
            {
              method: editing ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...values,
                roleCode: isHrd ? ROLES.EMPLOYEE : values.roleCode,
                locationIds:
                  !isHrd && values.roleCode === "hrd" && values.locationScopeMode === "selected"
                    ? values.locationIds
                    : [],
                locationScopeMode: isHrd ? "all" : values.locationScopeMode,
                ...(editing ? { version: item.updated_at } : {}),
              }),
            },
          );
          const body = await readApiResponse(response);
          await onSaved(body.message);
        },
        { message: "Menyimpan akun organisasi..." },
      );
    } catch (error) {
      applyApiFieldErrors(form, error);
      onError(error.message);
    }
  };

  return (
    <AppModal
      open={open}
      title={
        editing ? "Edit akun organisasi" : isHrd ? "Tambah akun Pegawai" : "Tambah akun organisasi"
      }
      description={
        isHrd
          ? "Akun otomatis menggunakan role Pegawai dan wajib ditautkan ke profil pegawai."
          : "Buat kredensial akses; identitas bersumber dari profil pegawai yang ditautkan."
      }
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="primary" onClick={() => form.submit()}>
            Simpan akun
          </Button>
        </>
      }
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
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
                    : Promise.reject(new Error("Profil pegawai wajib dipilih untuk akun Pegawai.")),
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
        <FormSettingsGroup sx={{ mt: 1 }}>
          <FormSettingSwitch
            name="isActive"
            title="Akun dapat digunakan untuk masuk"
            description="Nonaktifkan jika akses akun perlu dihentikan tanpa menghapus data dan riwayatnya."
          />
        </FormSettingsGroup>
      </Form>
    </AppModal>
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
