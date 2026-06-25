
-- ============ AUTOMATION RULES ============
-- Condition/action pairs evaluated on every barcode scan.
-- Each rule has one condition (field + operator + value) and one action (set field = value).
-- Rules are ordered and the FIRST matching rule wins (short-circuit evaluation).

CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,

  -- Condition
  condition_field text NOT NULL CHECK (condition_field IN ('raw_code', 'tracking_number', 'order_number')),
  condition_operator text NOT NULL CHECK (condition_operator IN ('starts_with', 'ends_with', 'contains', 'equals', 'matches_regex')),
  condition_value text NOT NULL,

  -- Action
  action_marketplace text,
  action_courier text,

  -- Sort order (lower = higher priority)
  sort_order integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX automation_rules_workspace_idx ON public.automation_rules(workspace_id, sort_order ASC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_rules TO service_role;

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view automation rules"
  ON public.automation_rules FOR SELECT TO authenticated
  USING (private.is_member_of(auth.uid(), workspace_id));

CREATE POLICY "Owners manage automation rules"
  ON public.automation_rules FOR ALL TO authenticated
  USING (private.is_workspace_owner(auth.uid(), workspace_id))
  WITH CHECK (private.is_workspace_owner(auth.uid(), workspace_id));

CREATE TRIGGER automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============ WORKSPACE PREFERENCES ============
-- Stores notification toggles and other per-workspace UI preferences as JSONB.
-- One row per workspace, upserted on save.

CREATE TABLE public.workspace_preferences (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  notifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.workspace_preferences TO authenticated;
GRANT ALL ON public.workspace_preferences TO service_role;

ALTER TABLE public.workspace_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view workspace preferences"
  ON public.workspace_preferences FOR SELECT TO authenticated
  USING (private.is_member_of(auth.uid(), workspace_id));

CREATE POLICY "Owners manage workspace preferences"
  ON public.workspace_preferences FOR ALL TO authenticated
  USING (private.is_workspace_owner(auth.uid(), workspace_id))
  WITH CHECK (private.is_workspace_owner(auth.uid(), workspace_id));

CREATE TRIGGER workspace_preferences_updated_at
  BEFORE UPDATE ON public.workspace_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
