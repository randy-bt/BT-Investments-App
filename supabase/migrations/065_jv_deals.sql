-- 065_jv_deals.sql — JV deal inbox (email + manual intake)

CREATE TYPE jv_source_channel AS ENUM ('email', 'manual', 'website', 'investorlift', 'sms');
CREATE TYPE jv_deal_status     AS ENUM ('new', 'interested', 'didnt_sell', 'cleared');
CREATE TYPE jv_deal_event_type AS ENUM ('received', 'interested', 'didnt_sell', 'cleared', 'restored');

CREATE TABLE jv_deals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_channel     jv_source_channel NOT NULL,
  source_name        TEXT,
  source_url         TEXT,
  source_ref         TEXT,                       -- RFC822 Message-ID (email); NULL for manual
  address            TEXT,
  address_normalized TEXT,
  asking_price       TEXT,
  redfin_price       INTEGER,
  redfin_url         TEXT,
  note               TEXT,
  raw_excerpt        TEXT,
  status             jv_deal_status NOT NULL DEFAULT 'new',
  needs_review       BOOLEAN NOT NULL DEFAULT false,
  extra              JSONB,
  created_by         UUID REFERENCES users(id),  -- NULL = system/email intake
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency: never ingest the same email twice. Partial unique so manual rows (NULL) don't collide.
CREATE UNIQUE INDEX jv_deals_source_ref_key ON jv_deals(source_ref) WHERE source_ref IS NOT NULL;
CREATE INDEX jv_deals_status_idx ON jv_deals(status);
CREATE INDEX jv_deals_address_normalized_idx ON jv_deals(address_normalized);
CREATE INDEX jv_deals_created_at_idx ON jv_deals(created_at DESC);

CREATE TRIGGER jv_deals_updated_at
  BEFORE UPDATE ON jv_deals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE jv_deal_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jv_deal_id  UUID NOT NULL REFERENCES jv_deals(id) ON DELETE CASCADE,
  event_type  jv_deal_event_type NOT NULL,
  actor_id    UUID REFERENCES users(id),         -- NULL = system
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX jv_deal_events_jv_deal_id_idx ON jv_deal_events(jv_deal_id);
CREATE INDEX jv_deal_events_created_at_idx ON jv_deal_events(created_at DESC);

ALTER TABLE jv_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE jv_deal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read jv_deals" ON jv_deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage jv_deals" ON jv_deals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can read jv_deal_events" ON jv_deal_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage jv_deal_events" ON jv_deal_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
