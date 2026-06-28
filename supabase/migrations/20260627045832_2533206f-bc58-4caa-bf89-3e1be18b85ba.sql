
-- 1. Revoke EXECUTE on SECURITY DEFINER function from authenticated
REVOKE EXECUTE ON FUNCTION public.touch_last_login() FROM authenticated, PUBLIC, anon;

-- 2. connector_connections: restrict SELECT to Owners
DROP POLICY IF EXISTS "Members view connections" ON public.connector_connections;
CREATE POLICY "Owners view connections" ON public.connector_connections
  FOR SELECT
  USING (
    workspace_id = private.current_workspace_id()
    AND private.is_member_of(auth.uid(), workspace_id)
    AND private.has_role(auth.uid(), 'Owner'::app_role)
  );

-- 3. invitations: allow invitee to SELECT their own pending invitation
CREATE POLICY "Invitees view own invitations" ON public.invitations
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower((SELECT au.email FROM auth.users au WHERE au.id = auth.uid()))
  );

-- 4. reports + packing_orders: add explicit membership check
DROP POLICY IF EXISTS reports_select ON public.reports;
CREATE POLICY reports_select ON public.reports
  FOR SELECT
  USING (
    workspace_id = private.current_workspace_id()
    AND private.is_member_of(auth.uid(), workspace_id)
  );

DROP POLICY IF EXISTS packing_orders_select ON public.packing_orders;
CREATE POLICY packing_orders_select ON public.packing_orders
  FOR SELECT
  USING (
    workspace_id = private.current_workspace_id()
    AND private.is_member_of(auth.uid(), workspace_id)
  );

-- Also tighten owner-restricted connector SELECT consistency for update/insert (membership check)
DROP POLICY IF EXISTS "Owners update connections" ON public.connector_connections;
CREATE POLICY "Owners update connections" ON public.connector_connections
  FOR UPDATE
  USING (
    workspace_id = private.current_workspace_id()
    AND private.is_member_of(auth.uid(), workspace_id)
    AND private.has_role(auth.uid(), 'Owner'::app_role)
  )
  WITH CHECK (
    workspace_id = private.current_workspace_id()
    AND private.is_member_of(auth.uid(), workspace_id)
  );
