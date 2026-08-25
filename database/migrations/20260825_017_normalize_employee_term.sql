BEGIN;

-- Identifier role tetap "employee"; hanya nama yang dibaca pengguna dinormalisasi.
UPDATE roles
SET name = 'Pegawai'
WHERE code = 'employee'
  AND name IS DISTINCT FROM 'Pegawai';

COMMIT;
