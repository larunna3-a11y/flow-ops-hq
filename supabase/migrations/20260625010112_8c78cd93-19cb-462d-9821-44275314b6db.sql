
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('Owner', 'Supervisor', 'Packer', 'Return Staff');
CREATE TYPE public.member_status AS ENUM ('active', 'invited', 'suspended');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');

-- ============ WORKSPACES ============
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_color text NOT NULL DEFAULT 'linear-gradient(135deg,#6366f1,#8b5cf6)',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USERS (workspace membership) ============
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.member_status NOT NULL DEFAULT 'active',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz,
  UNIQUE (user_id)
);
CREATE INDEX users_workspace_idx ON public.users(workspace_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============ ROLES ============
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, role)
);
CREATE INDEX roles_user_idx ON public.roles(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- ============ INVITATIONS ============
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);
CREATE UNIQUE INDEX invitations_pending_email_workspace
  ON public.invitations (workspace_id, lower(email))
  WHERE status = 'pending';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_workspace_created_idx ON public.audit_logs(workspace_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER HELPERS ============
CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workspace_id FROM public.users WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(_user_id uuid, _workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.roles
    WHERE user_id = _user_id AND workspace_id = _workspace_id AND role = 'Owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_member_of(_user_id uuid, _workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE user_id = _user_id AND workspace_id = _workspace_id
  );
$$;

-- ============ RLS POLICIES ============

-- workspaces
CREATE POLICY "Members can view their workspace" ON public.workspaces
  FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), id));
CREATE POLICY "Owners can update their workspace" ON public.workspaces
  FOR UPDATE TO authenticated USING (public.is_workspace_owner(auth.uid(), id))
  WITH CHECK (public.is_workspace_owner(auth.uid(), id));

-- profiles
CREATE POLICY "Users see profiles in their workspace" ON public.profiles
  FOR SELECT TO authenticated USING (
    id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.users m1
      JOIN public.users m2 ON m1.workspace_id = m2.workspace_id
      WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id
    )
  );
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- users (membership)
CREATE POLICY "Members see workspace members" ON public.users
  FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Owners manage workspace members" ON public.users
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_owner(auth.uid(), workspace_id));

-- roles
CREATE POLICY "Members see workspace roles" ON public.roles
  FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Owners manage workspace roles" ON public.roles
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_owner(auth.uid(), workspace_id));

-- invitations
CREATE POLICY "Members see workspace invitations" ON public.invitations
  FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Owners manage workspace invitations" ON public.invitations
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_owner(auth.uid(), workspace_id));

-- audit_logs
CREATE POLICY "Members see workspace audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Members write own audit entries" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND public.is_member_of(auth.uid(), workspace_id));

-- ============ UPDATED_AT TRIGGER ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_workspaces_updated BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ NEW USER HANDLER ============
-- First user becomes Owner of a new workspace.
-- Subsequent sign-ups MUST match a pending invitation (by email) — otherwise blocked.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_workspace_count int;
  v_workspace_id uuid;
  v_workspace_name text;
  v_workspace_slug text;
  v_full_name text;
  v_invitation public.invitations%ROWTYPE;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, v_full_name)
  ON CONFLICT (id) DO NOTHING;

  SELECT COUNT(*) INTO v_workspace_count FROM public.workspaces;

  IF v_workspace_count = 0 THEN
    -- First user → Owner of new workspace
    v_workspace_name := COALESCE(NEW.raw_user_meta_data->>'workspace_name', 'My Workspace');
    v_workspace_slug := lower(regexp_replace(
      COALESCE(NEW.raw_user_meta_data->>'workspace_slug', v_workspace_name),
      '[^a-z0-9]+', '-', 'gi'
    )) || '-' || substr(NEW.id::text, 1, 6);

    INSERT INTO public.workspaces (name, slug, owner_id)
    VALUES (v_workspace_name, v_workspace_slug, NEW.id)
    RETURNING id INTO v_workspace_id;

    INSERT INTO public.users (workspace_id, user_id, status)
    VALUES (v_workspace_id, NEW.id, 'active');

    INSERT INTO public.roles (workspace_id, user_id, role)
    VALUES (v_workspace_id, NEW.id, 'Owner');

    INSERT INTO public.audit_logs (workspace_id, actor_id, action, target_type, target_id)
    VALUES (v_workspace_id, NEW.id, 'workspace.created', 'workspace', v_workspace_id::text);

    RETURN NEW;
  END IF;

  -- Subsequent users → require pending invitation
  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE lower(email) = lower(NEW.email)
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'Public registration is disabled. You need an invitation from a workspace Owner to join.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.users (workspace_id, user_id, status, invited_by)
  VALUES (v_invitation.workspace_id, NEW.id, 'active', v_invitation.invited_by);

  INSERT INTO public.roles (workspace_id, user_id, role)
  VALUES (v_invitation.workspace_id, NEW.id, v_invitation.role);

  UPDATE public.invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invitation.id;

  INSERT INTO public.audit_logs (workspace_id, actor_id, action, target_type, target_id, metadata)
  VALUES (v_invitation.workspace_id, NEW.id, 'member.joined', 'user', NEW.id::text,
          jsonb_build_object('role', v_invitation.role, 'invitation_id', v_invitation.id));

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
