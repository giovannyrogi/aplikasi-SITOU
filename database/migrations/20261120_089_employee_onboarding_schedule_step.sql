-- Mempertahankan checkpoint draft lama dan menerima langkah kelima Jadwal kerja.
ALTER TABLE employee_onboarding_drafts
  DROP CONSTRAINT ck_employee_onboarding_draft_current_step,
  ADD CONSTRAINT ck_employee_onboarding_draft_current_step
    CHECK (current_step BETWEEN 0 AND 4);
