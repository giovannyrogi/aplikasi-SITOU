BEGIN;

-- Koreksi kontrak harus tetap dapat diaudit dan pembatalan tidak boleh menghapus histori.
ALTER TABLE employment_contracts
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancellation_reason text,
  ADD COLUMN cancelled_by_user_id bigint REFERENCES users(id);

ALTER TABLE employment_contracts
  DROP CONSTRAINT employment_contracts_status_check,
  ADD CONSTRAINT employment_contracts_status_check
    CHECK (status IN ('draft','active','expired','terminated','renewed','cancelled')),
  ADD CONSTRAINT ck_contract_cancellation
    CHECK (
      status <> 'cancelled'
      OR (cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL AND cancelled_by_user_id IS NOT NULL)
    );

CREATE TRIGGER trg_employment_contracts_updated_at
BEFORE UPDATE ON employment_contracts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
