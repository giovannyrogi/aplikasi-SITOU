-- Relasi penggantian eksplisit dan penghapusan logis kasus tanpa tindakan.
ALTER TABLE discipline_cases ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by_user_id bigint REFERENCES users(id);
ALTER TABLE disciplinary_actions ADD CONSTRAINT uq_actions_org_employee_id UNIQUE(organization_id,employee_id,id);
CREATE TABLE disciplinary_action_replacements (
  organization_id bigint NOT NULL REFERENCES organizations(id),
  employee_id bigint NOT NULL,
  predecessor_action_id bigint NOT NULL,
  successor_action_id bigint NOT NULL,
  created_by_user_id bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,predecessor_action_id,successor_action_id),
  CHECK(predecessor_action_id<>successor_action_id),
  FOREIGN KEY(organization_id,employee_id,predecessor_action_id) REFERENCES disciplinary_actions(organization_id,employee_id,id),
  FOREIGN KEY(organization_id,employee_id,successor_action_id) REFERENCES disciplinary_actions(organization_id,employee_id,id)
);
CREATE INDEX ix_action_replacement_successor ON disciplinary_action_replacements(organization_id,successor_action_id);
-- Histori hanya dihubungkan bila audit membuktikan satu publikasi pada request/pelaku yang sama.
WITH publication AS (
 SELECT organization_id,actor_user_id,request_id,entity_id,occurred_at,
 count(*) OVER(PARTITION BY organization_id,actor_user_id,request_id) AS n
 FROM audit_logs WHERE entity_type='disciplinary_action'
 AND action IN ('disciplinary_action.create','disciplinary_action.update')
 AND after_data->>'status'='active' AND request_id IS NOT NULL
)
INSERT INTO disciplinary_action_replacements(organization_id,employee_id,predecessor_action_id,successor_action_id,created_by_user_id,created_at)
SELECT DISTINCT old_action.organization_id,old_action.employee_id,old_action.id,new_action.id,p.actor_user_id,p.occurred_at
FROM publication p JOIN audit_logs old_audit ON old_audit.organization_id=p.organization_id
 AND old_audit.actor_user_id=p.actor_user_id AND old_audit.request_id=p.request_id
 AND old_audit.action='disciplinary_action.supersede' AND old_audit.entity_type='disciplinary_action'
JOIN disciplinary_actions old_action ON old_action.organization_id=p.organization_id AND old_action.id::text=old_audit.entity_id
JOIN disciplinary_actions new_action ON new_action.organization_id=p.organization_id AND new_action.id::text=p.entity_id
 AND new_action.employee_id=old_action.employee_id
WHERE p.n=1 AND old_action.id<>new_action.id ON CONFLICT DO NOTHING;
