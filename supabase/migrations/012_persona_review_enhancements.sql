-- 012_persona_review_enhancements.sql
-- Add explicit overall_stance and cited_references columns to persona_reviews
-- so we can (a) stop deriving the stance badge from averaged dimension scores
-- (which caused rationale/badge mismatches) and (b) surface the concrete
-- claims/data each persona cited.

ALTER TABLE persona_reviews
  ADD COLUMN IF NOT EXISTS overall_stance text,
  ADD COLUMN IF NOT EXISTS cited_references jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN persona_reviews.overall_stance IS
  'LLM-declared overall stance: strongly_positive | positive | neutral | negative | strongly_negative';

COMMENT ON COLUMN persona_reviews.cited_references IS
  'Array of specific claims, data points, or source references the persona cited in their review';
