-- Migration 006: Fix Audit Logs Schema
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'action') THEN
      ALTER TABLE public.audit_logs RENAME COLUMN action TO action_type;
  END IF;
END $$;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_role TEXT;
ALTER TABLE public.audit_logs ALTER COLUMN entity_id TYPE TEXT USING entity_id::text;

-- Also update policies since the table existed previously
DROP POLICY IF EXISTS "Admins can insert logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Super admins can view logs" ON public.audit_logs;

CREATE POLICY "Admins can insert logs" ON public.audit_logs
    FOR INSERT
    WITH CHECK (
        has_permission('manage_bookings') OR 
        has_permission('manage_roles') OR 
        has_permission('manage_users') OR 
        has_permission('manage_services') OR 
        has_permission('manage_calendar') OR
        get_my_role() = 'admin' OR 
        get_my_role() = 'super_admin'
    );

CREATE POLICY "Super admins can view logs" ON public.audit_logs
    FOR SELECT
    USING (
        has_permission('manage_roles') OR get_my_role() = 'super_admin'
    );
