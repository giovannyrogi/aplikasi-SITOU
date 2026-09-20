-- Mendukung laporan organisasi lintas pegawai tanpa memasukkan draft ke jalur baca resmi.
CREATE INDEX ix_actions_official_report
  ON disciplinary_actions(organization_id, issued_date DESC, employee_id, id DESC)
  INCLUDE (discipline_case_id, action_type, status, effective_from, effective_until)
  WHERE status <> 'draft';

COMMENT ON INDEX ix_actions_official_report IS
  'Pemindaian laporan tindakan resmi per organisasi dan tanggal; draft sengaja dikecualikan.';
