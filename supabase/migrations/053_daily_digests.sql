-- Daily synthesized newsletter digest. One row per calendar day per
-- user. headline is the bold one-line "what's in here" line; body is
-- the synthesized digest content; source_emails is a JSONB array of
-- the raw emails (subject + from + received_at + truncated text) so
-- we can show "Sources:" and resynthesize if a prompt changes.

CREATE TABLE daily_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Calendar date this digest covers (in PST). UNIQUE so the cron
  -- can safely re-run without duplicating.
  digest_date DATE NOT NULL UNIQUE,
  headline TEXT NOT NULL,
  body TEXT NOT NULL,
  source_emails JSONB NOT NULL DEFAULT '[]',
  -- Generation metadata
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  email_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX daily_digests_date_idx ON daily_digests(digest_date DESC);

ALTER TABLE daily_digests ENABLE ROW LEVEL SECURITY;

-- Only Randy reads this — service role writes via the cron.
CREATE POLICY "Randy reads digests"
  ON daily_digests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.email = 'randy@btinvestments.co'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON daily_digests TO service_role;
