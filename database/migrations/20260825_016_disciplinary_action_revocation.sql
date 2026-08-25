-- Menyimpan metadata pencabutan tindakan tanpa menghapus keputusan atau dokumen historis.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM disciplinary_actions WHERE status='revoked') THEN
    RAISE EXCEPTION 'Migration dihentikan: tindakan revoked lama harus dilengkapi metadata pencabutan terlebih dahulu.';
  END IF;
END $$;

ALTER TABLE disciplinary_actions
  ADD COLUMN revoked_at timestamptz,
  ADD COLUMN revoked_by_user_id bigint REFERENCES users(id),
  ADD COLUMN revocation_reason text;

ALTER TABLE disciplinary_actions
  ADD CONSTRAINT ck_disciplinary_action_revocation
  CHECK (
    (status='revoked' AND revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL
      AND length(btrim(revocation_reason)) >= 10)
    OR
    (status<>'revoked' AND revoked_at IS NULL AND revoked_by_user_id IS NULL
      AND revocation_reason IS NULL)
  );

COMMENT ON COLUMN disciplinary_actions.revoked_at IS 'Waktu tindakan aktif dicabut secara logis.';
COMMENT ON COLUMN disciplinary_actions.revoked_by_user_id IS 'HRD/Superadmin yang mencabut tindakan.';
COMMENT ON COLUMN disciplinary_actions.revocation_reason IS 'Alasan wajib pencabutan yang dipertahankan dalam histori.';
