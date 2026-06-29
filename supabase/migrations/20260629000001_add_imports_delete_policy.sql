-- Add missing DELETE policy on imports table.
-- Without this, RLS silently blocks all deletes even for Owner/Supervisor.

CREATE POLICY "Managers delete imports"
  ON public.imports
  FOR DELETE
  TO authenticated
  USING (
    private.is_member_of(auth.uid(), workspace_id)
    AND (
      private.has_role(auth.uid(), 'Owner')
      OR private.has_role(auth.uid(), 'Supervisor')
    )
  );
