-- 067_generated_agreements_review.sql
-- Store the automated pre-send review (deterministic checks + AI review)
-- alongside each generated agreement so issues are auditable later.

ALTER TABLE generated_agreements ADD COLUMN review JSONB;
