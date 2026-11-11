INSERT INTO access_modules (code, name)
VALUES ('attendance_selfie_check', 'Pemeriksaan selfie')
ON CONFLICT (code) DO NOTHING;
