-- Call transcripts — raw Whisper output stored alongside the AI summary
-- it produced. Linked 1:1 to the `updates` row that holds the summary.
-- The audio file itself is already an attachment; this table holds the
-- textual transcript so future features (lead-record chat, full-text
-- search across calls, re-summarization with new prompts) can read the
-- verbatim without re-paying for transcription.
--
-- No UI surfaces this today — pure storage. Going forward, every
-- successful /api/summarize run writes one row here.

CREATE TABLE call_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID NOT NULL UNIQUE REFERENCES updates(id) ON DELETE CASCADE,
  transcript_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX call_transcripts_update_id_idx ON call_transcripts(update_id);

ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;

-- Match the activity-feed permissions: authenticated users can read and
-- insert. We rely on the route-side auth + the link to a specific update
-- (which itself is RLS-protected) as the practical access control.
CREATE POLICY "Authenticated users can view call transcripts"
  ON call_transcripts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert call transcripts"
  ON call_transcripts FOR INSERT TO authenticated WITH CHECK (true);

GRANT SELECT, INSERT ON call_transcripts TO authenticated;
