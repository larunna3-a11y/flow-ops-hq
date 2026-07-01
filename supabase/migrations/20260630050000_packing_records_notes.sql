-- Adds a free-text notes column to packing_records so packers/supervisors can
-- record packing remarks (used by the Reports → Packing Exception Report).
-- Additive-only change: no existing columns, constraints, or data are touched.
ALTER TABLE public.packing_records
  ADD COLUMN IF NOT EXISTS notes text;
