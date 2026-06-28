
-- Workspaces: plan + preferences
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT jsonb_build_object(
    'active_marketplaces', jsonb_build_array('Shopee','TikTok Shop','Tokopedia','Lazada','Blibli'),
    'active_couriers',     jsonb_build_array('J&T','SPX','JNE','SiCepat','Anteraja'),
    'packing_statuses',    jsonb_build_array('pending','ready','packed','shipped'),
    'return_reasons',      jsonb_build_array('Damaged','Wrong Item','Not as Described','Late Delivery','Customer Changed Mind')
  );

-- API tokens (future marketplace / ERP / inventory integrations)
CREATE TABLE public.api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,        -- first 8 chars for display
  token_hash TEXT NOT NULL,    -- sha256 of the full token; raw never stored
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

CREATE POLICY "Owners read api tokens"
ON public.api_tokens FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = api_tokens.workspace_id AND r.user_id = auth.uid() AND r.role = 'Owner'));

CREATE POLICY "Owners manage api tokens"
ON public.api_tokens FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = api_tokens.workspace_id AND r.user_id = auth.uid() AND r.role = 'Owner'))
WITH CHECK (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = api_tokens.workspace_id AND r.user_id = auth.uid() AND r.role = 'Owner'));

-- Backup runs (manual database backup / workspace export)
CREATE TABLE public.backup_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,              -- 'database' | 'workspace_export'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'running' | 'success' | 'failed'
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

CREATE POLICY "Members read backup runs"
ON public.backup_runs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = backup_runs.workspace_id AND r.user_id = auth.uid() AND r.role IN ('Owner','Supervisor')));

CREATE POLICY "Owners manage backup runs"
ON public.backup_runs FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = backup_runs.workspace_id AND r.user_id = auth.uid() AND r.role = 'Owner'))
WITH CHECK (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = backup_runs.workspace_id AND r.user_id = auth.uid() AND r.role = 'Owner'));
