ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS sku_marketplace text,
  ADD COLUMN IF NOT EXISTS sku_master text;