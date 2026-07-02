-- 068_generated_agreements_version.sql
-- Per-lead contract version (V1, V2, ...) so re-drafts for the same lead are
-- numbered. Backfill existing rows in creation order per (lead_id, type).

ALTER TABLE generated_agreements ADD COLUMN version INTEGER;

WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY lead_id, agreement_type
           ORDER BY created_at
         ) AS rn
  FROM generated_agreements
  WHERE lead_id IS NOT NULL
)
UPDATE generated_agreements g
SET version = numbered.rn
FROM numbered
WHERE g.id = numbered.id;

UPDATE generated_agreements SET version = 1 WHERE version IS NULL;
