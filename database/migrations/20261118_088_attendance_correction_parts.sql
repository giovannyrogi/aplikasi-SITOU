-- Expand the existing request lifecycle; raw attendance evidence remains immutable.
ALTER TABLE attendance_correction_requests
  ALTER COLUMN source_event_date DROP NOT NULL,
  ALTER COLUMN source_event_id DROP NOT NULL,
  ALTER COLUMN requested_checkout_at DROP NOT NULL,
  ADD COLUMN requested_checkin_at timestamptz,
  ADD COLUMN correction_part varchar(12) NOT NULL DEFAULT 'departure',
  ADD COLUMN session_key varchar(120),
  ADD COLUMN basis_snapshot jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN payload_hash varchar(64);

UPDATE attendance_correction_requests q SET session_key = CASE
  WHEN a.schedule_session_id IS NOT NULL THEN 'scheduled:' || s.session_no
  WHEN a.work_context = 'outside_schedule' THEN 'outside:' || a.outside_schedule_session_no
  WHEN a.work_context = 'holiday_work' THEN 'holiday'
  ELSE 'legacy:' || a.event_date || ':' || a.id END
FROM attendance_events a
LEFT JOIN work_schedule_sessions s ON (s.organization_id,s.employee_id,s.id) =
  (a.organization_id,a.employee_id,a.schedule_session_id)
WHERE (q.source_event_date,q.source_event_id)=(a.event_date,a.id);

ALTER TABLE attendance_correction_requests
  ALTER COLUMN session_key SET NOT NULL,
  ADD CONSTRAINT ck_correction_source_pair CHECK ((source_event_date IS NULL) = (source_event_id IS NULL)),
  ADD CONSTRAINT ck_correction_parts CHECK (
    (correction_part='arrival' AND requested_checkin_at IS NOT NULL AND requested_checkout_at IS NULL) OR
    (correction_part='departure' AND requested_checkin_at IS NULL AND requested_checkout_at IS NOT NULL) OR
    (correction_part='both' AND requested_checkin_at IS NOT NULL AND requested_checkout_at > requested_checkin_at)
  );
DROP INDEX uq_attendance_open_correction;
CREATE UNIQUE INDEX uq_attendance_open_correction
  ON attendance_correction_requests(organization_id,employee_id,work_date,session_key)
  WHERE status='pending';
COMMENT ON COLUMN attendance_correction_requests.basis_snapshot IS
  'Jadwal dan jam asli saat pengajuan; tidak menggantikan event mentah. Dasar pemeriksaan perubahan sebelum keputusan HRD.';
COMMENT ON TABLE attendance_correction_requests IS
  'Pengajuan koreksi masuk, pulang, atau keduanya untuk satu tanggal kerja dan sesi; tidak mengubah event/rekap sebelum keputusan HRD.';
