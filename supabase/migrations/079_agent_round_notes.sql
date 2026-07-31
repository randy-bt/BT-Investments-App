-- Agent round notes (spec 7/31): when Randy runs a lead-update round, the AI
-- Agent writes one note per flagged lead and they surface inside ACQ2, next to
-- the data Randy already second-screens.
--
-- Deliberately NOT rows in `updates`. The activity feed is Aldo's working
-- surface; these are Randy-facing decision prep containing candid strategy
-- that is kept out of Aldo's lead updates on purpose. Keeping them in their
-- own table is what makes "Randy-only" enforceable rather than a UI promise.

CREATE TABLE IF NOT EXISTS agent_round_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  -- groups one sweep's notes together; a new round supersedes the last
  round_id UUID NOT NULL,
  section TEXT NOT NULL CHECK (section IN ('mechanical', 'decision')),
  -- agent-set order within a section (PRIORITY leads first, then importance)
  sort_order INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- ACQ2 reads exactly one slice: the open notes, grouped by section and
-- ordered within it.
CREATE INDEX IF NOT EXISTS agent_round_notes_open_idx
  ON agent_round_notes (section, sort_order)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS agent_round_notes_lead_idx
  ON agent_round_notes (lead_id, created_at DESC);

-- "One open note per lead" from the spec, enforced by the database rather
-- than by the upsert action remembering to check.
CREATE UNIQUE INDEX IF NOT EXISTS agent_round_notes_one_open_per_lead
  ON agent_round_notes (lead_id)
  WHERE status = 'open';

ALTER TABLE agent_round_notes ENABLE ROW LEVEL SECURITY;

-- Randy-only, enforced at the query level per the spec, not just hidden in
-- the UI. Aldo authenticates as a normal user and these policies mean he
-- cannot read these rows even by querying the table directly. The AI Agent
-- is included because it authors them through the bridge under its own JWT.
CREATE POLICY "owner and agent can read round notes"
  ON agent_round_notes FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'email' IN ('randy@btinvestments.co', 'ai-agent@btinvestments.co'));

CREATE POLICY "owner and agent can insert round notes"
  ON agent_round_notes FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' IN ('randy@btinvestments.co', 'ai-agent@btinvestments.co'));

CREATE POLICY "owner and agent can update round notes"
  ON agent_round_notes FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'email' IN ('randy@btinvestments.co', 'ai-agent@btinvestments.co'))
  WITH CHECK (auth.jwt() ->> 'email' IN ('randy@btinvestments.co', 'ai-agent@btinvestments.co'));

GRANT SELECT, INSERT, UPDATE ON agent_round_notes TO authenticated;
GRANT ALL ON agent_round_notes TO service_role;
