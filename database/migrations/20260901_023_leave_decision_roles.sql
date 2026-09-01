BEGIN;

-- Menyamakan database yang sempat menerima migration 022 awal dengan kontrak final.
UPDATE leave_types
SET required_attachment_category=CASE WHEN category='sick' THEN 'medical_letter' ELSE 'leave_attachment' END
WHERE requires_attachment AND required_attachment_category IS NULL;

UPDATE leave_requests
SET cancelled_at=COALESCE(cancelled_at,updated_at,now()),
    cancelled_by_user_id=COALESCE(cancelled_by_user_id,created_by_user_id),
    cancellation_reason=COALESCE(NULLIF(btrim(cancellation_reason),''),'Pembatalan lama sebelum workflow cuti dan izin diterapkan.')
WHERE status='cancelled';

ALTER TABLE leave_decisions DROP CONSTRAINT IF EXISTS leave_decisions_decision_role_check;
ALTER TABLE leave_decisions DROP CONSTRAINT IF EXISTS ck_leave_decisions_role;
ALTER TABLE leave_decisions
  ADD CONSTRAINT ck_leave_decisions_role CHECK (decision_role IN ('hrd','superadmin'));

COMMIT;
