-- Platform reference only. No organization calendar or schedule is changed by this migration.
CREATE TABLE holiday_catalogs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 year integer NOT NULL CHECK(year BETWEEN 2000 AND 2200),
 revision integer NOT NULL CHECK(revision>0),
 status varchar(12) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
 decision_number varchar(200) NOT NULL,
 source_url varchar(1000) NOT NULL,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 system_seed boolean NOT NULL DEFAULT false,
 created_by_user_id bigint REFERENCES users(id),
 published_by_user_id bigint REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 published_at timestamptz,
 UNIQUE(year,revision),
 CHECK((status='draft' AND published_at IS NULL) OR
       (status='published' AND published_at IS NOT NULL AND (system_seed OR published_by_user_id IS NOT NULL)))
);
CREATE UNIQUE INDEX uq_holiday_catalog_draft ON holiday_catalogs(year) WHERE status='draft';
CREATE TABLE holiday_catalog_days (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 catalog_id bigint NOT NULL REFERENCES holiday_catalogs(id),
 holiday_date date NOT NULL,
 name varchar(100) NOT NULL CHECK(length(btrim(name))>0),
 category varchar(16) NOT NULL CHECK(category IN ('national','joint_leave')),
 UNIQUE(catalog_id,holiday_date)
);
CREATE TABLE holiday_catalog_requests (
 actor_user_id bigint NOT NULL REFERENCES users(id),
 request_key uuid NOT NULL,
 payload_hash char(64) NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_user_id,request_key)
);
ALTER TABLE work_calendar_days ADD COLUMN catalog_day_id bigint REFERENCES holiday_catalog_days(id);
CREATE INDEX idx_calendar_catalog_day ON work_calendar_days(catalog_day_id) WHERE catalog_day_id IS NOT NULL;

CREATE FUNCTION guard_holiday_catalog() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='published' THEN RAISE EXCEPTION 'Published holiday catalog is immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.year<>OLD.year OR NEW.revision<>OLD.revision THEN
  RAISE EXCEPTION 'Catalog identity is immutable' USING ERRCODE='23514';
 END IF;
 IF NEW.status='published' AND NOT EXISTS(SELECT 1 FROM holiday_catalog_days WHERE catalog_id=NEW.id) THEN
  RAISE EXCEPTION 'Catalog must contain dates' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_holiday_catalog BEFORE UPDATE OR DELETE ON holiday_catalogs FOR EACH ROW EXECUTE FUNCTION guard_holiday_catalog();
CREATE FUNCTION guard_holiday_catalog_day() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c holiday_catalogs;
BEGIN
 SELECT * INTO c FROM holiday_catalogs WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.catalog_id ELSE NEW.catalog_id END FOR UPDATE;
 IF c.status='published' THEN RAISE EXCEPTION 'Published holiday dates are immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND NEW.catalog_id<>OLD.catalog_id THEN RAISE EXCEPTION 'Catalog identity is immutable' USING ERRCODE='23514'; END IF;
 IF extract(year FROM NEW.holiday_date)<>c.year THEN RAISE EXCEPTION 'Date outside catalog year' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_holiday_catalog_day BEFORE INSERT OR UPDATE OR DELETE ON holiday_catalog_days FOR EACH ROW EXECUTE FUNCTION guard_holiday_catalog_day();

-- Verified against the attached SKB, not an external API. Initial publisher is the system.
INSERT INTO holiday_catalogs(year,revision,decision_number,source_url,system_seed) VALUES
(2026,1,'1497 Tahun 2025 / 2 Tahun 2025 / 5 Tahun 2025','https://www.kemenkopmk.go.id/sites/default/files/pengumuman/2025-09/SKB%20Libur%20Nasional%20dan%20Cuti%20Bersama%20Tahun%202026.pdf',true),
(2027,1,'1205 Tahun 2026 / 3 Tahun 2026 / 2 Tahun 2026','https://kemenkopmk.go.id/sites/default/files/pengumuman/2026-09/SKB%20Libur%20Nasional%20dan%20Cuti%20Bersama%20Tahun%202027.pdf',true);
INSERT INTO holiday_catalog_days(catalog_id,holiday_date,name,category)
SELECT c.id,v.d::date,v.n,v.k FROM (VALUES
('2026-01-01','Tahun Baru 2026 Masehi','national'),
('2026-01-16','Isra Mikraj Nabi Muhammad saw.','national'),
('2026-02-17','Tahun Baru Imlek 2577 Kongzili','national'),
('2026-03-19','Hari Suci Nyepi (Tahun Baru Saka 1948)','national'),
('2026-03-21','Idulfitri 1447 Hijriah','national'),
('2026-03-22','Idulfitri 1447 Hijriah','national'),
('2026-04-03','Wafat Yesus Kristus','national'),
('2026-04-05','Hari Kebangkitan Yesus Kristus (Paskah)','national'),
('2026-05-01','Hari Buruh Internasional','national'),
('2026-05-14','Kenaikan Yesus Kristus','national'),
('2026-05-27','Iduladha 1447 Hijriah','national'),
('2026-05-31','Hari Raya Waisak 2570 BE','national'),
('2026-06-01','Hari Lahir Pancasila','national'),
('2026-06-16','1 Muharam Tahun Baru Islam 1448 Hijriah','national'),
('2026-08-17','Proklamasi Kemerdekaan','national'),
('2026-08-25','Maulid Nabi Muhammad saw.','national'),
('2026-12-25','Kelahiran Yesus Kristus (Natal)','national'),
('2026-02-16','Tahun Baru Imlek 2577 Kongzili','joint_leave'),
('2026-03-18','Hari Suci Nyepi (Tahun Baru Saka 1948)','joint_leave'),
('2026-03-20','Idulfitri 1447 Hijriah','joint_leave'),
('2026-03-23','Idulfitri 1447 Hijriah','joint_leave'),
('2026-03-24','Idulfitri 1447 Hijriah','joint_leave'),
('2026-05-15','Kenaikan Yesus Kristus','joint_leave'),
('2026-05-28','Iduladha 1447 Hijriah','joint_leave'),
('2026-12-24','Kelahiran Yesus Kristus (Natal)','joint_leave'),
('2027-01-01','Tahun Baru 2027 Masehi','national'),
('2027-01-05','Isra Mikraj Nabi Muhammad saw.','national'),
('2027-02-06','Tahun Baru Imlek 2578 Kongzili','national'),
('2027-03-08','Hari Suci Nyepi (Tahun Baru Saka 1949)','national'),
('2027-03-10','Idulfitri 1448 Hijriah','national'),
('2027-03-11','Idulfitri 1448 Hijriah','national'),
('2027-03-26','Wafat Yesus Kristus','national'),
('2027-03-28','Hari Kebangkitan Yesus Kristus (Paskah)','national'),
('2027-05-01','Hari Buruh Internasional','national'),
('2027-05-06','Kenaikan Yesus Kristus','national'),
('2027-05-17','Iduladha 1448 Hijriah','national'),
('2027-05-20','Hari Raya Waisak 2571 BE','national'),
('2027-06-01','Hari Lahir Pancasila','national'),
('2027-06-06','1 Muharam Tahun Baru Islam 1449 Hijriah','national'),
('2027-08-15','Maulid Nabi Muhammad saw.','national'),
('2027-08-17','Proklamasi Kemerdekaan','national'),
('2027-12-25','Kelahiran Yesus Kristus (Natal)','national'),
('2027-12-26','Isra Mikraj Nabi Muhammad saw.','national'),
('2027-02-05','Tahun Baru Imlek 2578 Kongzili','joint_leave'),
('2027-03-09','Idulfitri 1448 Hijriah','joint_leave'),
('2027-03-12','Idulfitri 1448 Hijriah','joint_leave'),
('2027-03-15','Idulfitri 1448 Hijriah','joint_leave'),
('2027-03-25','Wafat Yesus Kristus','joint_leave'),
('2027-05-18','Iduladha 1448 Hijriah','joint_leave'),
('2027-05-19','Hari Raya Waisak 2571 BE','joint_leave'),
('2027-12-24','Kelahiran Yesus Kristus (Natal)','joint_leave')
) AS v(d,n,k) JOIN holiday_catalogs c ON c.year=extract(year FROM v.d::date) AND c.revision=1;
UPDATE holiday_catalogs SET status='published',published_at=now() WHERE system_seed;
INSERT INTO audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data)
SELECT NULL,NULL,'holiday_catalog.system_seed','holiday_catalog',id::text,
 jsonb_build_object('year',year,'revision',revision,'source','migration_069','publisher','system')
FROM holiday_catalogs WHERE system_seed;
