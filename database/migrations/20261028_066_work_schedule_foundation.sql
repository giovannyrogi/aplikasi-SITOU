-- Fondasi jadwal; tidak mengubah event absensi atau memberikan grant HRD baru.
-- Kode master ini belum dipakai oleh API existing. Jangan memakai CASCADE.
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM work_shifts GROUP BY organization_id,lower(btrim(name)) HAVING count(*)>1)
    OR EXISTS(SELECT 1 FROM shift_patterns GROUP BY organization_id,lower(btrim(name)) HAVING count(*)>1)
  THEN RAISE EXCEPTION 'Nama shift/pola duplikat harus diperiksa sebelum migration 066'; END IF;
END $$;
ALTER TABLE work_shifts DROP CONSTRAINT uq_work_shifts_code, DROP COLUMN code;
ALTER TABLE shift_patterns DROP CONSTRAINT uq_shift_patterns_code, DROP COLUMN code;
CREATE UNIQUE INDEX uq_work_shifts_name ON work_shifts(organization_id,lower(btrim(name)));
CREATE UNIQUE INDEX uq_shift_patterns_name ON shift_patterns(organization_id,lower(btrim(name)));
ALTER TABLE work_shifts ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);

CREATE TABLE work_shift_revisions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 organization_id bigint NOT NULL REFERENCES organizations(id),
 shift_id bigint NOT NULL,
 effective_from date NOT NULL,
 effective_until date,
 rules jsonb NOT NULL CHECK(jsonb_typeof(rules)='object'),
 reason text NOT NULL CHECK(length(btrim(reason))>=5),
 created_by_user_id bigint REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),UNIQUE(organization_id,id,shift_id),
 FOREIGN KEY(organization_id,shift_id) REFERENCES work_shifts(organization_id,id),
 CHECK(effective_until IS NULL OR effective_until>=effective_from),
 EXCLUDE USING gist(organization_id WITH =,shift_id WITH =,daterange(effective_from,effective_until,'[]') WITH &&)
);
INSERT INTO work_shift_revisions(organization_id,shift_id,effective_from,rules,reason)
 SELECT organization_id,id,'-infinity',jsonb_build_object(
 'type',shift_type,'startTime',to_char(start_time,'HH24:MI'),'endTime',to_char(end_time,'HH24:MI'),
 'windowStart',to_char(check_in_window_start,'HH24:MI'),'windowEnd',to_char(check_in_window_end,'HH24:MI'),
 'requiredMinutes',required_work_minutes,'breakMinutes',break_minutes,'deductBreak',true,
 'nextDay',crosses_midnight,'lateTolerance',late_tolerance_minutes,'earlyTolerance',early_leave_tolerance_minutes,
 'latestFinish',to_char(end_time,'HH24:MI')), 'Data sebelum fondasi jadwal' FROM work_shifts;
CREATE FUNCTION protect_shift_revision_rules() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' OR NEW.rules IS DISTINCT FROM OLD.rules OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
 OR NEW.organization_id<>OLD.organization_id OR NEW.shift_id<>OLD.shift_id THEN
 RAISE EXCEPTION 'Revisi shift tidak boleh ditimpa atau dihapus'; END IF; RETURN NEW; END $$;
CREATE TRIGGER protect_shift_revision BEFORE UPDATE OR DELETE ON work_shift_revisions FOR EACH ROW EXECUTE FUNCTION protect_shift_revision_rules();

CREATE TABLE work_calendars (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 organization_id bigint NOT NULL REFERENCES organizations(id), name varchar(100) NOT NULL CHECK(length(btrim(name))>0),
 is_active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,id)
);
CREATE UNIQUE INDEX uq_work_calendars_name ON work_calendars(organization_id,lower(btrim(name)));
CREATE TABLE work_calendar_days (
 organization_id bigint NOT NULL REFERENCES organizations(id),calendar_id bigint NOT NULL,
 holiday_date date NOT NULL,name varchar(100) NOT NULL CHECK(length(btrim(name))>0),
 PRIMARY KEY(calendar_id,holiday_date),
 FOREIGN KEY(organization_id,calendar_id) REFERENCES work_calendars(organization_id,id)
);
ALTER TABLE shift_patterns ADD COLUMN pattern_type varchar(10) NOT NULL DEFAULT 'weekly' CHECK(pattern_type IN ('weekly','rotation')),
 ADD COLUMN calendar_id bigint, ADD COLUMN holiday_policy varchar(10) NOT NULL DEFAULT 'roster' CHECK(holiday_policy IN ('calendar','roster')),
 ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0), ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
 ADD CONSTRAINT fk_pattern_calendar FOREIGN KEY(organization_id,calendar_id) REFERENCES work_calendars(organization_id,id),
 ADD CONSTRAINT ck_pattern_calendar CHECK(holiday_policy<>'calendar' OR calendar_id IS NOT NULL);
UPDATE shift_patterns SET pattern_type='rotation' WHERE cycle_days<>7;
ALTER TABLE shift_patterns ADD CONSTRAINT ck_weekly_cycle CHECK(pattern_type<>'weekly' OR cycle_days=7);
ALTER TABLE shift_pattern_days DROP CONSTRAINT shift_pattern_days_pkey, ALTER COLUMN shift_id DROP NOT NULL,
 ADD COLUMN session_no smallint NOT NULL DEFAULT 1 CHECK(session_no BETWEEN 1 AND 16),
 ADD PRIMARY KEY(shift_pattern_id,day_no,session_no);
-- NULL shift_id satu baris hari tersebut berarti hari libur, bukan hari tak terisi.
ALTER TABLE shift_assignments ADD COLUMN anchor_date date, ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0),
 ADD COLUMN cancelled_at timestamptz, ADD COLUMN change_reason text, ADD COLUMN cancellation_reason text,
 ADD COLUMN cancelled_by_user_id bigint REFERENCES users(id);
UPDATE shift_assignments SET anchor_date=effective_from;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM shift_assignments a JOIN shift_assignments b ON a.organization_id=b.organization_id
 AND a.employee_id=b.employee_id AND a.id<b.id AND daterange(a.effective_from,a.effective_until,'[]') && daterange(b.effective_from,b.effective_until,'[]'))
 THEN RAISE EXCEPTION 'Periode jadwal Pegawai tumpang tindih; periksa sebelum migration 066'; END IF;
END $$;
ALTER TABLE shift_assignments ADD CONSTRAINT ex_employee_shift_period EXCLUDE USING gist(
 organization_id WITH =, employee_id WITH =, daterange(effective_from,effective_until,'[]') WITH &&)
 WHERE(employee_id IS NOT NULL AND cancelled_at IS NULL);

CREATE TABLE work_schedule_exceptions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id bigint NOT NULL REFERENCES organizations(id),
 employee_id bigint NOT NULL,work_date date NOT NULL,
 shift_ids bigint[] NOT NULL DEFAULT '{}',reason text NOT NULL CHECK(length(btrim(reason))>=5),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),created_by_user_id bigint NOT NULL REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,employee_id,work_date),UNIQUE(organization_id,id),
 FOREIGN KEY(organization_id,employee_id) REFERENCES employees(organization_id,id),CHECK(cardinality(shift_ids)<=16)
);
CREATE TABLE work_schedule_exception_sessions (
 organization_id bigint NOT NULL REFERENCES organizations(id),exception_id bigint NOT NULL,session_no smallint NOT NULL CHECK(session_no BETWEEN 1 AND 16),shift_id bigint NOT NULL,
 PRIMARY KEY(exception_id,session_no),
 FOREIGN KEY(organization_id,exception_id) REFERENCES work_schedule_exceptions(organization_id,id),
 FOREIGN KEY(organization_id,shift_id) REFERENCES work_shifts(organization_id,id)
);
ALTER TABLE employee_daily_schedules ALTER COLUMN shift_id DROP NOT NULL,
 ADD COLUMN is_holiday boolean NOT NULL DEFAULT false, ADD COLUMN holiday_name varchar(100),
 ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0), ADD COLUMN rule_hash varchar(64),
 ADD COLUMN source_exception_id bigint,
 ADD CONSTRAINT fk_daily_exception FOREIGN KEY(organization_id,source_exception_id) REFERENCES work_schedule_exceptions(organization_id,id),
 ADD CONSTRAINT uq_daily_schedule_actor UNIQUE(organization_id,id,employee_id);
ALTER TABLE employee_daily_schedules DROP CONSTRAINT employee_daily_schedules_status_check;
ALTER TABLE employee_daily_schedules ADD CHECK(status IN ('scheduled','off','holiday','cancelled','needs_review'));
CREATE TABLE work_schedule_sessions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,organization_id bigint NOT NULL REFERENCES organizations(id),
 daily_schedule_id bigint NOT NULL, employee_id bigint NOT NULL,session_no smallint NOT NULL CHECK(session_no BETWEEN 1 AND 16),
 shift_id bigint NOT NULL,shift_revision_id bigint NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,
 rules jsonb NOT NULL CHECK(jsonb_typeof(rules)='object'), UNIQUE(organization_id,id),UNIQUE(daily_schedule_id,session_no),
 FOREIGN KEY(organization_id,daily_schedule_id,employee_id) REFERENCES employee_daily_schedules(organization_id,id,employee_id),
 FOREIGN KEY(organization_id,shift_id) REFERENCES work_shifts(organization_id,id),
 FOREIGN KEY(organization_id,shift_revision_id,shift_id) REFERENCES work_shift_revisions(organization_id,id,shift_id),
 CHECK(ends_at>starts_at),
 EXCLUDE USING gist(organization_id WITH =,employee_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&)
);
CREATE INDEX ix_schedule_exception_date ON work_schedule_exceptions(organization_id,employee_id,work_date);
CREATE INDEX ix_schedule_sessions_actor ON work_schedule_sessions(organization_id,employee_id,starts_at);
INSERT INTO work_schedule_sessions(organization_id,daily_schedule_id,employee_id,session_no,shift_id,shift_revision_id,starts_at,ends_at,rules)
 SELECT d.organization_id,d.id,d.employee_id,1,d.shift_id,r.id,d.scheduled_start_at,d.scheduled_end_at,r.rules
 FROM employee_daily_schedules d JOIN work_shift_revisions r ON r.organization_id=d.organization_id AND r.shift_id=d.shift_id
 WHERE d.status='scheduled' AND d.scheduled_start_at IS NOT NULL AND d.scheduled_end_at>d.scheduled_start_at;
CREATE TABLE work_schedule_requests (
 organization_id bigint NOT NULL REFERENCES organizations(id),actor_user_id bigint NOT NULL REFERENCES users(id),
 operation varchar(40) NOT NULL,request_key uuid NOT NULL,payload_hash varchar(64) NOT NULL,
 result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,actor_user_id,operation,request_key)
);

INSERT INTO hris_menu_definitions(code,label,group_label,route_path,can_manage) VALUES
 ('work-shifts','Shift & Pola Kerja','Data Master','/master-data/work-shifts',true),
 ('work-calendars','Kalender Libur','Pengaturan Organisasi','/organization-settings/work-calendars',true),
 ('work-schedules','Jadwal Kerja','Kepegawaian','/work-schedules',true);
COMMENT ON TABLE work_schedule_sessions IS 'Sesi jadwal; range fleksibel adalah reservasi jendela, bukan jam aktual kehadiran.';
COMMENT ON COLUMN work_shifts.start_time IS 'Kolom legacy; sumber aturan efektif baru adalah work_shift_revisions.rules.';
COMMENT ON TABLE work_schedule_exceptions IS 'Jadwal khusus oleh HRD; bukan persetujuan lembur atau penggantian waktu.';
