-- Fix: Imported batches could not be deleted once orders had been packed.
--
-- Root causes:
--   1) public.imports had no DELETE policy at all, so the import history
--      row could never be removed by anyone, regardless of packing state.
--   2) public.packing_records and public.returns DELETE policies were
--      Owner-only, while the Imports page's UI allows Owner OR Supervisor
--      to trigger a batch delete. A Supervisor's delete request would be
--      silently denied by RLS specifically once a packing_records row
--      existed for an order in that batch (i.e. once it had been packed).
--
-- This migration adds the missing imports DELETE policy and widens the
-- packing_records / returns DELETE policies to Owner-or-Supervisor, using
-- the same private.is_member_of / private.has_role idiom already used by
-- orders and order_items DELETE policies.

CREATE POLICY "Managers delete imports" ON public.imports
  FOR DELETE TO authenticated
  USING (
    private.is_member_of(auth.uid(), workspace_id)
    AND (
      private.has_role(auth.uid(), 'Owner'::public.app_role)
      OR private.has_role(auth.uid(), 'Supervisor'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "Owners delete packing records" ON public.packing_records;
CREATE POLICY "Managers delete packing records" ON public.packing_records
  FOR DELETE TO authenticated
  USING (
    private.is_member_of(auth.uid(), workspace_id)
    AND (
      private.has_role(auth.uid(), 'Owner'::public.app_role)
      OR private.has_role(auth.uid(), 'Supervisor'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "Owners delete returns" ON public.returns;
CREATE POLICY "Managers delete returns" ON public.returns
  FOR DELETE TO authenticated
  USING (
    private.is_member_of(auth.uid(), workspace_id)
    AND (
      private.has_role(auth.uid(), 'Owner'::public.app_role)
      OR private.has_role(auth.uid(), 'Supervisor'::public.app_role)
    )
  );
