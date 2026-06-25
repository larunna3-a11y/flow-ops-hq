
DROP FUNCTION IF EXISTS public.log_activity(text,text,text,jsonb);

CREATE OR REPLACE FUNCTION private.log_activity(
  _actor_id uuid,
  _action text,
  _target_type text DEFAULT NULL,
  _target_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace uuid;
  v_id uuid;
BEGIN
  IF _actor_id IS NULL THEN RETURN NULL; END IF;
  SELECT workspace_id INTO v_workspace FROM public.users WHERE user_id = _actor_id LIMIT 1;
  IF v_workspace IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.audit_logs(workspace_id, actor_id, action, target_type, target_id, metadata)
  VALUES (v_workspace, _actor_id, _action, _target_type, _target_id, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.log_activity(uuid,text,text,text,jsonb) FROM PUBLIC;
