-- Bekukan hak HRD lama sebagai grant eksplisit sebelum fallback role dihapus.
-- Membership yang pernah ditinjau tidak disentuh, termasuk grant kosong.
CREATE TEMP TABLE hris_access_backfill_targets ON COMMIT DROP AS
SELECT membership.organization_id, membership.id AS membership_id,
       NOT COALESCE(policy.enabled, false) AS had_legacy_access
FROM user_organization_roles membership
JOIN roles role ON role.id = membership.role_id AND role.code = 'hrd'
LEFT JOIN organization_hris_access_policies policy
  ON policy.organization_id = membership.organization_id
WHERE NOT EXISTS (
  SELECT 1 FROM user_hris_access_settings settings
  WHERE settings.organization_id = membership.organization_id
    AND settings.membership_id = membership.id
);

-- Sebelum migration, akun tanpa policy aktif memperoleh semua menu dari fallback.
INSERT INTO user_hris_menu_grants (organization_id, membership_id, menu_code, access_level)
SELECT target.organization_id, target.membership_id, menu.code,
       CASE WHEN menu.can_manage THEN 'manage' ELSE 'read' END
FROM hris_access_backfill_targets target
CROSS JOIN hris_menu_definitions menu
WHERE target.had_legacy_access
ON CONFLICT (organization_id, membership_id, menu_code)
DO UPDATE SET access_level = EXCLUDED.access_level;

-- Fallback lama juga mengizinkan pengelolaan akun dan delegasi fitur.
-- Organisasi yang policy-nya sudah aktif tetap mempertahankan flag default nonaktif.
INSERT INTO user_hris_access_settings (
  organization_id, membership_id,
  can_manage_employee_accounts, can_delegate_employee_features
)
SELECT organization_id, membership_id, had_legacy_access, had_legacy_access
FROM hris_access_backfill_targets
ON CONFLICT (organization_id, membership_id) DO NOTHING;
