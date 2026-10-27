-- Sesi native terpisah dari cookie web; credential mentah tidak disimpan.
CREATE TABLE mobile_auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id bigint NOT NULL REFERENCES organizations(id),
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_id bigint NOT NULL,
  role_assignment_id bigint NOT NULL,
  credential_version integer NOT NULL CHECK (credential_version>0),
  token_hash varchar(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT fk_mobile_session_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id),
  CONSTRAINT fk_mobile_session_membership FOREIGN KEY (organization_id,role_assignment_id) REFERENCES user_organization_roles(organization_id,id),
  CONSTRAINT ck_mobile_session_expiry CHECK (expires_at>created_at AND expires_at<=created_at+interval '7 days'),
  CONSTRAINT ck_mobile_session_revocation CHECK (revoked_at IS NULL OR revoked_at>=created_at)
);
CREATE INDEX ix_mobile_sessions_expiry ON mobile_auth_sessions(expires_at);
CREATE INDEX ix_mobile_sessions_actor ON mobile_auth_sessions(organization_id,user_id) WHERE revoked_at IS NULL;
COMMENT ON TABLE mobile_auth_sessions IS 'Sesi bearer native 7 hari, hash saja, tidak memberi akses cookie web.';
