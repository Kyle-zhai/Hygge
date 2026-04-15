-- 4-way product classification for the product-mode persona selector.
-- product_category: utility (产品力) | market (市场力) | novelty (创新力) | reliability (生命线)
-- product_traits:   sub-tags within each category; multi-valued.

ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS product_category text,
  ADD COLUMN IF NOT EXISTS product_traits text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.personas
  DROP CONSTRAINT IF EXISTS personas_product_category_check;
ALTER TABLE public.personas
  ADD CONSTRAINT personas_product_category_check
  CHECK (product_category IS NULL OR product_category IN ('utility', 'market', 'novelty', 'reliability'));

CREATE INDEX IF NOT EXISTS personas_product_category_idx ON public.personas (product_category) WHERE product_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS personas_product_traits_gin_idx ON public.personas USING gin (product_traits);

-- Map the 15 existing product-mode personas into the new taxonomy.

-- Utility (产品力): usability / tech_quality / power_features / user_research
UPDATE public.personas SET product_category = 'utility', product_traits = ARRAY['tech_quality']
  WHERE identity->>'name' = 'Nathan Park' AND category = 'technical';
UPDATE public.personas SET product_category = 'utility', product_traits = ARRAY['usability','tech_quality']
  WHERE identity->>'name' = 'Rachel Nguyen' AND category = 'technical';
UPDATE public.personas SET product_category = 'utility', product_traits = ARRAY['usability']
  WHERE identity->>'name' = 'Maya Hernandez' AND category = 'design';
UPDATE public.personas SET product_category = 'utility', product_traits = ARRAY['user_research']
  WHERE identity->>'name' = 'Lisa Tanaka' AND category = 'design';
UPDATE public.personas SET product_category = 'utility', product_traits = ARRAY['usability']
  WHERE identity->>'name' = 'Patricia Morgan' AND category = 'end_user';
UPDATE public.personas SET product_category = 'utility', product_traits = ARRAY['power_features']
  WHERE identity->>'name' = 'Jordan Ellis' AND category = 'end_user';

-- Market (市场力): growth / positioning / business_model / sales
UPDATE public.personas SET product_category = 'market', product_traits = ARRAY['positioning','business_model']
  WHERE identity->>'name' = 'Amanda Foster' AND category = 'product';
UPDATE public.personas SET product_category = 'market', product_traits = ARRAY['growth','business_model']
  WHERE identity->>'name' = 'Kevin Liu' AND category = 'product';
UPDATE public.personas SET product_category = 'market', product_traits = ARRAY['positioning']
  WHERE identity->>'name' = 'Olivia Brennan' AND category = 'product';
UPDATE public.personas SET product_category = 'market', product_traits = ARRAY['business_model']
  WHERE identity->>'name' = 'Richard Lawson' AND category = 'business';
UPDATE public.personas SET product_category = 'market', product_traits = ARRAY['positioning']
  WHERE identity->>'name' = 'Diana Reeves' AND category = 'business';

-- Novelty (创新力): visual_design / disruption / frontier / experience
UPDATE public.personas SET product_category = 'novelty', product_traits = ARRAY['visual_design']
  WHERE identity->>'name' = 'Simon Clarke' AND category = 'design';
UPDATE public.personas SET product_category = 'novelty', product_traits = ARRAY['frontier','disruption']
  WHERE identity->>'name' = 'Brandon Hayes' AND category = 'end_user';

-- Reliability (生命线): ops_stability / security / financial / risk
UPDATE public.personas SET product_category = 'reliability', product_traits = ARRAY['ops_stability']
  WHERE identity->>'name' = 'Derek Walsh' AND category = 'technical';
UPDATE public.personas SET product_category = 'reliability', product_traits = ARRAY['financial']
  WHERE identity->>'name' = 'Thomas Grant' AND category = 'business';

NOTIFY pgrst, 'reload schema';
