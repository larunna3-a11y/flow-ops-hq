
-- Extend returns table with full inspection & resolution data
ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS return_number text,
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS courier text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS packing_record_id uuid REFERENCES public.packing_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS packer_name text,
  ADD COLUMN IF NOT EXISTS packing_date timestamptz,
  ADD COLUMN IF NOT EXISTS condition text,
  ADD COLUMN IF NOT EXISTS inspection_notes text,
  ADD COLUMN IF NOT EXISTS inspection_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS inspection_date timestamptz,
  ADD COLUMN IF NOT EXISTS inspector_id uuid,
  ADD COLUMN IF NOT EXISTS inspector_name text,
  ADD COLUMN IF NOT EXISTS resolution text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Backfill return_number from rma where missing then enforce uniqueness per workspace
UPDATE public.returns SET return_number = rma WHERE return_number IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS returns_workspace_return_number_key
  ON public.returns (workspace_id, return_number);
CREATE INDEX IF NOT EXISTS returns_workspace_tracking_idx
  ON public.returns (workspace_id, tracking_number);
CREATE INDEX IF NOT EXISTS returns_workspace_order_number_idx
  ON public.returns (workspace_id, order_number);

-- ============= return_items =============
CREATE TABLE IF NOT EXISTS public.return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  sku text,
  product_name text,
  product_variant text,
  original_quantity integer NOT NULL DEFAULT 0,
  returned_quantity integer NOT NULL DEFAULT 0,
  missing_quantity integer NOT NULL DEFAULT 0,
  damaged_quantity integer NOT NULL DEFAULT 0,
  wrong_quantity integer NOT NULL DEFAULT 0,
  inventory_action text NOT NULL DEFAULT 'none',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_items TO authenticated;
GRANT ALL ON public.return_items TO service_role;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view return_items" ON public.return_items FOR SELECT
  USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Members insert return_items" ON public.return_items FOR INSERT
  WITH CHECK (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Members update return_items" ON public.return_items FOR UPDATE
  USING (private.is_member_of(auth.uid(), workspace_id))
  WITH CHECK (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Owners delete return_items" ON public.return_items FOR DELETE
  USING (private.is_workspace_owner(auth.uid(), workspace_id));

CREATE TRIGGER return_items_set_updated_at BEFORE UPDATE ON public.return_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS return_items_return_idx ON public.return_items(return_id);

-- ============= return_timeline =============
CREATE TABLE IF NOT EXISTS public.return_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  event text NOT NULL,
  message text,
  actor_id uuid,
  actor_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.return_timeline TO authenticated;
GRANT ALL ON public.return_timeline TO service_role;
ALTER TABLE public.return_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view return_timeline" ON public.return_timeline FOR SELECT
  USING (private.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "Members insert return_timeline" ON public.return_timeline FOR INSERT
  WITH CHECK (private.is_member_of(auth.uid(), workspace_id) AND actor_id = auth.uid());

CREATE INDEX IF NOT EXISTS return_timeline_return_idx ON public.return_timeline(return_id, created_at);

-- Realtime
ALTER TABLE public.returns REPLICA IDENTITY FULL;
ALTER TABLE public.return_items REPLICA IDENTITY FULL;
ALTER TABLE public.return_timeline REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='return_items';
  IF NOT FOUND THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.return_items'; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='return_timeline';
  IF NOT FOUND THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.return_timeline'; END IF;
END $$;
