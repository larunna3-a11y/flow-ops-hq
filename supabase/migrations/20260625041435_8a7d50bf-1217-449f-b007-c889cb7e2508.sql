
CREATE TABLE public.packing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  role text,
  scan_timestamp timestamptz NOT NULL DEFAULT now(),
  packing_timestamp timestamptz,
  raw_code text NOT NULL,
  order_number text,
  tracking_number text,
  marketplace text,
  courier text,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Packed','Shipped','Cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX packing_records_workspace_rawcode_key ON public.packing_records(workspace_id, raw_code);
CREATE UNIQUE INDEX packing_records_workspace_tracking_key ON public.packing_records(workspace_id, tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX packing_records_workspace_created_idx ON public.packing_records(workspace_id, created_at DESC);
CREATE INDEX packing_records_workspace_marketplace_idx ON public.packing_records(workspace_id, marketplace);
CREATE INDEX packing_records_workspace_courier_idx ON public.packing_records(workspace_id, courier);
CREATE INDEX packing_records_workspace_status_idx ON public.packing_records(workspace_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.packing_records TO authenticated;
GRANT ALL ON public.packing_records TO service_role;

ALTER TABLE public.packing_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view packing records"
  ON public.packing_records FOR SELECT TO authenticated
  USING (private.is_member_of(auth.uid(), workspace_id));

CREATE POLICY "Members create packing records"
  ON public.packing_records FOR INSERT TO authenticated
  WITH CHECK (private.is_member_of(auth.uid(), workspace_id) AND user_id = auth.uid());

CREATE POLICY "Members update packing records"
  ON public.packing_records FOR UPDATE TO authenticated
  USING (
    private.is_member_of(auth.uid(), workspace_id)
    AND (
      user_id = auth.uid()
      OR private.has_role(auth.uid(), 'Owner'::public.app_role)
      OR private.has_role(auth.uid(), 'Supervisor'::public.app_role)
    )
  )
  WITH CHECK (private.is_member_of(auth.uid(), workspace_id));

CREATE POLICY "Owners delete packing records"
  ON public.packing_records FOR DELETE TO authenticated
  USING (private.is_workspace_owner(auth.uid(), workspace_id));

CREATE TRIGGER packing_records_updated_at
  BEFORE UPDATE ON public.packing_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  rma text NOT NULL,
  order_number text,
  marketplace text,
  reason text,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','inspecting','restocked','rejected')),
  assigned_to uuid,
  assigned_to_name text,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, rma)
);

CREATE INDEX returns_workspace_created_idx ON public.returns(workspace_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.returns TO authenticated;
GRANT ALL ON public.returns TO service_role;

ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view returns"
  ON public.returns FOR SELECT TO authenticated
  USING (private.is_member_of(auth.uid(), workspace_id));

CREATE POLICY "Members create returns"
  ON public.returns FOR INSERT TO authenticated
  WITH CHECK (private.is_member_of(auth.uid(), workspace_id));

CREATE POLICY "Members update returns"
  ON public.returns FOR UPDATE TO authenticated
  USING (private.is_member_of(auth.uid(), workspace_id))
  WITH CHECK (private.is_member_of(auth.uid(), workspace_id));

CREATE POLICY "Owners delete returns"
  ON public.returns FOR DELETE TO authenticated
  USING (private.is_workspace_owner(auth.uid(), workspace_id));

CREATE TRIGGER returns_updated_at
  BEFORE UPDATE ON public.returns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.log_activity(
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
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT workspace_id INTO v_workspace FROM public.users WHERE user_id = auth.uid() LIMIT 1;
  IF v_workspace IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.audit_logs(workspace_id, actor_id, action, target_type, target_id, metadata)
  VALUES (v_workspace, auth.uid(), _action, _target_type, _target_id, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_activity(text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_activity(text,text,text,jsonb) TO authenticated;
