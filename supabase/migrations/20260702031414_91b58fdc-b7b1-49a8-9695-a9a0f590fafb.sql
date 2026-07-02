
-- 1) connectors: restrict SELECT to active workspace members
DROP POLICY IF EXISTS "Authenticated can read connectors" ON public.connectors;
CREATE POLICY "Workspace members can read connectors"
  ON public.connectors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND u.status = 'active'
    )
  );

-- 2) detection_rules_update: align WITH CHECK with USING (require Owner/Supervisor)
DROP POLICY IF EXISTS detection_rules_update ON public.detection_rules;
CREATE POLICY detection_rules_update
  ON public.detection_rules
  FOR UPDATE
  TO authenticated
  USING (
    (is_global = false)
    AND (workspace_id IS NOT NULL)
    AND private.is_member_of(auth.uid(), workspace_id)
    AND (
      private.is_workspace_owner(auth.uid(), workspace_id)
      OR private.has_role(auth.uid(), 'Supervisor'::app_role)
    )
  )
  WITH CHECK (
    (is_global = false)
    AND (workspace_id IS NOT NULL)
    AND private.is_member_of(auth.uid(), workspace_id)
    AND (
      private.is_workspace_owner(auth.uid(), workspace_id)
      OR private.has_role(auth.uid(), 'Supervisor'::app_role)
    )
  );

-- 3) return_timeline: add UPDATE/DELETE policies for Owners/Supervisors
CREATE POLICY "Managers can update return_timeline"
  ON public.return_timeline
  FOR UPDATE
  TO authenticated
  USING (
    private.is_member_of(auth.uid(), workspace_id)
    AND (
      private.is_workspace_owner(auth.uid(), workspace_id)
      OR private.has_role(auth.uid(), 'Supervisor'::app_role)
    )
  )
  WITH CHECK (
    private.is_member_of(auth.uid(), workspace_id)
    AND (
      private.is_workspace_owner(auth.uid(), workspace_id)
      OR private.has_role(auth.uid(), 'Supervisor'::app_role)
    )
  );

CREATE POLICY "Managers can delete return_timeline"
  ON public.return_timeline
  FOR DELETE
  TO authenticated
  USING (
    private.is_member_of(auth.uid(), workspace_id)
    AND (
      private.is_workspace_owner(auth.uid(), workspace_id)
      OR private.has_role(auth.uid(), 'Supervisor'::app_role)
    )
  );
