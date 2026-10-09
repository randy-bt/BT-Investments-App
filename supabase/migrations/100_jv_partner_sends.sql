-- Sent to JVs (Randy, Oct 9 2026): one row per partner a deal was sent to,
-- recorded by hand for now ("I sent Dayton to these five") through the
-- bridge, and later written by an in-app partner blast the same way
-- deal_sends records investor sends. The Deals tab's Active tile lights
-- the "Sent to JVs" milestone green with the row count and the earliest
-- sent_at.
CREATE TABLE jv_partner_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_page_id UUID REFERENCES listing_pages(id) ON DELETE CASCADE,
  jv_deal_id UUID REFERENCES jv_deals(id) ON DELETE CASCADE,
  partner_name TEXT NOT NULL,
  -- Optional link to an investor record when the partner is one.
  partner_investor_id UUID REFERENCES investors(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT jv_partner_sends_one_deal CHECK (
    (listing_page_id IS NOT NULL)::int + (jv_deal_id IS NOT NULL)::int = 1
  )
);

CREATE INDEX jv_partner_sends_listing_page_idx ON jv_partner_sends(listing_page_id);
CREATE INDEX jv_partner_sends_jv_deal_idx ON jv_partner_sends(jv_deal_id);

ALTER TABLE jv_partner_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage jv partner sends"
  ON jv_partner_sends FOR ALL TO authenticated USING (true) WITH CHECK (true);
