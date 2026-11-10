-- Attendance on days off is opt-in per effective schedule definition.
ALTER TABLE shift_patterns ADD COLUMN allow_holiday_attendance boolean NOT NULL DEFAULT false;
ALTER TABLE work_schedule_groups ADD COLUMN allow_holiday_attendance boolean NOT NULL DEFAULT false;
ALTER TABLE work_schedule_definition_revisions ADD COLUMN allow_holiday_attendance boolean NOT NULL DEFAULT false;
ALTER TABLE employee_daily_schedules ADD COLUMN allow_holiday_attendance boolean NOT NULL DEFAULT false;

ALTER TABLE attendance_events
  ADD COLUMN work_context varchar(20) NOT NULL DEFAULT 'scheduled'
    CHECK (work_context IN ('scheduled','holiday_work')),
  DROP CONSTRAINT attendance_events_assessment_version_check,
  DROP CONSTRAINT attendance_events_timing_category_check,
  DROP CONSTRAINT ck_attendance_assessment_complete,
  DROP CONSTRAINT ck_attendance_timing_action;
ALTER TABLE attendance_events
  ADD CHECK (assessment_version IN (1,2)),
  ADD CHECK (timing_category IN ('on_time','early_check_in','late_check_in','early_check_out','late_check_out','flexible_check_in','not_applicable')),
  ADD CONSTRAINT ck_attendance_assessment_complete CHECK (
    assessment_version IS NULL OR (
      source='mobile' AND event_type IN ('check_in','check_out')
      AND point_location_id_snapshot IS NOT NULL AND point_name_snapshot IS NOT NULL
      AND point_latitude_snapshot IS NOT NULL AND point_longitude_snapshot IS NOT NULL
      AND max_accuracy_m_snapshot IS NOT NULL AND organization_timezone_snapshot IS NOT NULL
      AND allowed_radius_m IS NOT NULL AND allowed_radius_m>0
      AND ((assessment_version=1 AND work_context='scheduled' AND schedule_session_id IS NOT NULL
        AND timing_category IS NOT NULL AND timing_category<>'not_applicable'
        AND schedule_reference_at IS NOT NULL AND schedule_offset_seconds IS NOT NULL
        AND early_arrival_minutes IS NOT NULL AND late_minutes IS NOT NULL
        AND early_leave_minutes IS NOT NULL AND late_departure_minutes IS NOT NULL)
      OR (assessment_version=2 AND work_context='holiday_work' AND daily_schedule_id IS NOT NULL
        AND schedule_session_id IS NULL AND timing_category IS NOT NULL AND timing_category='not_applicable'
        AND schedule_reference_at IS NULL AND schedule_offset_seconds IS NULL
        AND early_arrival_minutes IS NULL AND late_minutes IS NULL
        AND early_leave_minutes IS NULL AND late_departure_minutes IS NULL
        AND length(btrim(attendance_note))>0))
    )
  ),
  ADD CONSTRAINT ck_attendance_holiday_evidence CHECK (
    work_context<>'holiday_work' OR (assessment_version IS NOT NULL AND assessment_version=2 AND attendance_note IS NOT NULL)
  ),
  ADD CONSTRAINT ck_attendance_timing_action CHECK (
    timing_category IS NULL OR timing_category='not_applicable' OR
    (event_type='check_in' AND timing_category IN ('on_time','early_check_in','late_check_in','flexible_check_in')) OR
    (event_type='check_out' AND timing_category IN ('on_time','early_check_out','late_check_out'))
  );

ALTER TABLE attendance_daily_summaries
  ADD COLUMN worked_on_day_off boolean NOT NULL DEFAULT false,
  ADD COLUMN timing_applicable boolean NOT NULL DEFAULT true,
  ALTER COLUMN scheduled_minutes DROP NOT NULL,
  ALTER COLUMN early_arrival_minutes DROP NOT NULL,
  ALTER COLUMN late_minutes DROP NOT NULL,
  ALTER COLUMN early_leave_minutes DROP NOT NULL,
  ALTER COLUMN late_departure_minutes DROP NOT NULL,
  ALTER COLUMN overtime_candidate_minutes DROP NOT NULL;
COMMENT ON COLUMN attendance_events.work_context IS 'holiday_work records actual work without planned hours or timing assessment. It does not approve overtime.';
