CREATE TABLE IF NOT EXISTS public.invitation_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invitation_uses_invitation_id_idx
  ON public.invitation_uses(invitation_id);
CREATE INDEX IF NOT EXISTS invitation_uses_workspace_id_idx
  ON public.invitation_uses(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS invitation_uses_invitation_user_key
  ON public.invitation_uses(invitation_id, user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitation_uses TO authenticated;
GRANT ALL ON public.invitation_uses TO service_role;
ALTER TABLE public.invitation_uses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers view invitation uses" ON public.invitation_uses;
CREATE POLICY "Managers view invitation uses" ON public.invitation_uses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.user_id = auth.uid()
        AND r.workspace_id = invitation_uses.workspace_id
        AND r.role IN ('Owner', 'Supervisor')
    )
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_workspace_id uuid;
  v_workspace_name text;
  v_workspace_slug text;
  v_full_name text;
  v_invitation public.invitations%ROWTYPE;
  v_token text;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(COALESCE(NEW.email, ''), '@', 1)
  );

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, v_full_name)
  ON CONFLICT (id) DO NOTHING;

  v_token := NEW.raw_user_meta_data->>'invitation_token';

  IF v_token IS NOT NULL THEN
    SELECT * INTO v_invitation FROM public.invitations
    WHERE token = v_token AND status = 'pending' AND expires_at > now() LIMIT 1;
  END IF;

  IF v_invitation.id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT * INTO v_invitation FROM public.invitations
    WHERE lower(email) = lower(NEW.email) AND status = 'pending' AND expires_at > now()
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_invitation.id IS NOT NULL THEN
    INSERT INTO public.users (workspace_id, user_id, status, invited_by, full_name, phone, account_expires_at)
    VALUES (v_invitation.workspace_id, NEW.id, 'active', v_invitation.invited_by,
            v_full_name, v_invitation.phone, v_invitation.account_expires_at);
    INSERT INTO public.roles (workspace_id, user_id, role)
    VALUES (v_invitation.workspace_id, NEW.id, v_invitation.role);

    INSERT INTO public.invitation_uses (invitation_id, workspace_id, user_id, full_name)
    VALUES (v_invitation.id, v_invitation.workspace_id, NEW.id, v_full_name)
    ON CONFLICT (invitation_id, user_id) DO NOTHING;

    IF v_invitation.email IS NOT NULL OR v_invitation.phone IS NOT NULL THEN
      UPDATE public.invitations
      SET status = 'accepted', accepted_at = now()
      WHERE id = v_invitation.id;
    ELSE
      UPDATE public.invitations
      SET accepted_at = COALESCE(accepted_at, now())
      WHERE id = v_invitation.id;
    END IF;

    INSERT INTO public.audit_logs (workspace_id, actor_id, action, target_type, target_id, metadata)
    VALUES (v_invitation.workspace_id, NEW.id, 'member.joined', 'user', NEW.id::text,
            jsonb_build_object('role', v_invitation.role, 'invitation_id', v_invitation.id));
    RETURN NEW;
  END IF;

  v_workspace_name := COALESCE(NEW.raw_user_meta_data->>'workspace_name', v_full_name || '''s Workspace');
  v_workspace_slug := lower(regexp_replace(
    COALESCE(NEW.raw_user_meta_data->>'workspace_slug', v_workspace_name),
    '[^a-z0-9]+', '-', 'gi'
  )) || '-' || substr(NEW.id::text, 1, 6);

  INSERT INTO public.workspaces (name, slug, owner_id)
  VALUES (v_workspace_name, v_workspace_slug, NEW.id)
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.users (workspace_id, user_id, status) VALUES (v_workspace_id, NEW.id, 'active');
  INSERT INTO public.roles (workspace_id, user_id, role) VALUES (v_workspace_id, NEW.id, 'Owner');

  INSERT INTO public.audit_logs (workspace_id, actor_id, action, target_type, target_id)
  VALUES (v_workspace_id, NEW.id, 'workspace.created', 'workspace', v_workspace_id::text);

  RETURN NEW;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
