-- Super admin RLS policies
-- Restricts platform admin tables/views to authenticated platform admins only.

-- Helper: true when current authenticated user is an active platform admin.
CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.user_id = check_user_id
      AND pa.is_active = true
  );
$$;

-- Helper: true when current authenticated user is an active super admin.
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.user_id = check_user_id
      AND pa.is_active = true
      AND pa.role = 'super_admin'
  );
$$;

-- Enable RLS on super admin tables.
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_announcement_deliveries ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- platform_admins
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS platform_admins_select_platform_admin ON public.platform_admins;
DROP POLICY IF EXISTS platform_admins_insert_super_admin ON public.platform_admins;
DROP POLICY IF EXISTS platform_admins_update_super_admin ON public.platform_admins;
DROP POLICY IF EXISTS platform_admins_delete_super_admin ON public.platform_admins;

CREATE POLICY platform_admins_select_platform_admin
ON public.platform_admins
FOR SELECT
TO authenticated
USING (public.is_platform_admin());

CREATE POLICY platform_admins_insert_super_admin
ON public.platform_admins
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

CREATE POLICY platform_admins_update_super_admin
ON public.platform_admins
FOR UPDATE
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY platform_admins_delete_super_admin
ON public.platform_admins
FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- admin_audit_logs
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS admin_audit_logs_select_platform_admin ON public.admin_audit_logs;
DROP POLICY IF EXISTS admin_audit_logs_insert_platform_admin ON public.admin_audit_logs;

CREATE POLICY admin_audit_logs_select_platform_admin
ON public.admin_audit_logs
FOR SELECT
TO authenticated
USING (public.is_platform_admin());

CREATE POLICY admin_audit_logs_insert_platform_admin
ON public.admin_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- user_login_history
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS user_login_history_select_platform_admin ON public.user_login_history;
DROP POLICY IF EXISTS user_login_history_insert_platform_admin ON public.user_login_history;

CREATE POLICY user_login_history_select_platform_admin
ON public.user_login_history
FOR SELECT
TO authenticated
USING (public.is_platform_admin());

CREATE POLICY user_login_history_insert_platform_admin
ON public.user_login_history
FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- admin_announcements
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS admin_announcements_select_platform_admin ON public.admin_announcements;
DROP POLICY IF EXISTS admin_announcements_insert_platform_admin ON public.admin_announcements;
DROP POLICY IF EXISTS admin_announcements_update_platform_admin ON public.admin_announcements;
DROP POLICY IF EXISTS admin_announcements_delete_super_admin ON public.admin_announcements;

CREATE POLICY admin_announcements_select_platform_admin
ON public.admin_announcements
FOR SELECT
TO authenticated
USING (public.is_platform_admin());

CREATE POLICY admin_announcements_insert_platform_admin
ON public.admin_announcements
FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin());

CREATE POLICY admin_announcements_update_platform_admin
ON public.admin_announcements
FOR UPDATE
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

CREATE POLICY admin_announcements_delete_super_admin
ON public.admin_announcements
FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- admin_announcement_deliveries
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS admin_announcement_deliveries_select_platform_admin ON public.admin_announcement_deliveries;
DROP POLICY IF EXISTS admin_announcement_deliveries_insert_platform_admin ON public.admin_announcement_deliveries;
DROP POLICY IF EXISTS admin_announcement_deliveries_update_platform_admin ON public.admin_announcement_deliveries;
DROP POLICY IF EXISTS admin_announcement_deliveries_delete_super_admin ON public.admin_announcement_deliveries;

CREATE POLICY admin_announcement_deliveries_select_platform_admin
ON public.admin_announcement_deliveries
FOR SELECT
TO authenticated
USING (public.is_platform_admin());

CREATE POLICY admin_announcement_deliveries_insert_platform_admin
ON public.admin_announcement_deliveries
FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin());

CREATE POLICY admin_announcement_deliveries_update_platform_admin
ON public.admin_announcement_deliveries
FOR UPDATE
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

CREATE POLICY admin_announcement_deliveries_delete_super_admin
ON public.admin_announcement_deliveries
FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Grants (API role access still gated by RLS)
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.platform_admins FROM anon;
REVOKE ALL ON TABLE public.admin_audit_logs FROM anon;
REVOKE ALL ON TABLE public.user_login_history FROM anon;
REVOKE ALL ON TABLE public.admin_announcements FROM anon;
REVOKE ALL ON TABLE public.admin_announcement_deliveries FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_admins TO authenticated;
GRANT SELECT, INSERT ON TABLE public.admin_audit_logs TO authenticated;
GRANT SELECT, INSERT ON TABLE public.user_login_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_announcement_deliveries TO authenticated;

REVOKE ALL ON TABLE public.v_admin_shop_kpis FROM anon;
REVOKE ALL ON TABLE public.v_admin_user_activity FROM anon;
REVOKE ALL ON TABLE public.v_admin_platform_daily_metrics FROM anon;
REVOKE ALL ON TABLE public.v_admin_billing_mrr FROM anon;

GRANT SELECT ON TABLE public.v_admin_shop_kpis TO authenticated;
GRANT SELECT ON TABLE public.v_admin_user_activity TO authenticated;
GRANT SELECT ON TABLE public.v_admin_platform_daily_metrics TO authenticated;
GRANT SELECT ON TABLE public.v_admin_billing_mrr TO authenticated;
