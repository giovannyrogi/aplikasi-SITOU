BEGIN;

-- Bentuk lama 08..., 628..., dan 8... dinormalisasi menjadi E.164 +628...
-- sebelum constraint diterapkan. Nilai kosong tetap NULL.
UPDATE users
SET phone = CASE
  WHEN regexp_replace(phone,'[^0-9]','','g') LIKE '62%'
    THEN '+' || regexp_replace(phone,'[^0-9]','','g')
  WHEN regexp_replace(phone,'[^0-9]','','g') LIKE '0%'
    THEN '+62' || substr(regexp_replace(phone,'[^0-9]','','g'),2)
  ELSE '+62' || regexp_replace(phone,'[^0-9]','','g')
END
WHERE phone IS NOT NULL AND btrim(phone)<>'';

UPDATE employee_contacts
SET whatsapp = CASE
  WHEN regexp_replace(whatsapp,'[^0-9]','','g') LIKE '62%'
    THEN '+' || regexp_replace(whatsapp,'[^0-9]','','g')
  WHEN regexp_replace(whatsapp,'[^0-9]','','g') LIKE '0%'
    THEN '+62' || substr(regexp_replace(whatsapp,'[^0-9]','','g'),2)
  ELSE '+62' || regexp_replace(whatsapp,'[^0-9]','','g')
END
WHERE whatsapp IS NOT NULL AND btrim(whatsapp)<>'';

UPDATE employee_dependents
SET phone = CASE
  WHEN regexp_replace(phone,'[^0-9]','','g') LIKE '62%'
    THEN '+' || regexp_replace(phone,'[^0-9]','','g')
  WHEN regexp_replace(phone,'[^0-9]','','g') LIKE '0%'
    THEN '+62' || substr(regexp_replace(phone,'[^0-9]','','g'),2)
  ELSE '+62' || regexp_replace(phone,'[^0-9]','','g')
END
WHERE phone IS NOT NULL AND btrim(phone)<>'';

UPDATE employee_emergency_contacts
SET phone = CASE
  WHEN regexp_replace(phone,'[^0-9]','','g') LIKE '62%'
    THEN '+' || regexp_replace(phone,'[^0-9]','','g')
  WHEN regexp_replace(phone,'[^0-9]','','g') LIKE '0%'
    THEN '+62' || substr(regexp_replace(phone,'[^0-9]','','g'),2)
  ELSE '+62' || regexp_replace(phone,'[^0-9]','','g')
END
WHERE phone IS NOT NULL AND btrim(phone)<>'';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE phone IS NOT NULL AND phone !~ '^\+628[1-9][0-9]{7,10}$')
    OR EXISTS (SELECT 1 FROM employee_contacts WHERE whatsapp IS NOT NULL AND whatsapp !~ '^\+628[1-9][0-9]{7,10}$')
    OR EXISTS (SELECT 1 FROM employee_dependents WHERE phone IS NOT NULL AND phone !~ '^\+628[1-9][0-9]{7,10}$')
    OR EXISTS (SELECT 1 FROM employee_emergency_contacts WHERE phone !~ '^\+628[1-9][0-9]{7,10}$') THEN
    RAISE EXCEPTION 'Migration dibatalkan: masih ada nomor seluler Indonesia yang tidak valid.';
  END IF;
END $$;

ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_phone_e164;
ALTER TABLE users ADD CONSTRAINT ck_users_phone_e164
  CHECK (phone IS NULL OR phone ~ '^\+628[1-9][0-9]{7,10}$');

ALTER TABLE employee_contacts DROP CONSTRAINT IF EXISTS ck_employee_contacts_whatsapp_e164;
ALTER TABLE employee_contacts ADD CONSTRAINT ck_employee_contacts_whatsapp_e164
  CHECK (whatsapp IS NULL OR whatsapp ~ '^\+628[1-9][0-9]{7,10}$');

ALTER TABLE employee_dependents DROP CONSTRAINT IF EXISTS ck_employee_dependents_phone_e164;
ALTER TABLE employee_dependents ADD CONSTRAINT ck_employee_dependents_phone_e164
  CHECK (phone IS NULL OR phone ~ '^\+628[1-9][0-9]{7,10}$');

ALTER TABLE employee_emergency_contacts
  DROP CONSTRAINT IF EXISTS ck_employee_emergency_contacts_phone_e164;
ALTER TABLE employee_emergency_contacts ADD CONSTRAINT ck_employee_emergency_contacts_phone_e164
  CHECK (phone ~ '^\+628[1-9][0-9]{7,10}$');

COMMENT ON COLUMN employee_contacts.whatsapp IS
  'Nomor WhatsApp kanonik E.164 Indonesia, misalnya +628123456789.';

COMMIT;
