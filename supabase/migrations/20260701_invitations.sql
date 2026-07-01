-- Invitation Links Table for simplified onboarding
-- One link can be used by unlimited users until expired or disabled.
-- Users only enter their Full Name (no email or password required).

CREATE TABLE public.invitation_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text NOT NULL,
  role public.app_role NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  expires_at timestamptz NOT NULL,
  -- Track usage without storing PII
  used_count integer NOT NULL DEFAULT 0,
  used_by_names text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for lookups by workspace and expiry
CREATE INDEX invitation_links_workspace_idx ON public.invitation_links(workspace_id, status, expires_at DESC);
CREATE INDEX invitation_links_created_by_idx ON public.invitation_links(created_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitation_links TO authenticated;
GRANT ALL ON public.invitation_links TO service_role;

ALTER TABLE public.invitation_links ENABLE ROW LEVEL SECURITY;

-- Only Owners/Supervisors can manage invitation links
CREATE POLICY "Managers view invitation links" ON public.invitation_links FOR SELECT TO authenticated
  USING (private.is_workspace_owner(auth.uid(), workspace_id) OR private.has_role(auth.uid(), 'Supervisor'));

CREATE POLICY "Managers create invitation links" ON public.invitation_links FOR INSERT TO authenticated
  WITH CHECK (private.is_workspace_owner(auth.uid(), workspace_id) OR private.has_role(auth.uid(), 'Supervisor'));

CREATE POLICY "Managers update invitation links" ON public.invitation_links FOR UPDATE TO authenticated
  USING (private.is_workspace_owner(auth.uid(), workspace_id) OR private.has_role(auth.uid(), 'Supervisor'))
  WITH CHECK (private.is_workspace_owner(auth.uid(), workspace_id) OR private.has_role(auth.uid(), 'Supervisor'));

CREATE POLICY "Managers delete invitation links" ON public.invitation_links FOR DELETE TO authenticated
  USING (private.is_workspace_owner(auth.uid(), workspace_id) OR private.has_role(auth.uid(), 'Supervisor'));

-- Trigger to update updated_at timestamp
CREATE TRIGGER invitation_links_updated_at BEFORE UPDATE ON public.invitation_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
