"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Form, Input, Select, Tag } from "antd";
import { Avatar, Box, Paper, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import PageHeader from "@/app/components/layout/PageHeader";
import AppModal from "@/app/components/modals/AppModal";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import FontStyle from "@/app/components/font-style/FontStyle";
import IndonesiaPhoneInput from "@/app/components/forms/IndonesiaPhoneInput";
import Notification from "@/app/components/Notifications/Notification";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import useAppNotification from "@/app/hooks/useAppNotification";
import { ROLE_LABELS, ROLES } from "@/app/constants/roles";
import { PASSWORD_FORM_RULES } from "@/app/utils/passwordRules";
import { applyApiFieldErrors, readApiResponse } from "@/lib/api/clientError";
import { getIndonesianMobileFormRules } from "@/lib/validation/indonesianPhone";
import { waitForMinimumDuration } from "@/lib/ui/minimumDuration.mjs";

const SELF_LINK_ROLES = new Set([ROLES.HRD, ROLES.LEADER]);

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "U";

function AccountInfo({ icon, label, value }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        minWidth: 0,
        display: "grid",
        gridTemplateColumns: "38px minmax(0, 1fr)",
        gap: 1.25,
        alignItems: "center",
        p: 1.5,
        border: `1px solid ${theme.ui.panelBorderSubtle}`,
        borderRadius: 2,
        bgcolor: theme.ui.navItemHover,
      }}
    >
      <Box
        sx={{
          width: 38,
          height: 38,
          display: "grid",
          placeItems: "center",
          borderRadius: 2,
          color: theme.palette.primary.main,
          bgcolor: theme.ui.iconButtonBg,
        }}
      >
        <Icon icon={icon} fontSize={21} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <FontStyle fontSize={11} sx={{ color: theme.ui.mutedText }}>
          {label}
        </FontStyle>
        <FontStyle fontSize={13} fontWeight={600} noWrap title={value || "-"}>
          {value || "-"}
        </FontStyle>
      </Box>
    </Box>
  );
}

function ProfileActionCard({ icon, title, description, buttonText, onClick, disabled = false }) {
  const theme = useTheme();
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{
        minWidth: 0,
        minHeight: 210,
        p: { xs: 2, sm: 2.5 },
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${theme.ui.panelBorder}`,
        borderRadius: 2,
        boxShadow: theme.ui.panelShadow,
      }}
    >
      <Box
        sx={{
          width: 42,
          height: 42,
          display: "grid",
          placeItems: "center",
          mb: 1.75,
          borderRadius: 2,
          color: theme.palette.primary.main,
          bgcolor: theme.ui.iconButtonBg,
        }}
      >
        <Icon icon={icon} fontSize={23} />
      </Box>
      <FontStyle component="h2" fontSize={15} fontWeight={700}>
        {title}
      </FontStyle>
      <FontStyle
        fontSize={12}
        sx={{ mt: 0.75, mb: 2, color: theme.ui.mutedText, lineHeight: 1.65 }}
      >
        {description}
      </FontStyle>
      <Button block disabled={disabled} onClick={onClick} style={{ marginTop: "auto" }}>
        {buttonText}
      </Button>
    </Paper>
  );
}

export default function ProfilePage() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAuthenticatedUser();
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [linkForm] = Form.useForm();
  const [profile, setProfile] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkOptions, setLinkOptions] = useState([]);
  const [linkOptionsLoading, setLinkOptionsLoading] = useState(false);
  const [pendingLink, setPendingLink] = useState(null);
  const { runWithLoadingBackdrop, startNavigationLoading } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();

  const profileLinked = profile?.identity_source === "employee";
  const canSelfLink = SELF_LINK_ROLES.has(user.role_code);
  const canEditProfile = profile?.editable_fields?.length > 0;
  const displayName = profileLinked
    ? profile?.full_name || profile?.display_name
    : profile?.platform_full_name || profile?.username || user.username;
  const roleLabel = ROLE_LABELS[user.role_code] || user.role_code;
  const positionLabel = profileLinked
    ? profile?.position_name || "Jabatan belum ditentukan"
    : roleLabel;

  const loadProfile = useCallback(async () => {
    try {
      const response = await fetch("/api/account/profile");
      const body = await readApiResponse(response);
      setProfile(body.data);
      return body.data;
    } catch (error) {
      showNotification(error.message, "error");
      return null;
    }
  }, [showNotification]);

  useEffect(() => {
    runWithLoadingBackdrop(loadProfile, { message: "Memuat profil..." });
  }, [loadProfile, runWithLoadingBackdrop]);

  const profileInfo = useMemo(
    () => [
      { icon: "solar:user-id-bold-duotone", label: "Username", value: profile?.username },
      { icon: "solar:shield-user-bold-duotone", label: "Hak akses", value: roleLabel },
      {
        icon: "solar:link-circle-bold-duotone",
        label: "Profil pegawai",
        value: profileLinked ? "Sudah dikaitkan" : "Belum dikaitkan",
      },
      {
        icon: "solar:case-round-bold-duotone",
        label: profileLinked ? "Jabatan aktif" : "Organisasi",
        value: profileLinked ? positionLabel : user.organization_name || "Akun platform",
      },
    ],
    [positionLabel, profile, profileLinked, roleLabel, user.organization_name],
  );

  const openProfileModal = () => {
    profileForm.setFieldsValue({
      fullName: profile?.platform_full_name,
      preferredName: profile?.preferred_name,
      email: profile?.platform_email,
      personalEmail: profile?.personal_email,
      whatsapp: profile?.whatsapp,
    });
    setProfileModalOpen(true);
  };

  const saveProfile = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const payload =
            profile.identity_source === "platform"
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
          setProfile(body.data);
          setProfileModalOpen(false);
          showNotification(body.message);
          router.refresh();
        },
        { message: "Menyimpan profil..." },
      );
    } catch (error) {
      applyApiFieldErrors(profileForm, error);
      showNotification(error.message, "error");
    }
  };

  const openLinkModal = async () => {
    setLinkModalOpen(true);
    setLinkOptionsLoading(true);
    linkForm.resetFields();
    try {
      const response = await fetch("/api/account/profile/link");
      const body = await readApiResponse(response);
      setLinkOptions(body.data || []);
    } catch (error) {
      showNotification(error.message, "error");
      setLinkModalOpen(false);
    } finally {
      setLinkOptionsLoading(false);
    }
  };

  const requestLinkConfirmation = ({ employeeId }) => {
    const option = linkOptions.find((item) => String(item.id) === String(employeeId));
    setPendingLink({ employeeId, name: option?.full_name || "profil yang dipilih" });
  };

  const linkProfile = async () => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch("/api/account/profile/link", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employeeId: pendingLink.employeeId }),
          });
          const body = await readApiResponse(response);
          setProfile(body.data);
          setPendingLink(null);
          setLinkModalOpen(false);
          showNotification(body.message);
          router.refresh();
        },
        { message: "Mengaitkan profil..." },
      );
    } catch (error) {
      applyApiFieldErrors(linkForm, error);
      setPendingLink(null);
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
          await readApiResponse(response);
          const startedAt = Date.now();
          startNavigationLoading({ message: "Password berhasil diubah. Mengakhiri sesi..." });
          await Promise.all([
            fetch("/api/auth/logout", { method: "POST" }).catch(() => null),
            waitForMinimumDuration(startedAt),
          ]);
          startNavigationLoading({ message: "Membuka halaman login..." });
          router.replace("/login");
        },
        { message: "Mengubah password..." },
      );
    } catch (error) {
      applyApiFieldErrors(passwordForm, error);
      showNotification(error.message, "error");
    }
  };

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="Profil akun"
        description="Lihat identitas akun, profil pegawai, dan pengaturan keamanan Anda."
      />

      <Paper
        component="section"
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5, lg: 3 },
          border: `1px solid ${theme.ui.panelBorder}`,
          borderRadius: 2,
          boxShadow: theme.ui.panelShadow,
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "auto minmax(0, 1fr)" },
            gap: 2,
            alignItems: "center",
          }}
        >
          <Avatar
            sx={{
              width: 64,
              height: 64,
              bgcolor: theme.palette.primary.main,
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {getInitials(displayName)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <FontStyle component="h1" fontSize={{ xs: 20, sm: 23 }} fontWeight={700}>
              {displayName || "Memuat profil..."}
            </FontStyle>
            <Box sx={{ mt: 0.75, display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              <Tag color="red">{roleLabel}</Tag>
              <Tag color={profile?.is_active ? "green" : "default"}>
                {profile?.is_active ? "Akun aktif" : "Akun tidak aktif"}
              </Tag>
              {profileLinked ? <Tag color="blue">Profil terhubung</Tag> : null}
            </Box>
          </Box>
        </Box>
        <Box
          sx={{
            mt: 2.5,
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2,minmax(0,1fr))" },
            gap: 1.25,
          }}
        >
          {profileInfo.map((item) => (
            <AccountInfo key={item.label} {...item} />
          ))}
        </Box>
      </Paper>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3,minmax(0,1fr))" },
          gap: 2,
        }}
      >
        <ProfileActionCard
          icon="solar:user-id-bold-duotone"
          title="Data profil"
          description={
            canEditProfile
              ? "Perbarui nama panggilan dan kontak yang digunakan pada identitas akun Anda."
              : "Data pribadi belum dapat diubah sampai akun terhubung ke profil pegawai."
          }
          buttonText={canEditProfile ? "Ubah data profil" : "Belum tersedia"}
          disabled={!canEditProfile}
          onClick={openProfileModal}
        />

        {canSelfLink && !profileLinked ? (
          <ProfileActionCard
            icon="solar:link-circle-bold-duotone"
            title="Kaitkan profil pegawai"
            description="Pilih profil milik Anda agar nama lengkap, jabatan, dan data pribadi digunakan oleh akun ini."
            buttonText="Pilih profil saya"
            onClick={openLinkModal}
          />
        ) : (
          <ProfileActionCard
            icon="solar:verified-check-bold-duotone"
            title="Profil pegawai"
            description={
              profileLinked
                ? `Akun telah dikaitkan ke ${profile?.full_name}. Perubahan kaitan dikelola oleh HRD melalui Akun & Akses.`
                : user.role_code === ROLES.EMPLOYEE
                  ? "Akun Pegawai dikaitkan ke profil oleh HRD melalui menu Akun & Akses."
                  : "Akun ini tidak memerlukan kaitan ke profil pegawai."
            }
            buttonText={profileLinked ? "Sudah dikaitkan" : "Informasi saja"}
            disabled
          />
        )}

        <ProfileActionCard
          icon="solar:lock-password-bold-duotone"
          title="Keamanan akun"
          description="Ubah password akun. Setelah berhasil, seluruh sesi lama akan diakhiri untuk menjaga keamanan."
          buttonText="Ubah password"
          onClick={() => {
            passwordForm.resetFields();
            setPasswordModalOpen(true);
          }}
        />
      </Box>

      <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
        Perubahan profil, pengaitan identitas, dan keamanan dicatat pada audit SITOU.
      </FontStyle>

      <ProfileEditModal
        open={profileModalOpen}
        profile={profile}
        form={profileForm}
        onClose={() => setProfileModalOpen(false)}
        onSubmit={saveProfile}
      />
      <ProfileLinkModal
        open={linkModalOpen}
        form={linkForm}
        options={linkOptions}
        loading={linkOptionsLoading}
        onClose={() => setLinkModalOpen(false)}
        onSubmit={requestLinkConfirmation}
      />
      <PasswordModal
        open={passwordModalOpen}
        form={passwordForm}
        onClose={() => setPasswordModalOpen(false)}
        onSubmit={changePassword}
      />
      <ConfirmDialog
        open={Boolean(pendingLink)}
        title="Kaitkan akun ke profil ini?"
        message={`Akun ${profile?.username || "ini"} akan menggunakan identitas ${pendingLink?.name || "profil yang dipilih"}. Pastikan profil tersebut benar-benar milik Anda.`}
        confirmText="Ya, kaitkan profil"
        onClose={() => setPendingLink(null)}
        onConfirm={linkProfile}
      />
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}

function ProfileEditModal({ open, profile, form, onClose, onSubmit }) {
  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Ubah data profil"
      description="Perbarui informasi kontak yang digunakan pada profil Anda."
      icon="solar:user-id-bold-duotone"
      size="md"
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="primary" onClick={() => form.submit()}>
            Simpan perubahan
          </Button>
        </>
      }
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" },
            gap: { sm: "0 16px" },
          }}
        >
          {profile?.identity_source === "platform" ? (
            <>
              <Form.Item name="fullName" label="Nama lengkap" rules={[{ required: true, min: 2 }]}>
                <Input maxLength={200} />
              </Form.Item>
              <Form.Item name="email" label="Email" rules={[{ type: "email" }]}>
                <Input />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item name="preferredName" label="Nama panggilan">
                <Input maxLength={100} />
              </Form.Item>
              <Form.Item name="personalEmail" label="Email pribadi" rules={[{ type: "email" }]}>
                <Input />
              </Form.Item>
            </>
          )}
          <Form.Item name="whatsapp" label="Nomor WhatsApp" rules={getIndonesianMobileFormRules()}>
            <IndonesiaPhoneInput />
          </Form.Item>
        </Box>
      </Form>
    </AppModal>
  );
}

function ProfileLinkModal({ open, form, options, loading, onClose, onSubmit }) {
  const theme = useTheme();
  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Kaitkan profil pegawai"
      description="Pilih profil yang benar-benar milik Anda. Kaitan ini tidak dapat diubah sendiri setelah disimpan."
      icon="solar:link-circle-bold-duotone"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="primary" onClick={() => form.submit()}>
            Lanjutkan
          </Button>
        </>
      }
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item
          name="employeeId"
          label="Profil pegawai saya"
          rules={[{ required: true, message: "Pilih profil pegawai Anda." }]}
        >
          <Select
            showSearch
            loading={loading}
            placeholder="Cari nama profil"
            optionFilterProp="label"
            notFoundContent={loading ? "Memuat profil..." : "Tidak ada profil yang dapat dikaitkan"}
            options={options.map((item) => ({
              value: item.id,
              label: item.full_name,
              detail: [item.employee_no, item.position_name].filter(Boolean).join(" - "),
            }))}
            optionRender={(option) => (
              <Box sx={{ py: 0.35 }}>
                <FontStyle fontSize={12.5} fontWeight={600}>
                  {option.label}
                </FontStyle>
                {option.data.detail ? (
                  <FontStyle fontSize={11} sx={{ color: theme.ui.mutedText }}>
                    {option.data.detail}
                  </FontStyle>
                ) : null}
              </Box>
            )}
          />
        </Form.Item>
        <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText, lineHeight: 1.65 }}>
          Profil yang sudah memiliki akun tidak ditampilkan. HRD hanya melihat profil dalam cakupan
          lokasinya.
        </FontStyle>
      </Form>
    </AppModal>
  );
}

function PasswordModal({ open, form, onClose, onSubmit }) {
  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Ubah password"
      description="Gunakan password saat ini untuk memastikan perubahan dilakukan oleh pemilik akun."
      icon="solar:lock-password-bold-duotone"
      size="md"
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="primary" onClick={() => form.submit()}>
            Ubah password
          </Button>
        </>
      }
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item
          name="currentPassword"
          label="Password saat ini"
          rules={[{ required: true, message: "Password saat ini wajib diisi." }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" },
            gap: { sm: "0 16px" },
          }}
        >
          <Form.Item name="newPassword" label="Password baru" rules={PASSWORD_FORM_RULES}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Konfirmasi password"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "Konfirmasi password wajib diisi." },
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
        </Box>
      </Form>
    </AppModal>
  );
}
