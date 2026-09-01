BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM leave_types
    WHERE annual_allowance IS NOT NULL AND annual_allowance <> trunc(annual_allowance)
  ) OR EXISTS (
    SELECT 1 FROM leave_requests
    WHERE requested_units <> trunc(requested_units)
  ) OR EXISTS (
    SELECT 1 FROM leave_balance_transactions
    WHERE units <> trunc(units)
  ) THEN
    RAISE EXCEPTION 'Masih ada jatah, durasi, atau transaksi saldo cuti dalam pecahan. Koreksi data tersebut sebelum menjalankan migration ini.';
  END IF;
END $$;

ALTER TABLE leave_types
  ALTER COLUMN annual_allowance TYPE integer USING annual_allowance::integer;

ALTER TABLE leave_requests
  ALTER COLUMN requested_units TYPE integer USING requested_units::integer;

ALTER TABLE leave_balance_transactions
  ALTER COLUMN units TYPE integer USING units::integer;

COMMIT;
