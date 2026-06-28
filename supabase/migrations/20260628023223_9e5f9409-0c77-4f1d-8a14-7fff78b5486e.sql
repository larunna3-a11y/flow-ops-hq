-- Attach trigger to auth.users so handle_new_user runs on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: run handle_new_user logic for any existing auth.users missing a workspace membership
DO $$
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
    v_full_name := COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      split_part(COALESCE(u.email, ''), '@', 1)
    );

    INSERT INTO public.profiles (id, email, full_name)
    VALUES (u.id, u.email, v_full_name)
    ON CONFLICT (id) DO NOTHING;

    v_workspace_name := COALESCE(u.raw_user_meta_data->>'workspace_name', v_full_name || '''s Workspace');
    v_workspace_slug := lower(regexp_replace(v_workspace_name, '[^a-z0-9]+', '-', 'gi')) || '-' || substr(u.id::text, 1, 6);

    INSERT INTO public.workspaces (name, slug, owner_id)
    VALUES (v_workspace_name, v_workspace_slug, u.id)
    RETURNING id INTO v_workspace_id;

    INSERT INTO public.users (workspace_id, user_id, status) VALUES (v_workspace_id, u.id, 'active');
    INSERT INTO public.roles (workspace_id, user_id, role) VALUES (v_workspace_id, u.id, 'Owner');

    INSERT INTO public.audit_logs (workspace_id, actor_id, action, target_type, target_id)
    VALUES (v_workspace_id, u.id, 'workspace.created', 'workspace', v_workspace_id::text);
  END LOOP;
END $$;