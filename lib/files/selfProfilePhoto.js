import pool from "@/lib/dbConfig";
import { ServiceError } from "@/lib/api/routeHelpers";
import { getStoredFile } from "@/lib/files/storage";

/** Identitas dan referensi pas foto selalu berasal dari akun pada session server. */
export async function getSelfProfilePhoto(user, database = pool) {
  if (!user.organization_id || !user.employee_id)
    throw new ServiceError("PROFILE_PHOTO_NOT_FOUND", "Pas foto profil belum tersedia.", 404);
  const result = await database.query(
    `SELECT file.id::text FROM employees employee
     JOIN stored_files file ON file.organization_id=employee.organization_id
       AND file.id=employee.profile_photo_file_id AND file.employee_id=employee.id
     WHERE employee.organization_id=$1 AND employee.id=$2 AND employee.user_id=$3
       AND employee.deleted_at IS NULL AND file.deleted_at IS NULL
       AND file.category='employee_photo' AND file.lifecycle_status='active'
       AND file.content_purged_at IS NULL AND file.onboarding_draft_id IS NULL`,
    [user.organization_id, user.employee_id, user.id],
  );
  if (!result.rows[0])
    throw new ServiceError("PROFILE_PHOTO_NOT_FOUND", "Pas foto profil belum tersedia.", 404);
  return getStoredFile(result.rows[0].id, user.organization_id, database);
}
