-- Kelompok pilihan shift. Tidak mengubah penetapan atau histori yang sudah ada.
CREATE TABLE work_schedule_groups (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 organization_id bigint NOT NULL REFERENCES organizations(id),
 name varchar(100) NOT NULL CHECK(length(btrim(name))>0),
 working_days smallint[] NOT NULL CHECK(cardinality(working_days) BETWEEN 1 AND 7 AND working_days <@ ARRAY[1,2,3,4,5,6,7]::smallint[]),
 calendar_id bigint,
 holiday_policy varchar(10) NOT NULL CHECK(holiday_policy IN ('calendar','roster')),
 is_active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),
 FOREIGN KEY(organization_id,calendar_id) REFERENCES work_calendars(organization_id,id),
 CHECK(holiday_policy<>'calendar' OR calendar_id IS NOT NULL)
);
CREATE UNIQUE INDEX uq_work_schedule_groups_name ON work_schedule_groups(organization_id,lower(btrim(name)));
CREATE TABLE work_schedule_group_items (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 organization_id bigint NOT NULL REFERENCES organizations(id),
 group_id bigint NOT NULL,
 pattern_id bigint NOT NULL,
 shift_id bigint NOT NULL,
 name varchar(100) NOT NULL CHECK(length(btrim(name))>0),
 position smallint NOT NULL CHECK(position BETWEEN 1 AND 16),
 is_current boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),
 UNIQUE(organization_id,pattern_id),
 UNIQUE(organization_id,shift_id),
 FOREIGN KEY(organization_id,group_id) REFERENCES work_schedule_groups(organization_id,id),
 FOREIGN KEY(organization_id,pattern_id) REFERENCES shift_patterns(organization_id,id),
 FOREIGN KEY(organization_id,shift_id) REFERENCES work_shifts(organization_id,id)
);
CREATE UNIQUE INDEX uq_work_schedule_group_item_name ON work_schedule_group_items(organization_id,group_id,lower(btrim(name))) WHERE is_current;
CREATE UNIQUE INDEX uq_work_schedule_group_item_position ON work_schedule_group_items(organization_id,group_id,position) WHERE is_current;
CREATE INDEX ix_work_schedule_group_items_group ON work_schedule_group_items(organization_id,group_id);
