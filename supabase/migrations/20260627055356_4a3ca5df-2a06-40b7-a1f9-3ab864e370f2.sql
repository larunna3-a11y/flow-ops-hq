
-- Phone-first invitations: add full_name, phone, account_expires_at; make email nullable.
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS account_expires_at timestamptz;

ALTER TABLE public.invitations ALTER COLUMN email DROP NOT NULL;

-- Ensure token has a strong default
ALTER TABLE public.invitations
  ALTER COLUMN token SET DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_key ON public.invitations(token);
CREATE INDEX IF NOT EXISTS invitations_phone_idx ON public.invitations(phone);

-- Add account_expires_at to users so we can enforce expirations later
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS full_name text;

-- Replace handle_new_user: match invitation by token (from user metadata) first, fall back to email
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
    SELECT * INTO v_invitation
    FROM public.invitations
    WHERE token = v_token
      AND status = 'pending'
      AND expires_at > now()
    LIMIT 1;
  END IF;

  IF v_invitation.id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT * INTO v_invitation
    FROM public.invitations
    WHERE lower(email) = lower(NEW.email)
      AND status = 'pending'
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_invitation.id IS NOT NULL THEN
    INSERT INTO public.users (workspace_id, user_id, status, invited_by, full_name, phone, account_expires_at)
    VALUES (v_invitation.workspace_id, NEW.id, 'active', v_invitation.invited_by,
            v_invitation.full_name, v_invitation.phone, v_invitation.account_expires_at);

    INSERT INTO public.roles (workspace_id, user_id, role)
    VALUES (v_invitation.workspace_id, NEW.id, v_invitation.role);

    UPDATE public.invitations SET status = 'accepted', accepted_at = now() WHERE id = v_invitation.id;

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
