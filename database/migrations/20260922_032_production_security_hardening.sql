BEGIN;

ALTER TABLE stored_files
  ADD COLUMN malware_scan_status varchar(24) NOT NULL DEFAULT 'legacy_unscanned',
  ADD COLUMN malware_scanned_at timestamptz,
  ADD COLUMN malware_scan_engine varchar(80),
  ADD COLUMN malware_signature text,
  ADD CONSTRAINT ck_stored_files_malware_scan_status CHECK (
    malware_scan_status IN ('pending','clean','infected','scan_error','legacy_unscanned')
  );

CREATE INDEX ix_stored_files_malware_scan_pending
  ON stored_files(organization_id,malware_scan_status,id)
  WHERE lifecycle_status IN ('draft','active')
    AND malware_scan_status IN ('pending','scan_error','legacy_unscanned');

CREATE TABLE file_purge_jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL,
  stored_file_id bigint NOT NULL,
  object_key text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','retry','completed','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts>=0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_code varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT fk_file_purge_job_file FOREIGN KEY (organization_id,stored_file_id)
    REFERENCES stored_files(organization_id,id),
  CONSTRAINT ck_file_purge_job_key CHECK (object_key !~ '(^/|\.\.)')
);

CREATE UNIQUE INDEX uq_file_purge_jobs_pending_file
  ON file_purge_jobs(organization_id,stored_file_id)
  WHERE status IN ('queued','processing','retry');
CREATE INDEX ix_file_purge_jobs_ready
  ON file_purge_jobs(next_attempt_at,id)
  WHERE status IN ('queued','retry');

CREATE TABLE security_rate_limit_buckets (
  action varchar(80) NOT NULL,
  bucket_key char(64) NOT NULL,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count>=0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(action,bucket_key,window_started_at)
);

CREATE INDEX ix_security_rate_limit_expiry ON security_rate_limit_buckets(expires_at);

COMMENT ON COLUMN stored_files.malware_scan_status IS
  'Hasil pemeriksaan antivirus byte file; file baru hanya boleh aktif setelah berstatus clean.';
COMMENT ON TABLE file_purge_jobs IS
  'Antrean idempotent penghapusan byte setelah pelepasan metadata berhasil commit.';
COMMENT ON TABLE security_rate_limit_buckets IS
  'Fixed-window rate limit persisten dengan identifier yang sudah di-hash.';

COMMIT;
