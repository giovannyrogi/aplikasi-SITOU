BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  grace_ends_on date,
  status varchar(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','active','grace','expired','suspended','cancelled')),
  notes text,
  created_by_user_id bigint REFERENCES users(id),
  request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_organization_subscriptions_org_id UNIQUE (organization_id,id),
  CONSTRAINT ck_organization_subscription_dates CHECK (ends_on >= starts_on),
  CONSTRAINT ck_organization_subscription_grace CHECK (grace_ends_on IS NULL OR grace_ends_on >= ends_on)
);

ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS request_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_organization_subscriptions_request') THEN
    ALTER TABLE organization_subscriptions ADD CONSTRAINT uq_organization_subscriptions_request UNIQUE (organization_id,request_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ex_organization_subscriptions_period') THEN
    ALTER TABLE organization_subscriptions ADD CONSTRAINT ex_organization_subscriptions_period EXCLUDE USING gist (
      organization_id WITH =,
      daterange(starts_on,COALESCE(grace_ends_on,ends_on),'[]') WITH &&
    ) WHERE (status NOT IN ('suspended','cancelled'));
  END IF;
END;
$$;

COMMENT ON TABLE organization_subscriptions IS
  'Histori masa penggunaan SITOU per perusahaan; perpanjangan membuat record baru dan tidak menimpa periode lama.';
CREATE INDEX IF NOT EXISTS ix_organization_subscriptions_access ON organization_subscriptions(organization_id,status,starts_on,ends_on,grace_ends_on);
CREATE INDEX IF NOT EXISTS ix_organization_subscriptions_expiring ON organization_subscriptions(ends_on,organization_id) WHERE status='active';
DROP TRIGGER IF EXISTS trg_organization_subscriptions_updated_at ON organization_subscriptions;
CREATE TRIGGER trg_organization_subscriptions_updated_at BEFORE UPDATE ON organization_subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='active_from')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='active_until') THEN
    EXECUTE $sql$
      INSERT INTO organization_subscriptions (organization_id,starts_on,ends_on,status,notes)
      SELECT o.id,o.active_from,o.active_until,
        CASE WHEN (now() AT TIME ZONE o.timezone)::date<o.active_from THEN 'scheduled'
          WHEN (now() AT TIME ZONE o.timezone)::date<=o.active_until THEN 'active' ELSE 'expired' END,
        'Backfill otomatis dari masa akses organisasi lama.'
      FROM organizations o WHERE o.active_until IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM organization_subscriptions os WHERE os.organization_id=o.id)
    $sql$;
    ALTER TABLE organizations ALTER COLUMN active_until DROP NOT NULL;
  END IF;
END;
$$;

ALTER TABLE locations ADD COLUMN IF NOT EXISTS operational_from date;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS operational_until date;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='locations' AND column_name='active_from') THEN
    EXECUTE 'UPDATE locations SET operational_from=COALESCE(operational_from,active_from), operational_until=COALESCE(operational_until,active_until)';
  END IF;
END;
$$;
ALTER TABLE locations ALTER COLUMN operational_from SET DEFAULT current_date;
ALTER TABLE locations ALTER COLUMN operational_from SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_locations_operational_dates') THEN
    ALTER TABLE locations ADD CONSTRAINT ck_locations_operational_dates CHECK (operational_until IS NULL OR operational_until>=operational_from);
  END IF;
END $$;

COMMIT;