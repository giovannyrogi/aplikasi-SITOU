-- Parameter: $1 email tambahan, $2 username, $3 password_hash, $4 nama profil platform.
WITH selected_role AS (
  SELECT id FROM roles WHERE code='superadmin' AND scope='platform' LIMIT 1
),
inserted_user AS (
  INSERT INTO users (username,password_hash,is_active)
  SELECT $2,$3,true FROM selected_role RETURNING id
),
inserted_profile AS (
  INSERT INTO platform_user_profiles(user_id,full_name,email)
  SELECT inserted_user.id,$4,$1 FROM inserted_user RETURNING user_id
)
INSERT INTO user_organization_roles(user_id,organization_id,role_id,active_from,created_by_user_id)
SELECT inserted_profile.user_id,NULL,selected_role.id,now(),NULL
FROM inserted_profile CROSS JOIN selected_role
RETURNING user_id;
