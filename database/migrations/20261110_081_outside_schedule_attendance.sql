-- Store the stable pair number for additional, non-rostered attendance.
ALTER TABLE attendance_events
  ADD COLUMN outside_schedule_session_no smallint,
  DROP CONSTRAINT attendance_events_work_context_check,
  DROP CONSTRAINT ck_attendance_assessment_complete;

ALTER TABLE attendance_events
  ADD CONSTRAINT attendance_events_work_context_check
    CHECK (work_context IN ('scheduled','holiday_work','outside_schedule')),
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
      OR (assessment_version=2 AND work_context IN ('holiday_work','outside_schedule') AND daily_schedule_id IS NOT NULL
        AND schedule_session_id IS NULL AND timing_category IS NOT NULL AND timing_category='not_applicable'
        AND schedule_reference_at IS NULL AND schedule_offset_seconds IS NULL
        AND early_arrival_minutes IS NULL AND late_minutes IS NULL
        AND early_leave_minutes IS NULL AND late_departure_minutes IS NULL
        AND length(btrim(attendance_note))>0))
    )
  ),
  ADD CONSTRAINT ck_attendance_outside_schedule_evidence CHECK (
    (work_context <> 'outside_schedule' AND outside_schedule_session_no IS NULL)
    OR (work_context='outside_schedule' AND assessment_version IS NOT NULL AND assessment_version=2
      AND outside_schedule_session_no IS NOT NULL AND outside_schedule_session_no BETWEEN 17 AND 32
      AND attendance_note IS NOT NULL AND length(btrim(attendance_note))>0)
  );
COMMENT ON COLUMN attendance_events.work_context IS 'scheduled uses a planned shift. holiday_work and outside_schedule record actual work without approving overtime.';
COMMENT ON COLUMN attendance_events.outside_schedule_session_no IS 'Stable additional attendance pair number within the work date; reserved range 17-32.';
