-- Satu pemeriksaan kasus menghasilkan satu tindakan resmi agar histori pelanggaran tidak bercampur.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM disciplinary_actions
    GROUP BY organization_id, discipline_case_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Migration dibatalkan: terdapat kasus disiplin dengan lebih dari satu tindakan. Koreksi data sebelum melanjutkan.';
  END IF;
END $$;

ALTER TABLE disciplinary_actions
  ADD CONSTRAINT uq_disciplinary_action_case UNIQUE (organization_id, discipline_case_id);

COMMENT ON CONSTRAINT uq_disciplinary_action_case ON disciplinary_actions
  IS 'Satu kasus disiplin hanya dapat memiliki satu tindakan resmi.';
