-- Legacy save receipts returned only id; input.version is the audited prior version.
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

UPDATE work_calendars c SET deletion_history_verified=(
 SELECT count(DISTINCT coalesce((a.after_data->>'version')::integer+1,1))>=c.version
 FROM audit_logs a WHERE a.organization_id=c.organization_id AND a.action='work_schedule.calendars.save'
 AND a.after_data->'result'->>'id'=c.id::text);
UPDATE holiday_catalogs c SET deletion_history_verified=(
 NOT EXISTS(SELECT 1 FROM work_calendars WHERE NOT deletion_history_verified)
 AND EXISTS(SELECT 1 FROM audit_logs a WHERE a.entity_type='holiday_catalog' AND a.entity_id=c.id::text
 AND a.action IN ('holiday_catalog.system_seed','holiday_catalog.save')));
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
