-- Aturan lama tetap berlaku untuk semua pegawai.
ALTER TABLE leave_types
  ADD COLUMN eligible_gender varchar(10) NOT NULL DEFAULT 'all'
    CONSTRAINT ck_leave_types_eligible_gender CHECK (eligible_gender IN ('all','male','female'));

COMMENT ON COLUMN leave_types.eligible_gender IS
  'Jenis kelamin profil pegawai yang dapat memakai jenis cuti/izin; all berlaku untuk semua.';
