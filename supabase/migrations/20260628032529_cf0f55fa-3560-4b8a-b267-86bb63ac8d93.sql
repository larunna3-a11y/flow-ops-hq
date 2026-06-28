CREATE TABLE public.packing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  role text,
  scan_timestamp timestamptz NOT NULL DEFAULT now(),
  packing_timestamp timestamptz,
  raw_code text NOT NULL,
  order_number text,
  tracking_number text,
  marketplace text,
  courier text,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Packed','Shipped','Cancelled')),
  verified_skus jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_skus jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_quantity integer NOT NULL DEFAULT 0,
  completion_status text NOT NULL DEFAULT 'Complete',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX packing_records_workspace_rawcode_key ON public.packing_records(workspace_id, raw_code);
CREATE UNIQUE INDEX packing_records_workspace_tracking_key ON public.packing_records(workspace_id, tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX packing_records_workspace_created_idx ON public.packing_records(workspace_id, created_at DESC);
CREATE INDEX packing_records_workspace_marketplace_idx ON public.packing_records(workspace_id, marketplace);
CREATE INDEX packing_records_workspace_courier_idx ON public.packing_records(workspace_id, courier);
CREATE INDEX packing_records_workspace_status_idx ON public.packing_records(workspace_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packing_records TO authenticated;
GRANT ALL ON public.packing_records TO service_role;
ALTER TABLE public.packing_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view packing records" ON public.packing_records FOR SELECT TO authenticated USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Members create packing records" ON public.packing_records FOR INSERT TO authenticated WITH CHECK (private.is_member_of(auth.uid(), workspace_id) AND user_id = auth.uid());
CREATE POLICY "Members update packing records" ON public.packing_records FOR UPDATE TO authenticated USING (private.is_member_of(auth.uid(), workspace_id) AND (user_id = auth.uid() OR private.has_role(auth.uid(), 'Owner'::public.app_role) OR private.has_role(auth.uid(), 'Supervisor'::public.app_role))) WITH CHECK (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Owners delete packing records" ON public.packing_records FOR DELETE TO authenticated USING (private.is_workspace_owner(auth.uid(), workspace_id));
CREATE TRIGGER packing_records_updated_at BEFORE UPDATE ON public.packing_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  rma text NOT NULL,
  order_number text,
  marketplace text,
  reason text,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','inspecting','restocked','rejected')),
  assigned_to uuid,
  assigned_to_name text,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, rma)
);
CREATE INDEX returns_workspace_created_idx ON public.returns(workspace_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.returns TO authenticated;
GRANT ALL ON public.returns TO service_role;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view returns" ON public.returns FOR SELECT TO authenticated USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Members create returns" ON public.returns FOR INSERT TO authenticated WITH CHECK (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Members update returns" ON public.returns FOR UPDATE TO authenticated USING (private.is_member_of(auth.uid(), workspace_id)) WITH CHECK (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Owners delete returns" ON public.returns FOR DELETE TO authenticated USING (private.is_workspace_owner(auth.uid(), workspace_id));
CREATE TRIGGER returns_updated_at BEFORE UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION private.log_activity(_actor_id uuid, _action text, _target_type text DEFAULT NULL, _target_id text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_workspace uuid; v_id uuid;
BEGIN
  IF _actor_id IS NULL THEN RETURN NULL; END IF;
  SELECT workspace_id INTO v_workspace FROM public.users WHERE user_id = _actor_id LIMIT 1;
  IF v_workspace IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.audit_logs(workspace_id, actor_id, action, target_type, target_id, metadata)
  VALUES (v_workspace, _actor_id, _action, _target_type, _target_id, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE EXECUTE ON FUNCTION private.log_activity(uuid,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.log_activity(uuid,text,text,text,jsonb) TO authenticated, service_role;

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
CREATE POLICY "Members read stores" ON public.stores FOR SELECT TO authenticated USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Managers insert stores" ON public.stores FOR INSERT TO authenticated WITH CHECK (private.is_member_of(auth.uid(), workspace_id) AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor')));
CREATE POLICY "Managers update stores" ON public.stores FOR UPDATE TO authenticated USING (private.is_member_of(auth.uid(), workspace_id) AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor'))) WITH CHECK (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Managers delete stores" ON public.stores FOR DELETE TO authenticated USING (private.is_member_of(auth.uid(), workspace_id) AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor')));
CREATE TRIGGER stores_set_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
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
  packed_by uuid,
  packed_by_name text,
  packed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read orders" ON public.orders FOR SELECT TO authenticated USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Managers insert orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (private.is_member_of(auth.uid(), workspace_id) AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor')));
CREATE POLICY "Managers or assignee update orders" ON public.orders FOR UPDATE TO authenticated USING (private.is_member_of(auth.uid(), workspace_id) AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor') OR assigned_to = auth.uid())) WITH CHECK (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Managers delete orders" ON public.orders FOR DELETE TO authenticated USING (private.is_member_of(auth.uid(), workspace_id) AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor')));
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
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
CREATE POLICY "Members read assignments" ON public.order_assignments FOR SELECT TO authenticated USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Managers insert assignments" ON public.order_assignments FOR INSERT TO authenticated WITH CHECK (private.is_member_of(auth.uid(), workspace_id) AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor')));
CREATE POLICY "Managers update assignments" ON public.order_assignments FOR UPDATE TO authenticated USING (private.is_member_of(auth.uid(), workspace_id) AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor'))) WITH CHECK (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Managers delete assignments" ON public.order_assignments FOR DELETE TO authenticated USING (private.is_member_of(auth.uid(), workspace_id) AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor')));
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
CREATE POLICY "Members read imports" ON public.imports FOR SELECT TO authenticated USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Managers insert imports" ON public.imports FOR INSERT TO authenticated WITH CHECK (private.is_member_of(auth.uid(), workspace_id) AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor')));
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
CREATE POLICY "Members read import logs" ON public.import_logs FOR SELECT TO authenticated USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Managers insert import logs" ON public.import_logs FOR INSERT TO authenticated WITH CHECK (private.is_member_of(auth.uid(), workspace_id) AND (private.has_role(auth.uid(), 'Owner') OR private.has_role(auth.uid(), 'Supervisor')));
CREATE INDEX import_logs_import_idx ON public.import_logs(import_id);
CREATE INDEX import_logs_workspace_idx ON public.import_logs(workspace_id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login timestamptz;

CREATE TABLE public.packing_orders (
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
CREATE POLICY "packing_orders_select" ON public.packing_orders FOR SELECT TO authenticated USING (workspace_id = private.current_workspace_id() AND private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "packing_orders_insert" ON public.packing_orders FOR INSERT TO authenticated WITH CHECK (workspace_id = private.current_workspace_id());
CREATE POLICY "packing_orders_update" ON public.packing_orders FOR UPDATE TO authenticated USING (workspace_id = private.current_workspace_id()) WITH CHECK (workspace_id = private.current_workspace_id());
CREATE POLICY "packing_orders_delete" ON public.packing_orders FOR DELETE TO authenticated USING (private.is_workspace_owner(auth.uid(), workspace_id));
CREATE INDEX packing_orders_workspace_idx ON public.packing_orders(workspace_id);
CREATE INDEX packing_orders_tracking_idx ON public.packing_orders(workspace_id, tracking_number);
CREATE TRIGGER packing_orders_set_updated_at BEFORE UPDATE ON public.packing_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.reports (
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
CREATE POLICY "reports_select" ON public.reports FOR SELECT TO authenticated USING (workspace_id = private.current_workspace_id() AND private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "reports_insert" ON public.reports FOR INSERT TO authenticated WITH CHECK (workspace_id = private.current_workspace_id() AND generated_by = auth.uid());
CREATE POLICY "reports_delete" ON public.reports FOR DELETE TO authenticated USING (private.is_workspace_owner(auth.uid(), workspace_id));
CREATE INDEX reports_workspace_idx ON public.reports(workspace_id, generated_at DESC);

CREATE OR REPLACE FUNCTION public.touch_last_login()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET last_login = now() WHERE id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.touch_last_login() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_last_login() TO service_role;