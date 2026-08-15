-- The Dispositions System, v9 (agent-requests #14; every decision Randy's,
-- designed with the analyst 8/14).
--
-- dispo_queue is the ready-to-send queue: one row per deal whose outbound
-- messages were auto-composed at trigger time (marketing page created, or
-- JV deal marked interested). Rows hold the COMPOSED MESSAGES, not
-- references to templates - what you preview is byte-for-byte what sends,
-- and the analyst can refine a queued message in place (14.7) without a
-- template layer.
CREATE TABLE IF NOT EXISTS dispo_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_kind TEXT NOT NULL CHECK (deal_kind IN ('listing', 'jv')),
  listing_page_id UUID REFERENCES listing_pages(id) ON DELETE CASCADE,
  jv_deal_id UUID REFERENCES jv_deals(id) ON DELETE CASCADE,
  -- The naming standard everywhere in this system (14.1):
  -- street number + city + (lead name) -> "4230 Tukwila (Stacie Curlee)"
  deal_name TEXT NOT NULL,
  sms_body TEXT NOT NULL,
  email_subject TEXT NOT NULL,
  email_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'sent', 'dismissed')),
  -- Snapshot at compose time for the row label; the UI recounts live.
  match_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES users(id),
  -- Exactly one deal reference, matching deal_kind.
  CHECK ((deal_kind = 'listing') = (listing_page_id IS NOT NULL)),
  CHECK ((deal_kind = 'jv') = (jv_deal_id IS NOT NULL))
);

-- One READY row per deal: re-firing a trigger (page re-created, Interested
-- clicked twice) must not stack duplicate queue rows. Sent/dismissed rows
-- stay as history.
CREATE UNIQUE INDEX IF NOT EXISTS dispo_queue_ready_listing
  ON dispo_queue (listing_page_id) WHERE status = 'ready' AND listing_page_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS dispo_queue_ready_jv
  ON dispo_queue (jv_deal_id) WHERE status = 'ready' AND jv_deal_id IS NOT NULL;

ALTER TABLE dispo_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dispo_queue readable by authenticated"
  ON dispo_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "dispo_queue writable by authenticated"
  ON dispo_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- The 082 lesson, applied at birth this time: the service role bypasses
-- RLS but NOT table privileges. Without these grants the bridge's writes
-- would fail silently.
GRANT SELECT, INSERT, UPDATE, DELETE ON dispo_queue TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON dispo_queue TO authenticated;

-- JV scoring inputs (14.5). The formula wants county assessor values
-- (value = redfin_price, else county_value * 1.08; DEV badge compares
-- improvement to total). No county data exists on any row yet - these
-- columns are where the analyst/scan will land it. Until then the score
-- lib falls back to rentcast_value from `extra`, which most rows carry.
ALTER TABLE jv_deals ADD COLUMN IF NOT EXISTS county_value NUMERIC;
ALTER TABLE jv_deals ADD COLUMN IF NOT EXISTS county_improvement_value NUMERIC;

-- jv_deals.status gains 'marketing' (14.5): set when a JV deal's sends go
-- out; drives the homepage "Deals in Dispo" stat and LIVE DEALS cards.
-- status is unconstrained TEXT, so no ALTER needed - recorded here so the
-- vocabulary lives in a migration: new / interested / marketing /
-- didnt_sell / cleared.

-- The build-mode kill switch (Randy 8/15: "ensure you don't actually send
-- anything out to anybody - we're only building"). sendQueueRow refuses to
-- run while this is 'false', server-side, regardless of who calls it or
-- from where. Flipping to 'true' is the go-live act.
INSERT INTO app_settings (key, value)
  VALUES ('dispo_sends_enabled', 'false')
  ON CONFLICT (key) DO NOTHING;
