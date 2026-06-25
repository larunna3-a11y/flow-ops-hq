
-- Private schema for SECURITY DEFINER helpers (not exposed by PostgREST)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
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

-- Drop all dependent policies (public schema + storage.objects for workspace-logos)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, c.relname, p.polname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
       OR (n.nspname = 'storage' AND c.relname = 'objects' AND p.polname IN (
            'Members upload logos to own workspace folder',
            'Members view workspace logos',
            'Owners delete workspace logos',
            'Owners update workspace logos'))
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.polname, r.nspname, r.relname);
  END LOOP;
END $$;

-- Drop old public helpers
DROP FUNCTION IF EXISTS public.current_workspace_id();
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_workspace_owner(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_member_of(uuid, uuid);

-- Recreate public-schema policies
CREATE POLICY "Members see their workspaces" ON public.workspaces FOR SELECT TO authenticated
  USING (private.is_member_of(auth.uid(), id));
CREATE POLICY "Owners manage their workspaces" ON public.workspaces FOR ALL TO authenticated
  USING (private.is_workspace_owner(auth.uid(), id))
  WITH CHECK (private.is_workspace_owner(auth.uid(), id));

CREATE POLICY "Users see own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Workspace members see each other profiles" ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u1 JOIN public.users u2 ON u1.workspace_id = u2.workspace_id WHERE u1.user_id = auth.uid() AND u2.user_id = profiles.id));

CREATE POLICY "Members see workspace memberships" ON public.users FOR SELECT TO authenticated
  USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Owners manage workspace memberships" ON public.users FOR ALL TO authenticated
  USING (private.is_workspace_owner(auth.uid(), workspace_id))
  WITH CHECK (private.is_workspace_owner(auth.uid(), workspace_id));

CREATE POLICY "Members see workspace roles" ON public.roles FOR SELECT TO authenticated
  USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Owners manage workspace roles" ON public.roles FOR ALL TO authenticated
  USING (private.is_workspace_owner(auth.uid(), workspace_id))
  WITH CHECK (private.is_workspace_owner(auth.uid(), workspace_id));

-- Invitations: only Owners can read/manage (removes member-visible token exposure)
CREATE POLICY "Owners manage workspace invitations" ON public.invitations FOR ALL TO authenticated
  USING (private.is_workspace_owner(auth.uid(), workspace_id))
  WITH CHECK (private.is_workspace_owner(auth.uid(), workspace_id));

-- Audit logs: members can read; no client-side INSERT (server/trigger only)
CREATE POLICY "Members see workspace audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (private.is_member_of(auth.uid(), workspace_id));

-- Storage policies for workspace-logos (re-create referencing private helpers)
CREATE POLICY "Members view workspace logos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'workspace-logos' AND private.is_member_of(auth.uid(), (split_part(name, '/', 1))::uuid));
CREATE POLICY "Members upload logos to own workspace folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'workspace-logos' AND private.is_member_of(auth.uid(), (split_part(name, '/', 1))::uuid));
CREATE POLICY "Owners update workspace logos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'workspace-logos' AND private.is_workspace_owner(auth.uid(), (split_part(name, '/', 1))::uuid));
CREATE POLICY "Owners delete workspace logos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'workspace-logos' AND private.is_workspace_owner(auth.uid(), (split_part(name, '/', 1))::uuid));

-- Lock down handle_new_user (trigger fires regardless of EXECUTE grants on caller role)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
