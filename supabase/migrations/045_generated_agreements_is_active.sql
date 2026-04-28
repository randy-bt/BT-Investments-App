ALTER TABLE generated_agreements
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;

CREATE INDEX idx_generated_agreements_is_active ON generated_agreements(is_active);
