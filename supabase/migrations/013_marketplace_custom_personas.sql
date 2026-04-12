-- ============================================
-- Custom Personas & Marketplace
-- ============================================

-- Add custom persona fields to personas table
ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'official',
  ADD COLUMN IF NOT EXISTS uses_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Index for marketplace browsing (public custom personas, ordered by popularity)
CREATE INDEX IF NOT EXISTS idx_personas_marketplace
  ON public.personas (is_public, is_custom, uses_count DESC)
  WHERE is_public = true;

-- Index for user's own custom personas
CREATE INDEX IF NOT EXISTS idx_personas_creator
  ON public.personas (creator_id)
  WHERE creator_id IS NOT NULL;

-- Persona saves / bookmarks
CREATE TABLE IF NOT EXISTS public.persona_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, persona_id)
);

CREATE INDEX IF NOT EXISTS idx_persona_saves_user
  ON public.persona_saves (user_id);

-- RLS policies
ALTER TABLE public.persona_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saves"
  ON public.persona_saves FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saves"
  ON public.persona_saves FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saves"
  ON public.persona_saves FOR DELETE
  USING (auth.uid() = user_id);

-- Update subscriptions table to track custom persona count
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS custom_personas_limit integer NOT NULL DEFAULT 0;

-- Set existing plans' custom persona limits
UPDATE public.subscriptions SET custom_personas_limit = 0 WHERE plan = 'free';
UPDATE public.subscriptions SET custom_personas_limit = 10 WHERE plan = 'pro';
UPDATE public.subscriptions SET custom_personas_limit = -1 WHERE plan = 'max';
