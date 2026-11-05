ALTER TABLE organizations
  ADD COLUMN attendance_map_provider varchar(20) NOT NULL DEFAULT 'openstreetmap',
  ADD CONSTRAINT ck_organizations_attendance_map_provider
    CHECK (attendance_map_provider IN ('openstreetmap', 'google'));
