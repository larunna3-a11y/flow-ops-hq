ALTER TABLE public.packing_records
  ADD COLUMN IF NOT EXISTS verified_skus jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS missing_skus jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS missing_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_status text NOT NULL DEFAULT 'Complete';