
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  marketplace text NOT NULL,
  logo_url text,
  store_status text NOT NULL DEFAULT 'active',
  connection_status text NOT NULL DEFAULT 'disconnected',
  last_sync_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read stores" ON public.stores FOR SELECT TO authenticated
  USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Managers insert stores" ON public.stores FOR INSERT TO authenticated
  WITH CHECK (private.is_member_of(auth.uid(), workspace_id)
    AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor')));
CREATE POLICY "Managers update stores" ON public.stores FOR UPDATE TO authenticated
  USING (private.is_member_of(auth.uid(), workspace_id)
    AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor')))
  WITH CHECK (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Managers delete stores" ON public.stores FOR DELETE TO authenticated
  USING (private.is_member_of(auth.uid(), workspace_id)
    AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor')));
CREATE TRIGGER stores_set_updated_at BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX stores_workspace_idx ON public.stores(workspace_id);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  order_number text NOT NULL,
  marketplace text,
  store_name text,
  customer_name text,
  tracking_number text,
  courier text,
  order_status text NOT NULL DEFAULT 'new',
  packing_status text NOT NULL DEFAULT 'waiting',
  assigned_to uuid,
  assigned_to_name text,
  assigned_at timestamptz,
  ordered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read orders" ON public.orders FOR SELECT TO authenticated
  USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Managers insert orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (private.is_member_of(auth.uid(), workspace_id)
    AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor')));
CREATE POLICY "Managers or assignee update orders" ON public.orders FOR UPDATE TO authenticated
  USING (private.is_member_of(auth.uid(), workspace_id)
    AND (
      private.has_role(auth.uid(), 'Owner')
      OR private.has_role(auth.uid(), 'Supervisor')
      OR assigned_to = auth.uid()
    ))
  WITH CHECK (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Managers delete orders" ON public.orders FOR DELETE TO authenticated
  USING (private.is_member_of(auth.uid(), workspace_id)
    AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor')));
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX orders_workspace_idx ON public.orders(workspace_id);
CREATE INDEX orders_workspace_status_idx ON public.orders(workspace_id, packing_status);
CREATE UNIQUE INDEX orders_workspace_order_number_idx ON public.orders(workspace_id, order_number);

CREATE TABLE public.order_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  packer_id uuid NOT NULL,
  packer_name text NOT NULL,
  assigned_by uuid,
  assigned_by_name text,
  status text NOT NULL DEFAULT 'assigned',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_assignments TO authenticated;
GRANT ALL ON public.order_assignments TO service_role;
ALTER TABLE public.order_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read assignments" ON public.order_assignments FOR SELECT TO authenticated
  USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Managers insert assignments" ON public.order_assignments FOR INSERT TO authenticated
  WITH CHECK (private.is_member_of(auth.uid(), workspace_id)
    AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor')));
CREATE POLICY "Managers update assignments" ON public.order_assignments FOR UPDATE TO authenticated
  USING (private.is_member_of(auth.uid(), workspace_id)
    AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor')))
  WITH CHECK (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Managers delete assignments" ON public.order_assignments FOR DELETE TO authenticated
  USING (private.is_member_of(auth.uid(), workspace_id)
    AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor')));
CREATE INDEX order_assignments_workspace_idx ON public.order_assignments(workspace_id);
CREATE INDEX order_assignments_order_idx ON public.order_assignments(order_id);

CREATE TABLE public.imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  imported_by uuid,
  imported_by_name text,
  filename text,
  total_rows int NOT NULL DEFAULT 0,
  success_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  duplicate_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imports TO authenticated;
GRANT ALL ON public.imports TO service_role;
ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read imports" ON public.imports FOR SELECT TO authenticated
  USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Managers insert imports" ON public.imports FOR INSERT TO authenticated
  WITH CHECK (private.is_member_of(auth.uid(), workspace_id)
    AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor')));
CREATE INDEX imports_workspace_idx ON public.imports(workspace_id, created_at DESC);

CREATE TABLE public.import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  import_id uuid NOT NULL REFERENCES public.imports(id) ON DELETE CASCADE,
  row_number int,
  order_number text,
  status text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_logs TO authenticated;
GRANT ALL ON public.import_logs TO service_role;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read import logs" ON public.import_logs FOR SELECT TO authenticated
  USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Managers insert import logs" ON public.import_logs FOR INSERT TO authenticated
  WITH CHECK (private.is_member_of(auth.uid(), workspace_id)
    AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor')));
CREATE INDEX import_logs_import_idx ON public.import_logs(import_id);
CREATE INDEX import_logs_workspace_idx ON public.import_logs(workspace_id);
