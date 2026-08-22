BEGIN;

ALTER TABLE employment_types
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_employment_types_updated_at ON employment_types;
CREATE TRIGGER trg_employment_types_updated_at
BEFORE UPDATE ON employment_types
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
