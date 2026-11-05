import { ServiceError } from "@/lib/api/routeHelpers";

/** Gerbang fitur, terpisah dari izin pelaku. Identitas organisasi harus sudah diverifikasi pemanggil. */
export async function requireAttendanceModule(database, organizationId) {
  const result = await database.query(
    `SELECT module.is_enabled FROM organization_modules module
     JOIN organizations organization ON organization.id=module.organization_id AND organization.is_active
     WHERE module.organization_id=$1 AND module.module_code='attendance'`,
    [organizationId],
  );
  if (!result.rows[0]?.is_enabled)
    throw new ServiceError(
      "ATTENDANCE_DISABLED",
      "Fitur Absensi belum aktif. Hubungi Admin SITOU untuk mengaktifkannya.",
      403,
    );
}
