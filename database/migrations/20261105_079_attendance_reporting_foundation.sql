-- 079: Bukti terstruktur absensi dan rekap yang dapat dihitung ulang.
-- Event lama tetap append-only. Nilai baru NULL menandakan bukti historis belum tersedia.
ALTER TABLE attendance_events
  ADD COLUMN assessment_version smallint CHECK (assessment_version = 1),
  ADD COLUMN timing_category varchar(30) CHECK (timing_category IN
    ('on_time','early_check_in','late_check_in','early_check_out','late_check_out','flexible_check_in')),
  ADD COLUMN schedule_reference_at timestamptz,
  ADD COLUMN schedule_offset_seconds integer,
  ADD COLUMN early_arrival_minutes integer CHECK (early_arrival_minutes >= 0),
  ADD COLUMN late_minutes integer CHECK (late_minutes >= 0),
  ADD COLUMN early_leave_minutes integer CHECK (early_leave_minutes >= 0),
  ADD COLUMN late_departure_minutes integer CHECK (late_departure_minutes >= 0),
  ADD COLUMN point_location_id_snapshot bigint,
  ADD COLUMN point_name_snapshot varchar(200),
  ADD COLUMN point_latitude_snapshot numeric(10,7) CHECK (point_latitude_snapshot BETWEEN -90 AND 90),
  ADD COLUMN point_longitude_snapshot numeric(10,7) CHECK (point_longitude_snapshot BETWEEN -180 AND 180),
  ADD COLUMN max_accuracy_m_snapshot integer CHECK (max_accuracy_m_snapshot > 0),
  ADD COLUMN organization_timezone_snapshot varchar(50),
  ADD CONSTRAINT fk_attendance_location_snapshot
    FOREIGN KEY (organization_id,point_location_id_snapshot) REFERENCES locations(organization_id,id),
  ADD CONSTRAINT ck_attendance_assessment_complete CHECK (
    assessment_version IS NULL OR (
      source='mobile' AND event_type IN ('check_in','check_out')
      AND timing_category IS NOT NULL AND schedule_reference_at IS NOT NULL
      AND schedule_offset_seconds IS NOT NULL AND early_arrival_minutes IS NOT NULL
      AND late_minutes IS NOT NULL AND early_leave_minutes IS NOT NULL AND late_departure_minutes IS NOT NULL
      AND point_location_id_snapshot IS NOT NULL AND point_name_snapshot IS NOT NULL
      AND point_latitude_snapshot IS NOT NULL AND point_longitude_snapshot IS NOT NULL
      AND max_accuracy_m_snapshot IS NOT NULL AND organization_timezone_snapshot IS NOT NULL
      AND allowed_radius_m IS NOT NULL AND allowed_radius_m>0 AND schedule_session_id IS NOT NULL
    )
  ),
  ADD CONSTRAINT ck_attendance_timing_action CHECK (
    timing_category IS NULL OR
    (event_type='check_in' AND timing_category IN ('on_time','early_check_in','late_check_in','flexible_check_in')) OR
    (event_type='check_out' AND timing_category IN ('on_time','early_check_out','late_check_out'))
  );
CREATE INDEX ix_attendance_timing_date ON attendance_events(organization_id,event_date,timing_category)
  WHERE assessment_version IS NOT NULL;
CREATE INDEX ix_attendance_daily_events ON attendance_events(organization_id,employee_id,daily_schedule_id,occurred_at)
  WHERE daily_schedule_id IS NOT NULL;

ALTER TABLE attendance_daily_summaries
  ADD COLUMN scheduled_minutes integer NOT NULL DEFAULT 0 CHECK (scheduled_minutes>=0),
  ADD COLUMN early_arrival_minutes integer NOT NULL DEFAULT 0 CHECK (early_arrival_minutes>=0),
  ADD COLUMN late_departure_minutes integer NOT NULL DEFAULT 0 CHECK (late_departure_minutes>=0),
  ADD COLUMN scheduled_session_count integer NOT NULL DEFAULT 0 CHECK (scheduled_session_count>=0),
  ADD COLUMN completed_session_count integer NOT NULL DEFAULT 0 CHECK (completed_session_count>=0),
  ADD COLUMN open_session_count integer NOT NULL DEFAULT 0 CHECK (open_session_count>=0),
  ADD COLUMN missing_check_in_count integer NOT NULL DEFAULT 0 CHECK (missing_check_in_count>=0),
  ADD COLUMN missing_check_out_count integer NOT NULL DEFAULT 0 CHECK (missing_check_out_count>=0),
  ADD COLUMN unassessed_event_count integer NOT NULL DEFAULT 0 CHECK (unassessed_event_count>=0),
  ADD COLUMN outside_event_count integer NOT NULL DEFAULT 0 CHECK (outside_event_count>=0),
  ADD COLUMN calculation_details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(calculation_details)='object');
COMMENT ON COLUMN attendance_events.schedule_offset_seconds IS 'Selisih bertanda terhadap acuan masuk/pulang efektif; toleransi tidak menghapus bukti selisih.';
COMMENT ON COLUMN attendance_daily_summaries.overtime_candidate_minutes IS 'Selisih menit setelah jam pulang efektif; kandidat pemeriksaan, bukan persetujuan lembur.';
