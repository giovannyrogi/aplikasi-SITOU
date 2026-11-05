ALTER TABLE work_schedule_sessions
  ADD CONSTRAINT uq_attendance_session_identity UNIQUE (organization_id, employee_id, daily_schedule_id, id);
ALTER TABLE attendance_events
  ADD COLUMN schedule_session_id bigint,
  ADD COLUMN attendance_note text CHECK (char_length(attendance_note) <= 500),
  ADD CONSTRAINT fk_attendance_work_session
    FOREIGN KEY (organization_id, employee_id, daily_schedule_id, schedule_session_id)
    REFERENCES work_schedule_sessions (organization_id, employee_id, daily_schedule_id, id),
  ADD CONSTRAINT ck_mobile_work_session CHECK (schedule_session_id IS NULL OR daily_schedule_id IS NOT NULL);
ALTER TABLE attendance_event_receipts ADD COLUMN payload_hash char(64);
CREATE INDEX ix_attendance_session_events ON attendance_events
  (organization_id, employee_id, schedule_session_id, occurred_at)
  WHERE schedule_session_id IS NOT NULL;
