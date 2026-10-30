-- Fitur Absensi: hanya katalog. Tidak mengaktifkan organisasi atau mengubah grant/histori.
INSERT INTO access_modules(code,name) VALUES('attendance','Absensi')
ON CONFLICT(code) DO NOTHING;
