-- Hierarchical taxonomy for topic-mode persona selection.
-- Level 1: domain (4 values) — Physical/Social/Intellectual/Utility.
-- Level 2: sub_domain (16 values).
-- Level 3: dimensions (string[]) — sub-domain-specific topic slices.
-- A persona may have domain/sub_domain NULL (product mode, not affected).

ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS sub_domain text,
  ADD COLUMN IF NOT EXISTS dimensions text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.personas
  DROP CONSTRAINT IF EXISTS personas_domain_check;
ALTER TABLE public.personas
  ADD CONSTRAINT personas_domain_check
  CHECK (domain IS NULL OR domain IN ('physical', 'social', 'intellectual', 'utility'));

ALTER TABLE public.personas
  DROP CONSTRAINT IF EXISTS personas_sub_domain_check;
ALTER TABLE public.personas
  ADD CONSTRAINT personas_sub_domain_check
  CHECK (sub_domain IS NULL OR sub_domain IN (
    'food', 'living', 'health', 'finance', 'geography',
    'career', 'relationships', 'leisure', 'current_affairs',
    'opinions', 'values', 'emotions', 'knowledge',
    'planning', 'small_talk', 'help'
  ));

CREATE INDEX IF NOT EXISTS personas_domain_idx ON public.personas (domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS personas_sub_domain_idx ON public.personas (sub_domain) WHERE sub_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS personas_dimensions_gin_idx ON public.personas USING gin (dimensions);
