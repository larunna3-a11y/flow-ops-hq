ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS packed_by uuid,
  ADD COLUMN IF NOT EXISTS packed_by_name text,
  ADD COLUMN IF NOT EXISTS packed_at timestamp with time zone;