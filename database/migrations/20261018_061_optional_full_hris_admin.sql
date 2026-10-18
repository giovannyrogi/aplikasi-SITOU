-- HRIS tetap dapat digunakan tanpa admin HRD penuh yang sedang ditetapkan.
ALTER TABLE organization_hris_access_policies
  DROP CONSTRAINT IF EXISTS organization_hris_access_policies_check;

COMMENT ON COLUMN organization_hris_access_policies.primary_membership_id IS
  'NULL berarti belum ada admin HRD penuh; grant HRIS eksplisit tetap berlaku.';
