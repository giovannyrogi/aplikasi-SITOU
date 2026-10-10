-- Delegasi akun Pegawai terpisah dari penggunaan fitur dan administrasi HRIS penuh.
ALTER TABLE user_hris_access_settings
 ADD COLUMN can_manage_employee_accounts boolean NOT NULL DEFAULT false,
 ADD COLUMN can_delegate_employee_features boolean NOT NULL DEFAULT false,
 ADD CONSTRAINT hris_delegation_requires_account_management
 CHECK (NOT can_delegate_employee_features OR can_manage_employee_accounts);
