-- Signal funnel counters (handoff 015 part 2). Meta moved the Signal pixel
-- into restricted data mode on 7/29, which blocks NEW custom events until
-- they are confirmed in Events Manager. Part 1 mirrors the funnel onto
-- standard events so Meta keeps seeing it; this table is the durable fix.
-- Meta can restrict what Meta sees. It cannot restrict our own database.
--
-- Deliberately minimal: a counter, not an analytics product. It holds NO
-- personal data. Step, method, an opaque per-visit session id, timestamp.
-- No name, email, phone, IP, or message content, ever. The API route that
-- writes here accepts those three fields and drops everything else, and
-- the CHECK constraints below reject anything outside the known vocabulary.

CREATE TABLE IF NOT EXISTS signal_funnel_events (
  id BIGSERIAL PRIMARY KEY,
  step TEXT NOT NULL CHECK (step IN ('started', 'composed', 'submitted')),
  method TEXT CHECK (method IN ('voice', 'type')),
  -- Random id generated client-side per visit (sessionStorage), so the
  -- three steps of one visitor can be tied together. Not a user id: it
  -- dies with the tab and maps to nothing outside this table.
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_signal_funnel_events_created ON signal_funnel_events (created_at DESC);
-- Reassembling one visit's journey is the whole point of session_id.
CREATE INDEX idx_signal_funnel_events_session ON signal_funnel_events (session_id);

ALTER TABLE signal_funnel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read signal funnel events"
  ON signal_funnel_events FOR SELECT TO authenticated USING (true);
-- Writes go through the service-role client only (public API route).

-- MCP-applied migrations don't get default grants (see migration 073).
GRANT SELECT ON signal_funnel_events TO authenticated;
GRANT ALL ON signal_funnel_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE signal_funnel_events_id_seq TO service_role;
