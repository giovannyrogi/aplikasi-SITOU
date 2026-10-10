ALTER TABLE stored_files DROP CONSTRAINT ck_stored_files_category;
ALTER TABLE stored_files ADD CONSTRAINT ck_stored_files_category CHECK(category IN (
 'logo','employee_photo','attendance_photo','medical_letter','leave_attachment','contract',
 'assignment_decree','discipline_letter','identity','education','employee_import_source','other','inventory_item_photo'
));
