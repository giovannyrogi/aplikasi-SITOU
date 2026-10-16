/** Nama ringkas pelaku; username dipertahankan utuh ketika profil belum tertaut. */
export function actorDisplayName(profileName, username) {
  const words = String(profileName || "").trim().split(/\s+/).filter(Boolean);
  return words.length > 1 ? `${words[0]} ${words.at(-1)}` : words[0] || username || "Tidak tersedia";
}

/** Alias dan ekspresi berasal dari kode repository, bukan input request. */
export function actorIdentitySql(account, organization, prefix = "actor") {
  const employee = `${prefix}_profile`, platform = `${prefix}_platform`, assignment = `${prefix}_assignment`;
  const normalized = String.raw`regexp_replace(trim(COALESCE(${employee}.full_name,${platform}.full_name)), '\s+', ' ', 'g')`;
  const name = `COALESCE(concat_ws(' ',split_part(${normalized},' ',1),CASE WHEN strpos(${normalized},' ')>0 THEN regexp_replace(${normalized},'^.* ','') END),${account}.username)`;
  // concat_ws(NULL,NULL) menghasilkan string kosong, sehingga fallback eksplisit.
  return {
    name: `COALESCE(NULLIF(${name},''),${account}.username)`,
    photo: `${employee}.profile_photo_file_id::text`,
    position: `${assignment}.position_name`,
    joins: `LEFT JOIN employees ${employee} ON ${employee}.user_id=${account}.id AND ${employee}.organization_id=${organization} AND ${employee}.deleted_at IS NULL
      LEFT JOIN platform_user_profiles ${platform} ON ${platform}.user_id=${account}.id
      LEFT JOIN LATERAL (
        SELECT position.name AS position_name FROM employee_assignments placement
        JOIN organizations organization ON organization.id=placement.organization_id
        LEFT JOIN positions position ON position.organization_id=placement.organization_id AND position.id=placement.position_id
        WHERE placement.organization_id=${organization} AND placement.employee_id=${employee}.id
          AND placement.assignment_type='primary'
          AND placement.effective_from<=(now() AT TIME ZONE organization.timezone)::date
          AND (placement.effective_until IS NULL OR placement.effective_until>=(now() AT TIME ZONE organization.timezone)::date)
        ORDER BY placement.effective_from DESC,placement.id DESC LIMIT 1
      ) ${assignment} ON true`,
    group: `${employee}.full_name,${employee}.profile_photo_file_id,${platform}.full_name,${assignment}.position_name`,
  };
}

export function inventoryActorPhotoUrl(fileId, organizationId, transactionId, view = "transaction", role = "creator") {
  if (!fileId || !organizationId || !transactionId) return null;
  const query = new URLSearchParams({ organizationId: String(organizationId), inventoryActorTransactionId: transactionId, inventoryActorView: view, inventoryActorRole: role });
  return `/api/uploads/${encodeURIComponent(fileId)}?${query}`;
}
