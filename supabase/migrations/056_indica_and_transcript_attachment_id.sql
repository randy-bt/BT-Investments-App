-- Indica AI per-record chat messages. Shared between admin users for
-- a given entity; never auto-deleted. Authenticated users can read +
-- insert (assistant rows have author_id NULL and role = 'assistant').

CREATE TABLE indica_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  entity_type NOT NULL,
  entity_id    UUID NOT NULL,
  author_id    UUID REFERENCES users(id),
  role         TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX indica_messages_entity_idx
  ON indica_messages(entity_type, entity_id, created_at);

ALTER TABLE indica_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view indica messages"
  ON indica_messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert indica messages"
  ON indica_messages FOR INSERT TO authenticated WITH CHECK (true);

GRANT SELECT, INSERT ON indica_messages TO authenticated;

-- Link call_transcripts to the source audio attachment directly so
-- backfill (which runs Whisper on attachments that were never
-- summarized) has a linkage point. update_id stays optional and
-- carries the summary linkage when a summary exists.

ALTER TABLE call_transcripts
  ADD COLUMN attachment_id UUID REFERENCES attachments(id) ON DELETE CASCADE;

ALTER TABLE call_transcripts
  ALTER COLUMN update_id DROP NOT NULL;

ALTER TABLE call_transcripts
  DROP CONSTRAINT IF EXISTS call_transcripts_update_id_key;

ALTER TABLE call_transcripts
  ADD CONSTRAINT call_transcripts_attachment_id_key UNIQUE (attachment_id);

CREATE INDEX IF NOT EXISTS call_transcripts_attachment_id_idx
  ON call_transcripts(attachment_id);
