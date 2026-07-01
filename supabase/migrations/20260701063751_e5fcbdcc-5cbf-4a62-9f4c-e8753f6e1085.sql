
-- Track who last edited packing records and returns
ALTER TABLE public.packing_records ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS updated_by uuid;

-- Allow Supervisors (in addition to Owners) to delete packing records and returns,
-- so import-batch cleanup and manager corrections work.
DROP POLICY IF EXISTS "Owners delete packing records" ON public.packing_records;
CREATE POLICY "Managers delete packing records" ON public.packing_records
  FOR DELETE USING (
    private.is_member_of(auth.uid(), workspace_id)
    AND (private.has_role(auth.uid(), 'Owner'::app_role)
         OR private.has_role(auth.uid(), 'Supervisor'::app_role))
  );

DROP POLICY IF EXISTS "Owners delete returns" ON public.returns;
CREATE POLICY "Managers delete returns" ON public.returns
  FOR DELETE USING (
    private.is_member_of(auth.uid(), workspace_id)
    AND (private.has_role(auth.uid(), 'Owner'::app_role)
         OR private.has_role(auth.uid(), 'Supervisor'::app_role))
  );

-- Restrict packing edits to the packer who submitted it (or Owner/Supervisor).
-- (Existing policy already does this — recreated defensively.)
DROP POLICY IF EXISTS "Members update packing records" ON public.packing_records;
CREATE POLICY "Members update packing records" ON public.packing_records
  FOR UPDATE USING (
    private.is_member_of(auth.uid(), workspace_id)
    AND (user_id = auth.uid()
         OR private.has_role(auth.uid(), 'Owner'::app_role)
         OR private.has_role(auth.uid(), 'Supervisor'::app_role))
  );

-- Restrict return edits to the return-staff who inspected it (or Owner/Supervisor).
DROP POLICY IF EXISTS "Members update returns" ON public.returns;
CREATE POLICY "Members update returns" ON public.returns
  FOR UPDATE USING (
    private.is_member_of(auth.uid(), workspace_id)
    AND (inspector_id IS NULL
         OR inspector_id = auth.uid()
         OR private.has_role(auth.uid(), 'Owner'::app_role)
         OR private.has_role(auth.uid(), 'Supervisor'::app_role))
  );

-- Managers can delete import history rows (Sprint 2 cleanup).
DROP POLICY IF EXISTS "Managers delete imports" ON public.imports;
CREATE POLICY "Managers delete imports" ON public.imports
  FOR DELETE USING (
    private.is_member_of(auth.uid(), workspace_id)
    AND (private.has_role(auth.uid(), 'Owner'::app_role)
         OR private.has_role(auth.uid(), 'Supervisor'::app_role))
  );

-- Track batch membership so we can delete every row an import produced
-- without relying on a fragile ±60s time-window heuristic.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS import_id uuid;
CREATE INDEX IF NOT EXISTS orders_import_id_idx ON public.orders (import_id);
