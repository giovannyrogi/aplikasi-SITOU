BEGIN;

-- Penempatan memerlukan versi perubahan agar koreksi tidak menimpa data yang lebih baru.
ALTER TABLE employee_assignments
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE TRIGGER trg_employee_assignments_updated_at
BEFORE UPDATE ON employee_assignments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
