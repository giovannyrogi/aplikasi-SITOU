-- Effective-dated definitions retain the same assignment identity and historical hours.
CREATE TABLE work_schedule_definition_revisions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 organization_id bigint NOT NULL REFERENCES organizations(id),
 pattern_id bigint NOT NULL,
 effective_from date NOT NULL,
 pattern_type varchar(10) NOT NULL CHECK(pattern_type IN ('weekly','rotation')),
 cycle_days smallint NOT NULL CHECK(cycle_days BETWEEN 1 AND 366),
 calendar_id bigint,
 holiday_policy varchar(10) NOT NULL CHECK(holiday_policy IN ('calendar','roster')),
 days jsonb NOT NULL CHECK(jsonb_typeof(days)='array'),
 reason text NOT NULL CHECK(length(btrim(reason))>=5),
 created_by_user_id bigint REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), UNIQUE(organization_id,pattern_id,effective_from),
 FOREIGN KEY(organization_id,pattern_id) REFERENCES shift_patterns(organization_id,id),
 FOREIGN KEY(organization_id,calendar_id) REFERENCES work_calendars(organization_id,id),
 CHECK(pattern_type<>'weekly' OR cycle_days=7),
 CHECK(holiday_policy<>'calendar' OR calendar_id IS NOT NULL)
);
COMMENT ON TABLE work_schedule_definition_revisions IS 'Definisi jadwal berdasarkan tanggal berlaku; append-only. Tidak menulis ulang penetapan, snapshot absensi atau rekap.';
CREATE FUNCTION protect_schedule_definition_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Schedule definition revisions are immutable'; END $$;
CREATE TRIGGER protect_schedule_definition_revision BEFORE UPDATE OR DELETE ON work_schedule_definition_revisions
 FOR EACH ROW EXECUTE FUNCTION protect_schedule_definition_revision();
CREATE FUNCTION remember_schedule_revision_calendar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.calendar_id IS NOT NULL THEN
  PERFORM 1 FROM work_calendars WHERE organization_id=NEW.organization_id AND id=NEW.calendar_id FOR UPDATE;
  INSERT INTO work_calendar_usage(organization_id,calendar_id,source_type,source_id,source_name)
  VALUES(NEW.organization_id,NEW.calendar_id,'schedule_revision',NEW.id::text,'Riwayat jadwal kerja') ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER remember_schedule_revision_calendar BEFORE INSERT ON work_schedule_definition_revisions
 FOR EACH ROW EXECUTE FUNCTION remember_schedule_revision_calendar();
