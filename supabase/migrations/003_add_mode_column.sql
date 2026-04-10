ALTER TABLE evaluations ADD COLUMN mode text NOT NULL DEFAULT 'product';
ALTER TABLE evaluations ADD COLUMN topic_classification jsonb DEFAULT NULL;
