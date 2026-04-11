ALTER TABLE summary_reports ADD COLUMN consensus_score integer DEFAULT NULL;
ALTER TABLE summary_reports ADD COLUMN synthesis text DEFAULT NULL;
ALTER TABLE summary_reports ADD COLUMN debate_highlights jsonb DEFAULT NULL;
