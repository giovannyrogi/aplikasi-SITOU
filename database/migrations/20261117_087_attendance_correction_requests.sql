CREATE TABLE attendance_correction_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id),
  employee_id bigint NOT NULL,
  source_event_date date NOT NULL,
  source_event_id bigint NOT NULL,
  work_date date NOT NULL,
  requested_checkout_at timestamptz NOT NULL,
  timezone varchar(50) NOT NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  request_key uuid NOT NULL,
  requested_by_user_id bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  status varchar(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by_user_id bigint REFERENCES users(id),
  reviewed_at timestamptz,
  review_note text,
  FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id),
  FOREIGN KEY (source_event_date,source_event_id) REFERENCES attendance_events(event_date,id),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,employee_id,request_key),
  CHECK ((status='pending') = (reviewed_by_user_id IS NULL AND reviewed_at IS NULL)),
  CHECK (status='pending' OR (reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)),
  CHECK (status<>'rejected' OR nullif(btrim(review_note),'') IS NOT NULL)
);
CREATE UNIQUE INDEX uq_attendance_open_correction
  ON attendance_correction_requests(organization_id,employee_id,source_event_date,source_event_id)
  WHERE status IN ('pending','approved');
CREATE INDEX ix_attendance_correction_employee
  ON attendance_correction_requests(organization_id,employee_id,id DESC);

COMMENT ON TABLE attendance_correction_requests IS
  'Pengajuan koreksi absen pulang terkait event masuk asli; pengajuan tidak mengubah event atau rekap sebelum keputusan.';
