-- Parameter query:
-- $1 email, $2 username, $3 password_hash bcrypt, $4 full_name.
WITH selected_role AS (
  SELECT id
  FROM roles
  WHERE code = 'superadmin'
    AND scope = 'platform'
  LIMIT 1
),
inserted_user AS (
  INSERT INTO users (email, username, password_hash, full_name, is_active, email_verified_at)
  SELECT $1, $2, $3, $4, true, now()
  FROM selected_role
  RETURNING id
)
INSERT INTO user_organization_roles (
  user_id,
  organization_id,
  role_id,
  active_from,
  created_by_user_id
)
SELECT inserted_user.id, NULL, selected_role.id, now(), NULL
FROM inserted_user
CROSS JOIN selected_role
RETURNING user_id;

