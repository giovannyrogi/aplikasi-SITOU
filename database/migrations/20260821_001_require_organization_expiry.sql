BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM organizations WHERE active_until IS NULL) THEN
    RAISE EXCEPTION 'Migration dibatalkan: isi active_until untuk seluruh organisasi lebih dahulu.';
  END IF;
END;
$$;

ALTER TABLE organizations
  ALTER COLUMN active_until SET NOT NULL;

COMMENT ON COLUMN organizations.active_from IS 'Tanggal pertama organisasi dapat memakai SITOU.';
COMMENT ON COLUMN organizations.active_until IS 'Tanggal terakhir organisasi dapat memakai SITOU, bersifat inklusif sesuai timezone organisasi.';

COMMIT;
