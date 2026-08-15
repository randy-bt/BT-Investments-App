-- County-record enrichment for JV deals (analyst proposal, Randy-approved
-- direction, 8/15). Root finding: we were trusting scraped email text for
-- facts the county publishes free - Investorlift campaign 9026728 shipped
-- fabricated specs (a four-unit apartment building described as a 720 sqft
-- 2bd/1ba house), and nothing could flag it.
--
-- county_data holds the authoritative record (beds, baths, living/lot
-- sqft, year built, zoning, grade, condition, appraised values). The
-- scraped values stay separately in `extra` ON PURPOSE, so we can see
-- which sources lie. County wins for anything displayed or sent to a
-- buyer; price stays the one thing only the source knows.
ALTER TABLE jv_deals ADD COLUMN IF NOT EXISTS county_data JSONB;
ALTER TABLE jv_deals ADD COLUMN IF NOT EXISTS county_fetched_at TIMESTAMPTZ;
