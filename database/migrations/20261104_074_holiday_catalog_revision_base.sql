ALTER TABLE holiday_catalogs
  ADD COLUMN revision_of_id bigint CHECK (revision_of_id > 0 AND revision_of_id <> id);

COMMENT ON COLUMN holiday_catalogs.revision_of_id IS
  'Identitas katalog terbit yang dipilih saat membuat revisi. Snapshot tetap tersimpan jika acuan dihapus melalui alur resmi.';
