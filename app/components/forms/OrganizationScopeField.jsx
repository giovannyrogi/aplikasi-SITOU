"use client";

import { Form, Input } from "antd";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { ROLES } from "@/app/constants/roles";

/**
 * Menampilkan pemilih organisasi untuk Superadmin dan nilai session yang terkunci
 * untuk HRD, sambil tetap menyimpan organizationId pada payload form.
 */
export default function OrganizationScopeField({ disabled = false }) {
  const user = useAuthenticatedUser();
  const locked = user.role_code !== ROLES.SUPERADMIN;

  if (locked) {
    return (
      <>
        <Form.Item name="organizationId" hidden>
          <Input />
        </Form.Item>
        <Form.Item label="Organisasi">
          <Input value={user.organization_name || "Organisasi Anda"} disabled />
        </Form.Item>
      </>
    );
  }

  return (
    <Form.Item name="organizationId" label="Organisasi" rules={[{ required: true }]}>
      <OrganizationSelect disabled={disabled} />
    </Form.Item>
  );
}
