-- personas.id is text in production, keep persona_id as text and add FK
ALTER TABLE public.debates
  ALTER COLUMN persona_id TYPE text USING persona_id::text;

ALTER TABLE public.debates
  ADD CONSTRAINT fk_debates_persona FOREIGN KEY (persona_id) REFERENCES public.personas(id);
