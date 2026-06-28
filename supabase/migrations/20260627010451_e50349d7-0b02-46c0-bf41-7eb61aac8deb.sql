
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
CREATE POLICY "Authenticated can read connectors" ON public.connectors
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER connectors_set_updated_at BEFORE UPDATE ON public.connectors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
CREATE POLICY "Members view connections" ON public.connector_connections
  FOR SELECT TO authenticated USING (workspace_id = private.current_workspace_id());
CREATE POLICY "Owners insert connections" ON public.connector_connections
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = private.current_workspace_id()
              AND private.has_role(auth.uid(), 'Owner'::public.app_role));
CREATE POLICY "Owners update connections" ON public.connector_connections
  FOR UPDATE TO authenticated
  USING (workspace_id = private.current_workspace_id()
         AND private.has_role(auth.uid(), 'Owner'::public.app_role))
  WITH CHECK (workspace_id = private.current_workspace_id());
CREATE POLICY "Owners delete connections" ON public.connector_connections
  FOR DELETE TO authenticated
  USING (workspace_id = private.current_workspace_id()
         AND private.has_role(auth.uid(), 'Owner'::public.app_role));
CREATE TRIGGER cc_set_updated_at BEFORE UPDATE ON public.connector_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
CREATE POLICY "Members view sync runs" ON public.sync_runs
  FOR SELECT TO authenticated USING (workspace_id = private.current_workspace_id());
CREATE POLICY "Managers insert sync runs" ON public.sync_runs
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = private.current_workspace_id()
              AND (private.has_role(auth.uid(),'Owner'::public.app_role)
                OR private.has_role(auth.uid(),'Supervisor'::public.app_role)));
CREATE POLICY "Managers update sync runs" ON public.sync_runs
  FOR UPDATE TO authenticated
  USING (workspace_id = private.current_workspace_id()
         AND (private.has_role(auth.uid(),'Owner'::public.app_role)
           OR private.has_role(auth.uid(),'Supervisor'::public.app_role)));
CREATE TRIGGER sync_runs_set_updated_at BEFORE UPDATE ON public.sync_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
CREATE POLICY "Members view error logs" ON public.connector_error_logs
  FOR SELECT TO authenticated USING (workspace_id = private.current_workspace_id());
CREATE POLICY "Members insert error logs" ON public.connector_error_logs
  FOR INSERT TO authenticated WITH CHECK (workspace_id = private.current_workspace_id());

INSERT INTO public.connectors (key, name, category, auth_method, capabilities, status) VALUES
  ('shopee',      'Shopee',      'marketplace', 'oauth2', '["import_orders","update_status","tracking","customer","sku","quantity"]'::jsonb, 'coming_soon'),
  ('tiktok_shop', 'TikTok Shop', 'marketplace', 'oauth2', '["import_orders","update_status","tracking","customer","sku","quantity"]'::jsonb, 'coming_soon'),
  ('tokopedia',   'Tokopedia',   'marketplace', 'oauth2', '["import_orders","update_status","tracking","customer","sku","quantity"]'::jsonb, 'coming_soon'),
  ('lazada',      'Lazada',      'marketplace', 'oauth2', '["import_orders","update_status","tracking","customer","sku","quantity"]'::jsonb, 'coming_soon'),
  ('blibli',      'Blibli',      'marketplace', 'oauth2', '["import_orders","update_status","tracking","customer","sku","quantity"]'::jsonb, 'coming_soon')
ON CONFLICT (key) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.connector_connections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.connector_error_logs;
