"use client";

import { applyApiFieldErrors, readApiResponse } from "@/lib/api/clientError";

import { useCallback, useEffect } from "react";
import { Alert, Button, Form, Input } from "antd";
import { Box, Divider, useTheme } from "@mui/material";
import { useRouter } from "next/navigation";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import FontStyle from "@/app/components/font-style/FontStyle";
import IndonesiaPhoneInput from "@/app/components/forms/IndonesiaPhoneInput";
import Notification from "@/app/components/Notifications/Notification";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import useAppNotification from "@/app/hooks/useAppNotification";
import { PASSWORD_FORM_RULES } from "@/app/utils/passwordRules";
import { getIndonesianMobileFormRules } from "@/lib/validation/indonesianPhone";

const EMPLOYMENT_STATUS_LABELS = {
  active: "Aktif",
  probation: "Masa percobaan",
  leave: "Cuti",
  terminated: "Diberhentikan",
  resigned: "Mengundurkan diri",
  retired: "Pensiun",
  deceased: "Meninggal dunia",
};

export default function ProfilePage() {
  const theme = useTheme();
  const router = useRouter();
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const { runWithLoadingBackdrop, startNavigationLoading } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const identitySource = Form.useWatch("identitySource", profileForm);

  const load = useCallback(async () => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch("/api/account/profile");
          const body = await readApiResponse(response);
          const data = body.data;
          profileForm.setFieldsValue({
            identitySource: data.identity_source,
            username: data.username,
            displayName: data.display_name,
            fullName: data.platform_full_name,
            preferredName: data.preferred_name,
            email: data.platform_email,
            personalEmail: data.personal_email,
            workEmail: data.work_email,
            whatsapp: data.whatsapp,
            employeeNo: data.employee_no,
            employmentStatus:
              EMPLOYMENT_STATUS_LABELS[data.employment_status] || data.employment_status,
            organizationName: data.employee_organization_name,
            locationName: data.location_name,
            organizationUnitName: data.organization_unit_name,
            positionName: data.position_name,
          });
        },
        { message: "Memuat profil..." },
      );
    } catch (error) {
      showNotification(error.message, "error");
    }
  }, [profileForm, runWithLoadingBackdrop, showNotification]);

  useEffect(() => {
    load();
  }, [load]);

  const saveProfile = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const payload =
            identitySource === "platform"
              ? {
                  fullName: values.fullName,
                  email: values.email || null,
                  whatsapp: values.whatsapp || null,
                }
              : {
                  preferredName: values.preferredName || null,
                  personalEmail: values.personalEmail || null,
                  whatsapp: values.whatsapp || null,
                };
          const response = await fetch("/api/account/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const body = await readApiResponse(response);
          showNotification(body.message);
          await load();
        },
        { message: "Menyimpan profil..." },
      );
    } catch (error) {
      applyApiFieldErrors(profileForm, error);
      showNotification(error.message, "error");
    }
  };

  const changePassword = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch("/api/account/password", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
          });
          const body = await readApiResponse(response);
        },
        { message: "Mengubah password..." },
      );
      startNavigationLoading({ message: "Membuka halaman login..." });
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
      router.replace("/login");
    } catch (error) {
      applyApiFieldErrors(passwordForm, error);
      showNotification(error.message, "error");
    }
  };

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader title="Profil" description="Kelola informasi profil dan keamanan akun Anda." />
      <DataPanel
        title="Informasi profil"
        description="Identitas akun mengikuti profil sumber dan tidak disalin ke kredensial login."
      >
        <Form form={profileForm} layout="vertical" onFinish={saveProfile}>
          <Form.Item name="identitySource" hidden>
            <Input />
          </Form.Item>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2,minmax(0,1fr))" },
              gap: { md: "0 16px" },
            }}
          >
            <Form.Item name="username" label="Username">
              <Input disabled />
            </Form.Item>
            <Form.Item name="displayName" label="Nama tampilan">
              <Input disabled />
            </Form.Item>
            {identitySource === "platform" ? (
              <>
                <Form.Item
                  name="fullName"
                  label="Nama lengkap"
                  rules={[{ required: true, min: 2 }]}
                >
                  <Input maxLength={200} />
                </Form.Item>
                <Form.Item name="email" label="Email tambahan" rules={[{ type: "email" }]}>
                  <Input />
                </Form.Item>
              </>
            ) : identitySource === "employee" ? (
              <>
                <Form.Item name="employeeNo" label="NIP">
                  <Input disabled />
                </Form.Item>
                <Form.Item name="employmentStatus" label="Status kepegawaian">
                  <Input disabled />
                </Form.Item>
                <Form.Item name="organizationName" label="Organisasi">
                  <Input disabled />
                </Form.Item>
                <Form.Item name="locationName" label="Lokasi aktif">
                  <Input disabled placeholder="Belum ada penempatan aktif" />
                </Form.Item>
                <Form.Item name="organizationUnitName" label="Divisi & Unit aktif">
                  <Input disabled placeholder="Belum ada penempatan aktif" />
                </Form.Item>
                <Form.Item name="positionName" label="Jabatan aktif">
                  <Input disabled placeholder="Belum ada penempatan aktif" />
                </Form.Item>
                <Form.Item name="workEmail" label="Email kerja">
                  <Input disabled />
                </Form.Item>
                <Form.Item name="preferredName" label="Nama panggilan">
                  <Input maxLength={100} />
                </Form.Item>
                <Form.Item name="personalEmail" label="Email pribadi" rules={[{ type: "email" }]}>
                  <Input />
                </Form.Item>
              </>
            ) : null}
            {identitySource !== "username" ? (
              <Form.Item
                name="whatsapp"
                label="Nomor WhatsApp"
                rules={getIndonesianMobileFormRules()}
              >
                <IndonesiaPhoneInput />
              </Form.Item>
            ) : null}
          </Box>
          {identitySource === "username" ? (
            <Alert
              type="warning"
              showIcon
              title="Akun belum terhubung ke profil pegawai. Informasi pribadi dan pemulihan WhatsApp belum tersedia."
            />
          ) : (
            <Button type="primary" htmlType="submit">
              Simpan profil
            </Button>
          )}
        </Form>
      </DataPanel>

      <DataPanel
        title="Keamanan akun"
        description="Mengubah password akan mengakhiri seluruh session lama."
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={changePassword}
          style={{ maxWidth: 560 }}
        >
          <Form.Item name="currentPassword" label="Password saat ini" rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item name="newPassword" label="Password baru" rules={PASSWORD_FORM_RULES}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Konfirmasi password"
            dependencies={["newPassword"]}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue("newPassword") === value
                    ? Promise.resolve()
                    : Promise.reject(new Error("Konfirmasi password tidak sama."));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Divider sx={{ my: 2, borderColor: theme.ui.panelBorderSubtle }} />
          <Button type="primary" htmlType="submit">
            Ubah password
          </Button>
        </Form>
      </DataPanel>
      <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
        Perubahan profil dan keamanan dicatat pada audit SITOU.
      </FontStyle>
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
