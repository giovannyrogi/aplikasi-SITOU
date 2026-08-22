BEGIN;

-- Tanpa seed/backfill tidak ada pemetaan yang aman dari enum lama ke master baru.
-- Batalkan migration sebelum mengubah schema bila unit organisasi sudah berisi data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM organization_units LIMIT 1) THEN
    RAISE EXCEPTION
      'Migration dibatalkan: organization_units sudah berisi data. Petakan data lama sebelum mengganti unit_type.';
  END IF;
END;
$$;

-- Master jenis unit dipisahkan per organisasi agar istilah struktur dapat disesuaikan
-- tanpa menerima teks bebas langsung pada setiap record organization_units.
CREATE TABLE organization_unit_types (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id),
  code varchar(40) NOT NULL,
  name varchar(100) NOT NULL,
  description text,
  sort_order smallint NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_organization_unit_types_org_code UNIQUE (organization_id,code),
  CONSTRAINT uq_organization_unit_types_org_id UNIQUE (organization_id,id),
  CONSTRAINT ck_organization_unit_types_code
    CHECK (code = btrim(code) AND code ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT ck_organization_unit_types_name
    CHECK (name = btrim(name) AND char_length(name) BETWEEN 2 AND 100),
  CONSTRAINT ck_organization_unit_types_sort_order CHECK (sort_order >= 0)
);

COMMENT ON TABLE organization_unit_types IS
  'Master jenis struktur organisasi yang dapat disesuaikan pada setiap organisasi.';
COMMENT ON COLUMN organization_unit_types.code IS
  'Kode stabil dan uppercase untuk integrasi serta validasi aplikasi.';
COMMENT ON COLUMN organization_unit_types.is_active IS
  'Jenis nonaktif tetap dipertahankan untuk histori tetapi tidak dipilih pada unit baru.';

-- Nama dibandingkan tanpa memperhatikan kapital dan spasi tepi agar istilah ganda
-- seperti Direksi dan direksi tidak dapat dibuat pada organisasi yang sama.
CREATE UNIQUE INDEX uq_organization_unit_types_org_name_ci
  ON organization_unit_types (organization_id,lower(btrim(name)));

CREATE INDEX ix_organization_unit_types_active_list
  ON organization_unit_types (organization_id,sort_order,name,id)
  WHERE is_active=true;

CREATE TRIGGER trg_organization_unit_types_updated_at
BEFORE UPDATE ON organization_unit_types
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Ganti enum teks lama dengan foreign key master sebagai satu-satunya sumber jenis.
ALTER TABLE organization_units
  DROP COLUMN unit_type,
  ADD COLUMN unit_type_id bigint NOT NULL;

ALTER TABLE organization_units
  ADD CONSTRAINT fk_organization_units_type
  FOREIGN KEY (organization_id,unit_type_id)
  REFERENCES organization_unit_types(organization_id,id);

CREATE INDEX ix_organization_units_type
  ON organization_units (organization_id,unit_type_id);

COMMIT;
