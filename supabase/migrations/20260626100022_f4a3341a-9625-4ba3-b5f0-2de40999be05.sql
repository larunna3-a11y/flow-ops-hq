
CREATE TABLE public.detection_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('marketplace','courier')),
  name text NOT NULL,
  pattern text NOT NULL,
  priority int NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  is_global boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX detection_rules_lookup_idx ON public.detection_rules (workspace_id, type, enabled, priority);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.detection_rules TO authenticated;
GRANT ALL ON public.detection_rules TO service_role;

ALTER TABLE public.detection_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "detection_rules_select" ON public.detection_rules FOR SELECT TO authenticated
USING (
  is_global = true
  OR (workspace_id IS NOT NULL AND private.is_member_of(auth.uid(), workspace_id))
);

CREATE POLICY "detection_rules_insert" ON public.detection_rules FOR INSERT TO authenticated
WITH CHECK (
  is_global = false
  AND workspace_id IS NOT NULL
  AND private.is_member_of(auth.uid(), workspace_id)
  AND (
    private.is_workspace_owner(auth.uid(), workspace_id)
    OR private.has_role(auth.uid(), 'Supervisor'::public.app_role)
  )
);

CREATE POLICY "detection_rules_update" ON public.detection_rules FOR UPDATE TO authenticated
USING (
  is_global = false
  AND workspace_id IS NOT NULL
  AND private.is_member_of(auth.uid(), workspace_id)
  AND (
    private.is_workspace_owner(auth.uid(), workspace_id)
    OR private.has_role(auth.uid(), 'Supervisor'::public.app_role)
  )
)
WITH CHECK (
  is_global = false
  AND workspace_id IS NOT NULL
  AND private.is_member_of(auth.uid(), workspace_id)
);

CREATE POLICY "detection_rules_delete" ON public.detection_rules FOR DELETE TO authenticated
USING (
  is_global = false
  AND workspace_id IS NOT NULL
  AND private.is_member_of(auth.uid(), workspace_id)
  AND (
    private.is_workspace_owner(auth.uid(), workspace_id)
    OR private.has_role(auth.uid(), 'Supervisor'::public.app_role)
  )
);

CREATE TRIGGER detection_rules_set_updated_at
  BEFORE UPDATE ON public.detection_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.detection_rules (workspace_id, type, name, pattern, priority, enabled, is_global, notes) VALUES
  (NULL, 'marketplace', 'Shopee', '^SPX|^SPE|^SP[0-9]', 10, true, true, 'Shopee tracking prefixes'),
  (NULL, 'marketplace', 'TikTok Shop', '^TT|^TIKTOK', 10, true, true, 'TikTok Shop'),
  (NULL, 'marketplace', 'Tokopedia', '^TKPD|^TKP|^TPD', 10, true, true, 'Tokopedia'),
  (NULL, 'marketplace', 'Lazada', '^LZ|^LEX|^LAZ', 10, true, true, 'Lazada'),
  (NULL, 'marketplace', 'Blibli', '^BLI|^BBL', 10, true, true, 'Blibli'),
  (NULL, 'courier', 'SPX Express', '^SPX', 10, true, true, 'Shopee Xpress'),
  (NULL, 'courier', 'J&T Express', '^JT|^JP[0-9]|^JX', 20, true, true, 'J&T Express'),
  (NULL, 'courier', 'ID Express', '^IDX|^ID[0-9]{8,}', 20, true, true, 'ID Express'),
  (NULL, 'courier', 'AnterAja', '^AA|^ANT', 30, true, true, 'AnterAja'),
  (NULL, 'courier', 'SiCepat', '^00[0-9]{10}|^SC[A-Z]', 30, true, true, 'SiCepat'),
  (NULL, 'courier', 'GoTo Logistics', '^GTL|^GOTO|^GJK', 30, true, true, 'GoTo Logistics'),
  (NULL, 'courier', 'Lazada Express', '^LEX|^LZD', 30, true, true, 'Lazada Express'),
  (NULL, 'courier', 'Ninja Xpress', '^NJV|^NX[A-Z0-9]', 30, true, true, 'Ninja Xpress'),
  (NULL, 'courier', 'JNE', '^JNE|^CGK|^JNJ', 30, true, true, 'JNE'),
  (NULL, 'courier', 'Pos Indonesia', '^POS|^EE[0-9]{9}ID', 30, true, true, 'Pos Indonesia');
