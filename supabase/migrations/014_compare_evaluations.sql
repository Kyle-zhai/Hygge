ALTER TABLE evaluations
  ADD COLUMN IF NOT EXISTS comparison_base_id UUID REFERENCES evaluations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_evaluations_comparison_base
  ON evaluations(comparison_base_id) WHERE comparison_base_id IS NOT NULL;
