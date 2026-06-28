-- ===== Full reset and rebuild based on uploaded project =====
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP POLICY IF EXISTS "Members view workspace logos" ON storage.objects;
DROP POLICY IF EXISTS "Members upload logos to own workspace folder" ON storage.objects;
DROP POLICY IF EXISTS "Owners update workspace logos" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete workspace logos" ON storage.objects;
DROP POLICY IF EXISTS "Members read return-photos" ON storage.objects;
DROP POLICY IF EXISTS "Members upload return-photos" ON storage.objects;
DROP POLICY IF EXISTS "Members update return-photos" ON storage.objects;
DROP POLICY IF EXISTS "Members delete return-photos" ON storage.objects;
DROP SCHEMA IF EXISTS private CASCADE;
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;

CREATE TYPE public.app_role AS ENUM ('Owner', 'Supervisor', 'Packer', 'Return Staff');
CREATE TYPE public.member_status AS ENUM ('active', 'invited', 'suspended');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');

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

CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text,
  role public.app_role NOT NULL,
  token text UNIQUE NOT NULL DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  full_name text,
  phone text,
  account_expires_at timestamptz
);
CREATE UNIQUE INDEX invitations_pending_email_workspace
  ON public.invitations (workspace_id, lower(email))
  WHERE status = 'pending' AND email IS NOT NULL;
CREATE INDEX invitations_phone_idx ON public.invitations(phone);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

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

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.current_workspace_id() RETURNS uuid
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT workspace_id FROM public.users WHERE user_id = auth.uid() LIMIT 1; $$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.roles WHERE user_id = _user_id AND role = _role); $$;

CREATE OR REPLACE FUNCTION private.is_workspace_owner(_user_id uuid, _workspace_id uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.roles WHERE user_id = _user_id AND workspace_id = _workspace_id AND role = 'Owner'); $$;

CREATE OR REPLACE FUNCTION private.is_member_of(_user_id uuid, _workspace_id uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.users WHERE user_id = _user_id AND workspace_id = _workspace_id); $$;

REVOKE ALL ON FUNCTION private.current_workspace_id(), private.has_role(uuid, public.app_role), private.is_workspace_owner(uuid, uuid), private.is_member_of(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_workspace_id(), private.has_role(uuid, public.app_role), private.is_workspace_owner(uuid, uuid), private.is_member_of(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "Members see their workspaces" ON public.workspaces FOR SELECT TO authenticated USING (private.is_member_of(auth.uid(), id));
CREATE POLICY "Owners manage their workspaces" ON public.workspaces FOR ALL TO authenticated USING (private.is_workspace_owner(auth.uid(), id)) WITH CHECK (private.is_workspace_owner(auth.uid(), id));

CREATE POLICY "Users see own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Workspace members see each other profiles" ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u1 JOIN public.users u2 ON u1.workspace_id = u2.workspace_id WHERE u1.user_id = auth.uid() AND u2.user_id = profiles.id));

CREATE POLICY "Members see workspace memberships" ON public.users FOR SELECT TO authenticated USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Owners manage workspace memberships" ON public.users FOR ALL TO authenticated USING (private.is_workspace_owner(auth.uid(), workspace_id)) WITH CHECK (private.is_workspace_owner(auth.uid(), workspace_id));

CREATE POLICY "Members see workspace roles" ON public.roles FOR SELECT TO authenticated USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Owners manage workspace roles" ON public.roles FOR ALL TO authenticated USING (private.is_workspace_owner(auth.uid(), workspace_id)) WITH CHECK (private.is_workspace_owner(auth.uid(), workspace_id));

CREATE POLICY "Owners manage workspace invitations" ON public.invitations FOR ALL TO authenticated USING (private.is_workspace_owner(auth.uid(), workspace_id)) WITH CHECK (private.is_workspace_owner(auth.uid(), workspace_id));
CREATE POLICY "Invitees view own invitations" ON public.invitations FOR SELECT TO authenticated
  USING (lower(email) = lower((SELECT au.email FROM auth.users au WHERE au.id = auth.uid())));

CREATE POLICY "Members see workspace audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (private.is_member_of(auth.uid(), workspace_id));

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Jakarta',
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'id',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT jsonb_build_object(
    'active_marketplaces', jsonb_build_array('Shopee','TikTok Shop','Tokopedia','Lazada','Blibli'),
    'active_couriers',     jsonb_build_array('J&T','SPX','JNE','SiCepat','Anteraja'),
    'packing_statuses',    jsonb_build_array('pending','ready','packed','shipped'),
    'return_reasons',      jsonb_build_array('Damaged','Wrong Item','Not as Described','Late Delivery','Customer Changed Mind')
  );

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS full_name text;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_workspaces_updated BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
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
END; $$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any existing auth.users that lack a workspace
DO $backfill$
DECLARE
  u RECORD;
  v_workspace_id uuid;
  v_workspace_name text;
  v_workspace_slug text;
  v_full_name text;
BEGIN
  FOR u IN
    SELECT a.* FROM auth.users a
    LEFT JOIN public.users pu ON pu.user_id = a.id
    WHERE pu.user_id IS NULL
  LOOP
    v_full_name := COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(COALESCE(u.email,''),'@',1));
    INSERT INTO public.profiles (id, email, full_name) VALUES (u.id, u.email, v_full_name) ON CONFLICT (id) DO NOTHING;
    v_workspace_name := COALESCE(u.raw_user_meta_data->>'workspace_name', v_full_name || '''s Workspace');
    v_workspace_slug := lower(regexp_replace(v_workspace_name, '[^a-z0-9]+', '-', 'gi')) || '-' || substr(u.id::text, 1, 6);
    INSERT INTO public.workspaces (name, slug, owner_id) VALUES (v_workspace_name, v_workspace_slug, u.id) RETURNING id INTO v_workspace_id;
    INSERT INTO public.users (workspace_id, user_id, status) VALUES (v_workspace_id, u.id, 'active');
    INSERT INTO public.roles (workspace_id, user_id, role) VALUES (v_workspace_id, u.id, 'Owner');
    INSERT INTO public.audit_logs (workspace_id, actor_id, action, target_type, target_id) VALUES (v_workspace_id, u.id, 'workspace.created', 'workspace', v_workspace_id::text);
  END LOOP;
END $backfill$;