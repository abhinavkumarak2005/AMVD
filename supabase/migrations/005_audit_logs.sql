-- Migration 005: Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_name TEXT,
    user_role TEXT,
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow only admins and super admins to insert/view logs
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
