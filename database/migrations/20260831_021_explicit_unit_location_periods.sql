BEGIN;

-- Tanggal efektif relasi unit-lokasi harus ditentukan aplikasi dan tidak boleh tumpang tindih.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM organization_unit_locations first_period
    JOIN organization_unit_locations second_period
      ON second_period.organization_id=first_period.organization_id
     AND second_period.organization_unit_id=first_period.organization_unit_id
     AND second_period.location_id=first_period.location_id
     AND second_period.ctid>first_period.ctid
     AND daterange(
       first_period.active_from,
       COALESCE(first_period.active_until,'infinity'::date),
       '[]'
     ) && daterange(
       second_period.active_from,
       COALESCE(second_period.active_until,'infinity'::date),
       '[]'
     )
  ) THEN
    RAISE EXCEPTION
      'Migration dihentikan: terdapat periode organization_unit_locations yang bertumpang tindih.';
  END IF;
END
$$;

ALTER TABLE organization_unit_locations
  ALTER COLUMN active_from DROP DEFAULT,
  ADD CONSTRAINT ex_unit_locations_period EXCLUDE USING gist (
    organization_id WITH =,
    organization_unit_id WITH =,
    location_id WITH =,
    daterange(active_from,COALESCE(active_until,'infinity'::date),'[]') WITH &&
  );

COMMENT ON COLUMN organization_unit_locations.active_from IS
  'Tanggal efektif eksplisit ketika unit mulai beroperasi pada lokasi; tidak boleh diisi otomatis dari tanggal pencatatan.';

COMMIT;
