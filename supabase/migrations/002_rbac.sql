-- ============================================================
-- Sri Manakula Vinayagar Devasthanam — RBAC Migration
-- Version: 1.1  |  Date: September 2026
-- ============================================================

-- 1. Create Roles Table
CREATE TABLE IF NOT EXISTS roles (
  name TEXT PRIMARY KEY,
  permissions JSONB NOT NULL DEFAULT '{}'
);

-- 2. Seed Default Roles
INSERT INTO roles (name, permissions) VALUES 
  ('super_admin', '{"manage_users": true, "manage_roles": true, "manage_services": true, "manage_bookings": true, "manage_calendar": true, "manage_notices": true, "view_reports": true, "manage_exemptions": true}'),
  ('admin', '{"manage_users": false, "manage_roles": false, "manage_services": true, "manage_bookings": true, "manage_calendar": true, "manage_notices": true, "view_reports": true, "manage_exemptions": true}'),
  ('staff', '{"manage_users": false, "manage_roles": false, "manage_services": false, "manage_bookings": true, "manage_calendar": false, "manage_notices": false, "view_reports": false, "manage_exemptions": false}'),
  ('devotee', '{}')
ON CONFLICT (name) DO UPDATE SET permissions = EXCLUDED.permissions;

-- 3. Convert user_role enum to TEXT on the users table and add FK
ALTER TABLE users ALTER COLUMN role TYPE TEXT USING role::TEXT;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT fk_role FOREIGN KEY (role) REFERENCES roles(name);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Drop the old enum if we want, but it's safer to just leave it if other things depend on it (though we altered users.role so it's disconnected)
-- DROP TYPE IF EXISTS user_role;

-- 4. Update get_my_role() to return TEXT
DROP FUNCTION IF EXISTS get_my_role() CASCADE;
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$;

-- 5. Helper function for RLS to check permissions
CREATE OR REPLACE FUNCTION has_permission(perm_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE((permissions->>perm_name)::boolean, false)
  FROM roles 
  WHERE name = get_my_role();
$$;

-- 6. Update RLS Policies to use permissions instead of hardcoded roles

-- users
DROP POLICY IF EXISTS "Admins can view all users" ON users;
CREATE POLICY "Admins can view all users" ON users FOR SELECT
  USING (has_permission('manage_users') OR get_my_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "Super admin can update roles" ON users;
CREATE POLICY "Super admin can update roles" ON users FOR UPDATE
  USING (has_permission('manage_users'));

-- services
DROP POLICY IF EXISTS "Admins can manage services" ON services;
CREATE POLICY "Admins can manage services" ON services FOR ALL
  USING (has_permission('manage_services'));

-- bookings
DROP POLICY IF EXISTS "Admins see all bookings" ON bookings;
CREATE POLICY "Admins see all bookings" ON bookings FOR SELECT
  USING (has_permission('manage_bookings'));

DROP POLICY IF EXISTS "Admins update bookings" ON bookings;
CREATE POLICY "Admins update bookings" ON bookings FOR UPDATE
  USING (has_permission('manage_bookings'));

-- e_undiyal
DROP POLICY IF EXISTS "Admins see all donations" ON e_undiyal_transactions;
CREATE POLICY "Admins see all donations" ON e_undiyal_transactions FOR SELECT
  USING (has_permission('manage_bookings') OR has_permission('view_reports'));

-- tax_exemptions
DROP POLICY IF EXISTS "Admins manage exemptions" ON tax_exemptions;
CREATE POLICY "Admins manage exemptions" ON tax_exemptions FOR ALL
  USING (has_permission('manage_exemptions'));

-- notices
DROP POLICY IF EXISTS "Admins manage notices" ON notices;
CREATE POLICY "Admins manage notices" ON notices FOR ALL
  USING (has_permission('manage_notices'));

-- audit_logs
DROP POLICY IF EXISTS "Admins read audit logs" ON audit_logs;
CREATE POLICY "Admins read audit logs" ON audit_logs FOR SELECT
  USING (has_permission('manage_users') OR has_permission('view_reports'));

-- Enable RLS on roles table
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read roles" ON roles FOR SELECT USING (true);
CREATE POLICY "Users with manage_roles can manage roles" ON roles FOR ALL
  USING (has_permission('manage_roles'));
