ALTER TABLE inventory_transactions
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN draft_expires_at timestamptz,
  ADD COLUMN draft_discarded_at timestamptz,
  ADD COLUMN draft_step smallint NOT NULL DEFAULT 0 CHECK (draft_step BETWEEN 0 AND 3);
UPDATE inventory_transactions SET draft_expires_at=now()+interval '7 days' WHERE status='draft';
ALTER TABLE inventory_transactions ADD CONSTRAINT ck_inventory_draft_expiry
  CHECK ((status='draft' AND draft_expires_at IS NOT NULL) OR (status='posted' AND draft_expires_at IS NULL));
CREATE INDEX ix_inventory_draft_expiry ON inventory_transactions(draft_expires_at)
  WHERE status='draft';

ALTER TABLE stored_files ADD COLUMN inventory_transaction_draft_id uuid;
ALTER TABLE stored_files ADD CONSTRAINT fk_stored_file_inventory_draft
  FOREIGN KEY (organization_id,inventory_transaction_draft_id)
  REFERENCES inventory_transactions(organization_id,id);
ALTER TABLE stored_files DROP CONSTRAINT ck_stored_files_lifecycle_consistency;
ALTER TABLE stored_files ADD CONSTRAINT ck_stored_files_lifecycle_consistency CHECK (
  (lifecycle_status='draft' AND ((onboarding_draft_id IS NOT NULL AND inventory_transaction_draft_id IS NULL)
    OR (onboarding_draft_id IS NULL AND inventory_transaction_draft_id IS NOT NULL))
    AND draft_slot IS NOT NULL AND deleted_at IS NULL AND content_purged_at IS NULL)
  OR (lifecycle_status='active' AND deleted_at IS NULL AND content_purged_at IS NULL)
  OR (lifecycle_status='deleted' AND deleted_at IS NOT NULL AND content_purged_at IS NULL)
  OR (lifecycle_status='purged' AND deleted_at IS NOT NULL AND content_purged_at IS NOT NULL)
  OR (lifecycle_status='retained' AND deleted_at IS NOT NULL AND retained_at IS NOT NULL AND content_purged_at IS NULL)
  OR (lifecycle_status='quarantined' AND quarantined_at IS NOT NULL AND content_purged_at IS NULL)
);
CREATE UNIQUE INDEX uq_inventory_draft_file_slot
  ON stored_files(organization_id,inventory_transaction_draft_id,draft_slot)
  WHERE lifecycle_status='draft' AND inventory_transaction_draft_id IS NOT NULL;
CREATE INDEX ix_inventory_draft_file ON stored_files(organization_id,inventory_transaction_draft_id)
  WHERE inventory_transaction_draft_id IS NOT NULL AND deleted_at IS NULL;
