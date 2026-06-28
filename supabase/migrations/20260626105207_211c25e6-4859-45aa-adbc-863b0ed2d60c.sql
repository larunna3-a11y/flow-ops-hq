
-- Notifications: in-app notifications per user
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

CREATE POLICY "Users read their own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users update their own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete their own notifications"
ON public.notifications FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Automation rules: workspace-level configurable rules
CREATE TABLE public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'packing' | 'returns' | 'reports' | 'system'
  trigger TEXT NOT NULL,   -- e.g. 'order.unpacked.timeout', 'scan.duplicate.threshold', 'return.created', 'courier.claims.threshold'
  config JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. { hours: 4, threshold: 5, notify_roles: ['Supervisor'] }
  channels JSONB NOT NULL DEFAULT '["in_app"]'::jsonb, -- future: whatsapp, slack, teams, discord, push, email
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_rules TO service_role;

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read workspace automation rules"
ON public.automation_rules FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.users u WHERE u.workspace_id = automation_rules.workspace_id AND u.user_id = auth.uid()));

CREATE POLICY "Owners manage automation rules"
ON public.automation_rules FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = automation_rules.workspace_id AND r.user_id = auth.uid() AND r.role IN ('Owner','Supervisor')))
WITH CHECK (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = automation_rules.workspace_id AND r.user_id = auth.uid() AND r.role IN ('Owner','Supervisor')));

CREATE TRIGGER set_updated_at_automation_rules BEFORE UPDATE ON public.automation_rules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Scheduled reports
CREATE TABLE public.scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL, -- 'packing' | 'returns' | 'productivity' | 'overview'
  frequency TEXT NOT NULL,   -- 'daily' | 'weekly' | 'monthly'
  format TEXT NOT NULL DEFAULT 'xlsx', -- 'xlsx' | 'pdf' | 'csv'
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of emails or user_ids
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

CREATE POLICY "Members read workspace scheduled reports"
ON public.scheduled_reports FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.users u WHERE u.workspace_id = scheduled_reports.workspace_id AND u.user_id = auth.uid()));

CREATE POLICY "Owners manage scheduled reports"
ON public.scheduled_reports FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = scheduled_reports.workspace_id AND r.user_id = auth.uid() AND r.role IN ('Owner','Supervisor')))
WITH CHECK (EXISTS (SELECT 1 FROM public.roles r WHERE r.workspace_id = scheduled_reports.workspace_id AND r.user_id = auth.uid() AND r.role IN ('Owner','Supervisor')));

CREATE TRIGGER set_updated_at_scheduled_reports BEFORE UPDATE ON public.scheduled_reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
