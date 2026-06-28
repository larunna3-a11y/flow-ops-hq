
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login timestamptz;

CREATE TABLE IF NOT EXISTS public.packing_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  tracking_number text,
  marketplace text,
  courier text,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, order_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packing_orders TO authenticated;
GRANT ALL ON public.packing_orders TO service_role;
ALTER TABLE public.packing_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "packing_orders_select" ON public.packing_orders
  FOR SELECT TO authenticated
  USING (workspace_id = private.current_workspace_id());
CREATE POLICY "packing_orders_insert" ON public.packing_orders
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = private.current_workspace_id());
CREATE POLICY "packing_orders_update" ON public.packing_orders
  FOR UPDATE TO authenticated
  USING (workspace_id = private.current_workspace_id())
  WITH CHECK (workspace_id = private.current_workspace_id());
CREATE POLICY "packing_orders_delete" ON public.packing_orders
  FOR DELETE TO authenticated
  USING (private.is_workspace_owner(auth.uid(), workspace_id));

CREATE INDEX IF NOT EXISTS packing_orders_workspace_idx ON public.packing_orders(workspace_id);
CREATE INDEX IF NOT EXISTS packing_orders_tracking_idx ON public.packing_orders(workspace_id, tracking_number);

CREATE TRIGGER packing_orders_set_updated_at
  BEFORE UPDATE ON public.packing_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  report_type text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_url text,
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_select" ON public.reports
  FOR SELECT TO authenticated
  USING (workspace_id = private.current_workspace_id());
CREATE POLICY "reports_insert" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = private.current_workspace_id() AND generated_by = auth.uid());
CREATE POLICY "reports_delete" ON public.reports
  FOR DELETE TO authenticated
  USING (private.is_workspace_owner(auth.uid(), workspace_id));

CREATE INDEX IF NOT EXISTS reports_workspace_idx ON public.reports(workspace_id, generated_at DESC);

CREATE OR REPLACE FUNCTION public.touch_last_login()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles SET last_login = now() WHERE id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.touch_last_login() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_login() TO authenticated;
