
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Jakarta',
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'id',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'IDR';
