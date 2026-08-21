BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM organizations o
    WHERE NOT EXISTS (SELECT 1 FROM organization_subscriptions os WHERE os.organization_id=o.id)
  ) THEN
    RAISE EXCEPTION 'Contract dibatalkan: masih ada organisasi tanpa histori langganan.';
  END IF;
  IF EXISTS (SELECT 1 FROM locations WHERE operational_from IS NULL) THEN
    RAISE EXCEPTION 'Contract dibatalkan: masih ada lokasi tanpa operational_from.';
  END IF;
END;
$$;

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS ck_organizations_dates;
ALTER TABLE organizations DROP COLUMN IF EXISTS active_from, DROP COLUMN IF EXISTS active_until;
ALTER TABLE locations DROP CONSTRAINT IF EXISTS ck_locations_dates;
ALTER TABLE locations DROP COLUMN IF EXISTS active_from, DROP COLUMN IF EXISTS active_until;

COMMIT;
