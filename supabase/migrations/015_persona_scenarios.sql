ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS scenarios text[] DEFAULT '{}';
