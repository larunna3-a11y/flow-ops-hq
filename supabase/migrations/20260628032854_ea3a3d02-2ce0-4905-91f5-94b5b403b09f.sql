ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS shipping_status text NOT NULL DEFAULT 'Pending';
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders (workspace_id, order_number);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON public.orders (workspace_id, tracking_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON public.orders (workspace_id, customer_name);
CREATE INDEX IF NOT EXISTS idx_orders_marketplace ON public.orders (workspace_id, marketplace);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON public.orders (workspace_id, order_status);
CREATE INDEX IF NOT EXISTS idx_orders_packing_status ON public.orders (workspace_id, packing_status);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sku text NOT NULL,
  sku_marketplace text,
  sku_master text,
  product_name text NOT NULL,
  product_variant text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  warehouse_location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read order_items" ON public.order_items FOR SELECT USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Managers insert order_items" ON public.order_items FOR INSERT WITH CHECK (private.is_member_of(auth.uid(), workspace_id) AND (private.has_role(auth.uid(), 'Owner'::app_role) OR private.has_role(auth.uid(), 'Supervisor'::app_role)));
CREATE POLICY "Managers update order_items" ON public.order_items FOR UPDATE USING (private.is_member_of(auth.uid(), workspace_id) AND (private.has_role(auth.uid(), 'Owner'::app_role) OR private.has_role(auth.uid(), 'Supervisor'::app_role))) WITH CHECK (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Managers delete order_items" ON public.order_items FOR DELETE USING (private.is_member_of(auth.uid(), workspace_id) AND (private.has_role(auth.uid(), 'Owner'::app_role) OR private.has_role(auth.uid(), 'Supervisor'::app_role)));
CREATE INDEX idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX idx_order_items_sku ON public.order_items (workspace_id, sku);
CREATE TRIGGER trg_order_items_updated_at BEFORE UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS return_number text,
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS courier text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS packing_record_id uuid REFERENCES public.packing_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS packer_name text,
  ADD COLUMN IF NOT EXISTS packing_date timestamptz,
  ADD COLUMN IF NOT EXISTS condition text,
  ADD COLUMN IF NOT EXISTS inspection_notes text,
  ADD COLUMN IF NOT EXISTS inspection_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS inspection_date timestamptz,
  ADD COLUMN IF NOT EXISTS inspector_id uuid,
  ADD COLUMN IF NOT EXISTS inspector_name text,
  ADD COLUMN IF NOT EXISTS resolution text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;
UPDATE public.returns SET return_number = rma WHERE return_number IS NULL;
CREATE UNIQUE INDEX returns_workspace_return_number_key ON public.returns (workspace_id, return_number);
CREATE INDEX returns_workspace_tracking_idx ON public.returns (workspace_id, tracking_number);
CREATE INDEX returns_workspace_order_number_idx ON public.returns (workspace_id, order_number);

CREATE TABLE public.return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  sku text,
  product_name text,
  product_variant text,
  original_quantity integer NOT NULL DEFAULT 0,
  returned_quantity integer NOT NULL DEFAULT 0,
  missing_quantity integer NOT NULL DEFAULT 0,
  damaged_quantity integer NOT NULL DEFAULT 0,
  wrong_quantity integer NOT NULL DEFAULT 0,
  inventory_action text NOT NULL DEFAULT 'none',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_items TO authenticated;
GRANT ALL ON public.return_items TO service_role;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view return_items" ON public.return_items FOR SELECT USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Members insert return_items" ON public.return_items FOR INSERT WITH CHECK (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Members update return_items" ON public.return_items FOR UPDATE USING (private.is_member_of(auth.uid(), workspace_id)) WITH CHECK (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Owners delete return_items" ON public.return_items FOR DELETE USING (private.is_workspace_owner(auth.uid(), workspace_id));
CREATE TRIGGER return_items_set_updated_at BEFORE UPDATE ON public.return_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX return_items_return_idx ON public.return_items(return_id);

CREATE TABLE public.return_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  event text NOT NULL,
  message text,
  actor_id uuid,
  actor_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.return_timeline TO authenticated;
GRANT ALL ON public.return_timeline TO service_role;
ALTER TABLE public.return_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view return_timeline" ON public.return_timeline FOR SELECT USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Members insert return_timeline" ON public.return_timeline FOR INSERT WITH CHECK (private.is_member_of(auth.uid(), workspace_id) AND actor_id = auth.uid());
CREATE INDEX return_timeline_return_idx ON public.return_timeline(return_id, created_at);

CREATE TABLE public.detection_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('marketplace','courier')),
  name text NOT NULL,
  pattern text NOT NULL,
  priority int NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  is_global boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX detection_rules_lookup_idx ON public.detection_rules (workspace_id, type, enabled, priority);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.detection_rules TO authenticated;
GRANT ALL ON public.detection_rules TO service_role;
ALTER TABLE public.detection_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "detection_rules_select" ON public.detection_rules FOR SELECT TO authenticated USING (is_global = true OR (workspace_id IS NOT NULL AND private.is_member_of(auth.uid(), workspace_id)));
CREATE POLICY "detection_rules_insert" ON public.detection_rules FOR INSERT TO authenticated WITH CHECK (is_global = false AND workspace_id IS NOT NULL AND private.is_member_of(auth.uid(), workspace_id) AND (private.is_workspace_owner(auth.uid(), workspace_id) OR private.has_role(auth.uid(), 'Supervisor'::public.app_role)));
CREATE POLICY "detection_rules_update" ON public.detection_rules FOR UPDATE TO authenticated USING (is_global = false AND workspace_id IS NOT NULL AND private.is_member_of(auth.uid(), workspace_id) AND (private.is_workspace_owner(auth.uid(), workspace_id) OR private.has_role(auth.uid(), 'Supervisor'::public.app_role))) WITH CHECK (is_global = false AND workspace_id IS NOT NULL AND private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "detection_rules_delete" ON public.detection_rules FOR DELETE TO authenticated USING (is_global = false AND workspace_id IS NOT NULL AND private.is_member_of(auth.uid(), workspace_id) AND (private.is_workspace_owner(auth.uid(), workspace_id) OR private.has_role(auth.uid(), 'Supervisor'::public.app_role)));
CREATE TRIGGER detection_rules_set_updated_at BEFORE UPDATE ON public.detection_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.detection_rules (workspace_id, type, name, pattern, priority, enabled, is_global, notes) VALUES
  (NULL, 'marketplace', 'Shopee', '^SPX|^SPE|^SP[0-9]', 10, true, true, 'Shopee tracking prefixes'),
  (NULL, 'marketplace', 'TikTok Shop', '^TT|^TIKTOK', 10, true, true, 'TikTok Shop'),
  (NULL, 'marketplace', 'Tokopedia', '^TKPD|^TKP|^TPD', 10, true, true, 'Tokopedia'),
  (NULL, 'marketplace', 'Lazada', '^LZ|^LEX|^LAZ', 10, true, true, 'Lazada'),
  (NULL, 'marketplace', 'Blibli', '^BLI|^BBL', 10, true, true, 'Blibli'),
  (NULL, 'courier', 'SPX Express', '^SPX', 10, true, true, 'Shopee Xpress'),
  (NULL, 'courier', 'J&T Express', '^JT|^JP[0-9]|^JX', 20, true, true, 'J&T Express'),
  (NULL, 'courier', 'ID Express', '^IDX|^ID[0-9]{8,}', 20, true, true, 'ID Express'),
  (NULL, 'courier', 'AnterAja', '^AA|^ANT', 30, true, true, 'AnterAja'),
  (NULL, 'courier', 'SiCepat', '^00[0-9]{10}|^SC[A-Z]', 30, true, true, 'SiCepat'),
  (NULL, 'courier', 'GoTo Logistics', '^GTL|^GOTO|^GJK', 30, true, true, 'GoTo Logistics'),
  (NULL, 'courier', 'Lazada Express', '^LEX|^LZD', 30, true, true, 'Lazada Express'),
  (NULL, 'courier', 'Ninja Xpress', '^NJV|^NX[A-Z0-9]', 30, true, true, 'Ninja Xpress'),
  (NULL, 'courier', 'JNE', '^JNE|^CGK|^JNJ', 30, true, true, 'JNE'),
  (NULL, 'courier', 'Pos Indonesia', '^POS|^EE[0-9]{9}ID', 30, true, true, 'Pos Indonesia');

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_unread_idx ON public.notifications(user_id, read_at, created_at DESC);
CREATE INDEX notifications_workspace_idx ON public.notifications(workspace_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update their own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete their own notifications" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  trigger TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  channels JSONB NOT NULL DEFAULT '["in_app"]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_rules TO service_role;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read workspace automation rules" ON public.automation_rules FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.users u WHERE u.workspace_id = automation_rules.workspace_id AND u.user_id = auth.uid()));
CREATE POLICY "Owners manage automation rules" ON public.automation_rules FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = automation_rules.workspace_id AND r.user_id = auth.uid() AND r.role IN ('Owner','Supervisor'))) WITH CHECK (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = automation_rules.workspace_id AND r.user_id = auth.uid() AND r.role IN ('Owner','Supervisor')));
CREATE TRIGGER set_updated_at_automation_rules BEFORE UPDATE ON public.automation_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  frequency TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'xlsx',
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_reports TO authenticated;
GRANT ALL ON public.scheduled_reports TO service_role;
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read workspace scheduled reports" ON public.scheduled_reports FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.users u WHERE u.workspace_id = scheduled_reports.workspace_id AND u.user_id = auth.uid()));
CREATE POLICY "Owners manage scheduled reports" ON public.scheduled_reports FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = scheduled_reports.workspace_id AND r.user_id = auth.uid() AND r.role IN ('Owner','Supervisor'))) WITH CHECK (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = scheduled_reports.workspace_id AND r.user_id = auth.uid() AND r.role IN ('Owner','Supervisor')));
CREATE TRIGGER set_updated_at_scheduled_reports BEFORE UPDATE ON public.scheduled_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  scopes JSONB NOT NULL DEFAULT '["read"]'::jsonb,
  created_by UUID,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_tokens TO authenticated;
GRANT ALL ON public.api_tokens TO service_role;
ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read api tokens" ON public.api_tokens FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = api_tokens.workspace_id AND r.user_id = auth.uid() AND r.role = 'Owner'));
CREATE POLICY "Owners manage api tokens" ON public.api_tokens FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = api_tokens.workspace_id AND r.user_id = auth.uid() AND r.role = 'Owner')) WITH CHECK (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = api_tokens.workspace_id AND r.user_id = auth.uid() AND r.role = 'Owner'));

CREATE TABLE public.backup_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  bytes BIGINT,
  rows BIGINT,
  file_url TEXT,
  notes TEXT,
  started_by UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read backup runs" ON public.backup_runs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = backup_runs.workspace_id AND r.user_id = auth.uid() AND r.role IN ('Owner','Supervisor')));
CREATE POLICY "Owners manage backup runs" ON public.backup_runs FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = backup_runs.workspace_id AND r.user_id = auth.uid() AND r.role = 'Owner')) WITH CHECK (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = backup_runs.workspace_id AND r.user_id = auth.uid() AND r.role = 'Owner'));

CREATE TABLE public.connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  auth_method text NOT NULL DEFAULT 'oauth2',
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'available',
  icon_url text,
  docs_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.connectors TO authenticated;
GRANT ALL ON public.connectors TO service_role;
ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read connectors" ON public.connectors FOR SELECT TO authenticated USING (true);
CREATE TRIGGER connectors_set_updated_at BEFORE UPDATE ON public.connectors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.connector_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  connector_key text NOT NULL REFERENCES public.connectors(key) ON UPDATE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  oauth_tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  auto_sync boolean NOT NULL DEFAULT false,
  sync_interval_minutes integer NOT NULL DEFAULT 30,
  connection_status text NOT NULL DEFAULT 'disconnected',
  last_sync_at timestamptz,
  last_sync_status text,
  last_error text,
  last_error_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, connector_key, display_name)
);
CREATE INDEX idx_cc_workspace ON public.connector_connections(workspace_id);
CREATE INDEX idx_cc_connector ON public.connector_connections(connector_key);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connector_connections TO authenticated;
GRANT ALL ON public.connector_connections TO service_role;
ALTER TABLE public.connector_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view connections" ON public.connector_connections FOR SELECT TO authenticated USING (workspace_id = private.current_workspace_id() AND private.is_member_of(auth.uid(), workspace_id) AND private.has_role(auth.uid(), 'Owner'::app_role));
CREATE POLICY "Owners insert connections" ON public.connector_connections FOR INSERT TO authenticated WITH CHECK (workspace_id = private.current_workspace_id() AND private.has_role(auth.uid(), 'Owner'::public.app_role));
CREATE POLICY "Owners update connections" ON public.connector_connections FOR UPDATE TO authenticated USING (workspace_id = private.current_workspace_id() AND private.is_member_of(auth.uid(), workspace_id) AND private.has_role(auth.uid(), 'Owner'::app_role)) WITH CHECK (workspace_id = private.current_workspace_id() AND private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Owners delete connections" ON public.connector_connections FOR DELETE TO authenticated USING (workspace_id = private.current_workspace_id() AND private.has_role(auth.uid(), 'Owner'::public.app_role));
CREATE TRIGGER cc_set_updated_at BEFORE UPDATE ON public.connector_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.connector_connections(id) ON DELETE CASCADE,
  connector_key text NOT NULL,
  trigger text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  orders_imported integer NOT NULL DEFAULT 0,
  orders_updated integer NOT NULL DEFAULT 0,
  orders_failed integer NOT NULL DEFAULT 0,
  tracking_updated integer NOT NULL DEFAULT 0,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sync_runs_ws ON public.sync_runs(workspace_id, started_at DESC);
CREATE INDEX idx_sync_runs_conn ON public.sync_runs(connection_id, started_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.sync_runs TO authenticated;
GRANT ALL ON public.sync_runs TO service_role;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view sync runs" ON public.sync_runs FOR SELECT TO authenticated USING (workspace_id = private.current_workspace_id());
CREATE POLICY "Managers insert sync runs" ON public.sync_runs FOR INSERT TO authenticated WITH CHECK (workspace_id = private.current_workspace_id() AND (private.has_role(auth.uid(),'Owner'::public.app_role) OR private.has_role(auth.uid(),'Supervisor'::public.app_role)));
CREATE POLICY "Managers update sync runs" ON public.sync_runs FOR UPDATE TO authenticated USING (workspace_id = private.current_workspace_id() AND (private.has_role(auth.uid(),'Owner'::public.app_role) OR private.has_role(auth.uid(),'Supervisor'::public.app_role)));
CREATE TRIGGER sync_runs_set_updated_at BEFORE UPDATE ON public.sync_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.connector_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.connector_connections(id) ON DELETE CASCADE,
  sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE SET NULL,
  connector_key text NOT NULL,
  error_type text NOT NULL,
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cel_ws ON public.connector_error_logs(workspace_id, created_at DESC);
CREATE INDEX idx_cel_conn ON public.connector_error_logs(connection_id, created_at DESC);
GRANT SELECT, INSERT ON public.connector_error_logs TO authenticated;
GRANT ALL ON public.connector_error_logs TO service_role;
ALTER TABLE public.connector_error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view error logs" ON public.connector_error_logs FOR SELECT TO authenticated USING (workspace_id = private.current_workspace_id());
CREATE POLICY "Members insert error logs" ON public.connector_error_logs FOR INSERT TO authenticated WITH CHECK (workspace_id = private.current_workspace_id());

INSERT INTO public.connectors (key, name, category, auth_method, capabilities, status) VALUES
  ('shopee',      'Shopee',      'marketplace', 'oauth2', '["import_orders","update_status","tracking","customer","sku","quantity"]'::jsonb, 'coming_soon'),
  ('tiktok_shop', 'TikTok Shop', 'marketplace', 'oauth2', '["import_orders","update_status","tracking","customer","sku","quantity"]'::jsonb, 'coming_soon'),
  ('tokopedia',   'Tokopedia',   'marketplace', 'oauth2', '["import_orders","update_status","tracking","customer","sku","quantity"]'::jsonb, 'coming_soon'),
  ('lazada',      'Lazada',      'marketplace', 'oauth2', '["import_orders","update_status","tracking","customer","sku","quantity"]'::jsonb, 'coming_soon'),
  ('blibli',      'Blibli',      'marketplace', 'oauth2', '["import_orders","update_status","tracking","customer","sku","quantity"]'::jsonb, 'coming_soon')
ON CONFLICT (key) DO NOTHING;

CREATE POLICY "Members view workspace logos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'workspace-logos' AND private.is_member_of(auth.uid(), (split_part(name, '/', 1))::uuid));
CREATE POLICY "Members upload logos to own workspace folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'workspace-logos' AND private.is_member_of(auth.uid(), (split_part(name, '/', 1))::uuid));
CREATE POLICY "Owners update workspace logos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'workspace-logos' AND private.is_workspace_owner(auth.uid(), (split_part(name, '/', 1))::uuid));
CREATE POLICY "Owners delete workspace logos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'workspace-logos' AND private.is_workspace_owner(auth.uid(), (split_part(name, '/', 1))::uuid));

CREATE POLICY "Members read return-photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'return-photos' AND private.is_member_of(auth.uid(), ((string_to_array(name, '/'))[1])::uuid));
CREATE POLICY "Members upload return-photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'return-photos' AND private.is_member_of(auth.uid(), ((string_to_array(name, '/'))[1])::uuid));
CREATE POLICY "Members update return-photos" ON storage.objects FOR UPDATE
  USING (bucket_id = 'return-photos' AND private.is_member_of(auth.uid(), ((string_to_array(name, '/'))[1])::uuid));
CREATE POLICY "Members delete return-photos" ON storage.objects FOR DELETE
  USING (bucket_id = 'return-photos' AND private.is_member_of(auth.uid(), ((string_to_array(name, '/'))[1])::uuid));