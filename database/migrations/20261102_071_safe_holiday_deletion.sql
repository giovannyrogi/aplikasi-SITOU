-- Permanent usage evidence survives removal of operational references.
ALTER TABLE work_calendars ADD COLUMN deletion_history_verified boolean NOT NULL DEFAULT true;
ALTER TABLE holiday_catalogs ADD COLUMN deletion_history_verified boolean NOT NULL DEFAULT true;
CREATE TABLE holiday_catalog_usage (
 catalog_id bigint NOT NULL REFERENCES holiday_catalogs(id),
 organization_id bigint NOT NULL REFERENCES organizations(id),
 calendar_id bigint NOT NULL, calendar_name varchar(100) NOT NULL,
 first_used_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(catalog_id,organization_id,calendar_id)
);
CREATE TABLE work_calendar_usage (
 organization_id bigint NOT NULL REFERENCES organizations(id), calendar_id bigint NOT NULL,
 source_type varchar(40) NOT NULL, source_id varchar(100) NOT NULL, source_name varchar(200) NOT NULL,
 first_used_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,calendar_id,source_type,source_id),
 FOREIGN KEY(organization_id,calendar_id) REFERENCES work_calendars(organization_id,id)
);
CREATE TABLE holiday_deletions (
 actor_user_id bigint NOT NULL REFERENCES users(id), request_key uuid NOT NULL,
 kind varchar(10) NOT NULL CHECK(kind IN ('catalog','calendar')), target_id bigint NOT NULL,
 organization_id bigint REFERENCES organizations(id), version integer NOT NULL,
 payload_hash char(64) NOT NULL, result jsonb, cleanup_file_id bigint,
 transaction_id bigint NOT NULL DEFAULT txid_current(), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_user_id,request_key), UNIQUE(kind,target_id),
 CHECK((kind='catalog' AND organization_id IS NULL) OR (kind='calendar' AND organization_id IS NOT NULL))
);
CREATE TABLE holiday_pdf_purge_jobs (
 file_id bigint PRIMARY KEY REFERENCES stored_files(id), attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error varchar(80),
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION holiday_json_refs(value jsonb, names text[]) RETURNS SETOF text
LANGUAGE sql IMMUTABLE AS $$
 WITH RECURSIVE nodes(v) AS (
 SELECT value UNION ALL
 SELECT child.v FROM nodes n CROSS JOIN LATERAL (
 SELECT e.value v FROM jsonb_each(CASE WHEN jsonb_typeof(n.v)='object' THEN n.v ELSE '{}'::jsonb END) e
 UNION ALL SELECT a.value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(n.v)='array' THEN n.v ELSE '[]'::jsonb END) a
 ) child
 ) SELECT DISTINCT e.value #>> '{}' FROM nodes n CROSS JOIN LATERAL
 jsonb_each(CASE WHEN jsonb_typeof(n.v)='object' THEN n.v ELSE '{}'::jsonb END) e
 WHERE e.key=ANY(names) AND jsonb_typeof(e.value) IN ('number','string')
$$;

CREATE FUNCTION remember_holiday_catalog_use() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_id bigint; calendar_label text;
BEGIN
 IF NEW.catalog_day_id IS NULL THEN RETURN NEW; END IF;
 SELECT c.id INTO source_id FROM holiday_catalogs c JOIN holiday_catalog_days d ON d.catalog_id=c.id
 WHERE d.id=NEW.catalog_day_id FOR UPDATE OF c;
 IF source_id IS NULL THEN RAISE EXCEPTION 'Catalog no longer available' USING ERRCODE='23503'; END IF;
 SELECT name INTO calendar_label FROM work_calendars WHERE organization_id=NEW.organization_id AND id=NEW.calendar_id;
 INSERT INTO holiday_catalog_usage(catalog_id,organization_id,calendar_id,calendar_name)
 VALUES(source_id,NEW.organization_id,NEW.calendar_id,calendar_label) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER remember_holiday_catalog_use BEFORE INSERT OR UPDATE OF catalog_day_id ON work_calendar_days
 FOR EACH ROW EXECUTE FUNCTION remember_holiday_catalog_use();

CREATE FUNCTION remember_work_calendar_use() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.calendar_id IS NULL THEN RETURN NEW; END IF;
 PERFORM 1 FROM work_calendars WHERE organization_id=NEW.organization_id AND id=NEW.calendar_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Calendar no longer available' USING ERRCODE='23503'; END IF;
 INSERT INTO work_calendar_usage(organization_id,calendar_id,source_type,source_id,source_name)
 VALUES(NEW.organization_id,NEW.calendar_id,TG_TABLE_NAME,NEW.id::text,NEW.name) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER remember_work_calendar_use BEFORE INSERT OR UPDATE OF calendar_id ON shift_patterns
 FOR EACH ROW EXECUTE FUNCTION remember_work_calendar_use();
CREATE TRIGGER remember_work_calendar_use BEFORE INSERT OR UPDATE OF calendar_id ON work_schedule_groups
 FOR EACH ROW EXECUTE FUNCTION remember_work_calendar_use();

INSERT INTO holiday_catalog_usage(catalog_id,organization_id,calendar_id,calendar_name)
 SELECT DISTINCT d.catalog_id,w.organization_id,w.calendar_id,c.name FROM work_calendar_days w
 JOIN holiday_catalog_days d ON d.id=w.catalog_day_id JOIN work_calendars c ON c.organization_id=w.organization_id AND c.id=w.calendar_id;
INSERT INTO work_calendar_usage(organization_id,calendar_id,source_type,source_id,source_name)
 SELECT organization_id,calendar_id,'shift_patterns',id::text,name FROM shift_patterns WHERE calendar_id IS NOT NULL
 UNION ALL SELECT organization_id,calendar_id,'work_schedule_groups',id::text,name FROM work_schedule_groups WHERE calendar_id IS NOT NULL;
-- Audited requests/results include previous calendar IDs and immutable definition snapshots.
INSERT INTO work_calendar_usage(organization_id,calendar_id,source_type,source_id,source_name,first_used_at)
 SELECT DISTINCT c.organization_id,c.id,'audit',a.id::text,'Riwayat jadwal kerja',a.occurred_at
 FROM audit_logs a JOIN work_calendars c ON c.organization_id=a.organization_id
 WHERE a.action LIKE 'work_schedule.%' AND EXISTS(
 SELECT 1 FROM holiday_json_refs(jsonb_build_array(a.before_data,a.after_data),ARRAY['calendarId','calendar_id']) r WHERE r=c.id::text)
 ON CONFLICT DO NOTHING;
INSERT INTO holiday_catalog_usage(catalog_id,organization_id,calendar_id,calendar_name,first_used_at)
 SELECT DISTINCT d.catalog_id,c.organization_id,c.id,c.name,min(a.occurred_at)
 FROM audit_logs a JOIN work_calendars c ON c.organization_id=a.organization_id
 AND (a.after_data->'result'->>'id')=c.id::text
 JOIN holiday_catalog_days d ON EXISTS(SELECT 1 FROM holiday_json_refs(a.after_data,ARRAY['catalogDayId','catalog_day_id']) r WHERE r=d.id::text)
 WHERE a.action='work_schedule.calendars.save' GROUP BY d.catalog_id,c.organization_id,c.id,c.name
 ON CONFLICT DO NOTHING;
-- Older records without a complete audited version sequence fail closed.
UPDATE work_calendars c SET deletion_history_verified=(
 SELECT count(DISTINCT (a.after_data->'result'->>'version'))>=c.version
 FROM audit_logs a WHERE a.organization_id=c.organization_id AND a.action='work_schedule.calendars.save'
 AND a.after_data->'result'->>'id'=c.id::text);
-- Existing published trigger allows no ordinary updates, including migration metadata.
CREATE OR REPLACE FUNCTION guard_holiday_catalog() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF NOT OLD.deletion_history_verified OR EXISTS(SELECT 1 FROM holiday_catalog_usage WHERE catalog_id=OLD.id)
   OR NOT EXISTS(SELECT 1 FROM holiday_deletions WHERE kind='catalog' AND target_id=OLD.id AND transaction_id=txid_current() AND result IS NULL)
  THEN RAISE EXCEPTION 'Catalog deletion blocked' USING ERRCODE='23514'; END IF;
  RETURN OLD;
 END IF;
 IF OLD.status='published' AND (to_jsonb(NEW)-'deletion_history_verified')<>(to_jsonb(OLD)-'deletion_history_verified')
 THEN RAISE EXCEPTION 'Published holiday catalog is immutable' USING ERRCODE='23514'; END IF;
 IF NEW.year<>OLD.year OR NEW.revision<>OLD.revision THEN RAISE EXCEPTION 'Catalog identity is immutable' USING ERRCODE='23514'; END IF;
 IF NEW.status='published' AND NOT EXISTS(SELECT 1 FROM holiday_catalog_days WHERE catalog_id=NEW.id)
 THEN RAISE EXCEPTION 'Catalog must contain dates' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
UPDATE holiday_catalogs c SET deletion_history_verified=(
 NOT EXISTS(SELECT 1 FROM work_calendars WHERE NOT deletion_history_verified)
 AND EXISTS(SELECT 1 FROM audit_logs a WHERE a.entity_type='holiday_catalog' AND a.entity_id=c.id::text
 AND a.action IN ('holiday_catalog.system_seed','holiday_catalog.save')));
-- Restore strict update immutability after the one-time backfill.
CREATE OR REPLACE FUNCTION guard_holiday_catalog() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF NOT OLD.deletion_history_verified OR EXISTS(SELECT 1 FROM holiday_catalog_usage WHERE catalog_id=OLD.id)
   OR NOT EXISTS(SELECT 1 FROM holiday_deletions WHERE kind='catalog' AND target_id=OLD.id AND transaction_id=txid_current() AND result IS NULL)
  THEN RAISE EXCEPTION 'Catalog deletion blocked' USING ERRCODE='23514'; END IF;
  RETURN OLD;
 END IF;
 IF OLD.status='published' THEN RAISE EXCEPTION 'Published holiday catalog is immutable' USING ERRCODE='23514'; END IF;
 IF NEW.year<>OLD.year OR NEW.revision<>OLD.revision THEN RAISE EXCEPTION 'Catalog identity is immutable' USING ERRCODE='23514'; END IF;
 IF NEW.status='published' AND NOT EXISTS(SELECT 1 FROM holiday_catalog_days WHERE catalog_id=NEW.id)
 THEN RAISE EXCEPTION 'Catalog must contain dates' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION guard_holiday_catalog_day() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c holiday_catalogs;
BEGIN
 SELECT * INTO c FROM holiday_catalogs WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.catalog_id ELSE NEW.catalog_id END FOR UPDATE;
 IF c.status='published' THEN
  IF TG_OP<>'DELETE' OR NOT c.deletion_history_verified OR EXISTS(SELECT 1 FROM holiday_catalog_usage WHERE catalog_id=c.id)
   OR NOT EXISTS(SELECT 1 FROM holiday_deletions WHERE kind='catalog' AND target_id=c.id AND transaction_id=txid_current() AND result IS NULL)
  THEN RAISE EXCEPTION 'Published holiday dates are immutable' USING ERRCODE='23514'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND NEW.catalog_id<>OLD.catalog_id THEN RAISE EXCEPTION 'Catalog identity is immutable' USING ERRCODE='23514'; END IF;
 IF extract(year FROM NEW.holiday_date)<>c.year THEN RAISE EXCEPTION 'Date outside catalog year' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION protect_holiday_usage() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Holiday usage evidence is immutable' USING ERRCODE='23514'; END $$;
CREATE TRIGGER protect_holiday_usage BEFORE UPDATE OR DELETE ON holiday_catalog_usage FOR EACH ROW EXECUTE FUNCTION protect_holiday_usage();
CREATE TRIGGER protect_holiday_usage BEFORE UPDATE OR DELETE ON work_calendar_usage FOR EACH ROW EXECUTE FUNCTION protect_holiday_usage();
CREATE FUNCTION guard_work_calendar_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT OLD.deletion_history_verified OR EXISTS(SELECT 1 FROM work_calendar_usage WHERE organization_id=OLD.organization_id AND calendar_id=OLD.id)
 OR NOT EXISTS(SELECT 1 FROM holiday_deletions WHERE kind='calendar' AND target_id=OLD.id AND organization_id=OLD.organization_id AND transaction_id=txid_current() AND result IS NULL)
 THEN RAISE EXCEPTION 'Calendar deletion blocked' USING ERRCODE='23514'; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER guard_work_calendar_deletion BEFORE DELETE ON work_calendars FOR EACH ROW EXECUTE FUNCTION guard_work_calendar_deletion();
