-- Digest format + trigger redesign:
--   - body_json holds the structured payload (lead + sections + items)
--   - window_start / window_end record the fetch window so the next
--     build can resume from where the last one ended.
--   - Drop digest_date UNIQUE — multiple builds per day are allowed now
--     that the cron is gone and each Build Now click writes a new row.
--   - New index for the carousel sort.

ALTER TABLE daily_digests
  ADD COLUMN body_json    JSONB,
  ADD COLUMN window_start TIMESTAMPTZ,
  ADD COLUMN window_end   TIMESTAMPTZ;

ALTER TABLE daily_digests
  DROP CONSTRAINT IF EXISTS daily_digests_digest_date_key;

CREATE INDEX IF NOT EXISTS daily_digests_created_at_idx
  ON daily_digests(created_at DESC);
