
-- Extend orders with customer phone and shipping status
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS shipping_status text NOT NULL DEFAULT 'Pending';

-- Indexes for search
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders (workspace_id, order_number);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON public.orders (workspace_id, tracking_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON public.orders (workspace_id, customer_name);
CREATE INDEX IF NOT EXISTS idx_orders_marketplace ON public.orders (workspace_id, marketplace);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON public.orders (workspace_id, order_status);
CREATE INDEX IF NOT EXISTS idx_orders_packing_status ON public.orders (workspace_id, packing_status);

-- Order Items table
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sku text NOT NULL,
  product_name text NOT NULL,
  product_variant text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  warehouse_location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read order_items" ON public.order_items
  FOR SELECT USING (private.is_member_of(auth.uid(), workspace_id));

CREATE POLICY "Managers insert order_items" ON public.order_items
  FOR INSERT WITH CHECK (
    private.is_member_of(auth.uid(), workspace_id)
    AND (private.has_role(auth.uid(), 'Owner'::app_role) OR private.has_role(auth.uid(), 'Supervisor'::app_role))
  );

CREATE POLICY "Managers update order_items" ON public.order_items
  FOR UPDATE USING (
    private.is_member_of(auth.uid(), workspace_id)
    AND (private.has_role(auth.uid(), 'Owner'::app_role) OR private.has_role(auth.uid(), 'Supervisor'::app_role))
  ) WITH CHECK (private.is_member_of(auth.uid(), workspace_id));

CREATE POLICY "Managers delete order_items" ON public.order_items
  FOR DELETE USING (
    private.is_member_of(auth.uid(), workspace_id)
    AND (private.has_role(auth.uid(), 'Owner'::app_role) OR private.has_role(auth.uid(), 'Supervisor'::app_role))
  );

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku ON public.order_items (workspace_id, sku);

CREATE TRIGGER trg_order_items_updated_at
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
