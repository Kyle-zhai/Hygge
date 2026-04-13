ALTER TABLE public.debates
  ALTER COLUMN persona_id TYPE uuid USING persona_id::uuid;

ALTER TABLE public.debates
  ADD CONSTRAINT fk_debates_persona FOREIGN KEY (persona_id) REFERENCES public.personas(id);
