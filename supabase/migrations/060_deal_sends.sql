-- Many-to-many: each deal can cover one or more locations
CREATE TABLE listing_page_locations (
  listing_page_id UUID NOT NULL REFERENCES listing_pages(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  PRIMARY KEY (listing_page_id, location_id)
);

CREATE INDEX listing_page_locations_location_id_idx ON listing_page_locations(location_id);

ALTER TABLE listing_page_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read listing_page_locations"
  ON listing_page_locations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage listing_page_locations"
  ON listing_page_locations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tracks which deals have been sent to which investors
CREATE TABLE deal_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_page_id UUID NOT NULL REFERENCES listing_pages(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_by UUID NOT NULL REFERENCES users(id),
  UNIQUE (listing_page_id, investor_id)
);

CREATE INDEX deal_sends_listing_page_id_idx ON deal_sends(listing_page_id);
CREATE INDEX deal_sends_investor_id_idx ON deal_sends(investor_id);

ALTER TABLE deal_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read deal_sends"
  ON deal_sends FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage deal_sends"
  ON deal_sends FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Hierarchy-aware match function: returns all investors interested in a deal's
-- direct locations OR any ancestor (county, state, region) of those locations.
CREATE OR REPLACE FUNCTION matching_investors_for_listing_page(p_listing_page_id UUID)
RETURNS TABLE (
  investor_id UUID,
  match_location_id UUID,
  match_location_name TEXT,
  match_location_kind TEXT
)
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE deal_location_tree AS (
    SELECT location_id
    FROM listing_page_locations
    WHERE listing_page_id = p_listing_page_id

    UNION

    SELECT l.parent_id
    FROM locations l
    JOIN deal_location_tree dlt ON l.id = dlt.location_id
    WHERE l.parent_id IS NOT NULL
  )
  SELECT DISTINCT ON (i.id)
    i.id,
    il.location_id,
    l.name,
    l.kind
  FROM investors i
  JOIN investor_locations il ON il.investor_id = i.id
  JOIN locations l ON l.id = il.location_id
  WHERE il.location_id IN (SELECT location_id FROM deal_location_tree WHERE location_id IS NOT NULL)
    AND i.status = 'active'
  ORDER BY
    i.id,
    CASE l.kind WHEN 'city' THEN 1 WHEN 'neighborhood' THEN 2 WHEN 'county' THEN 3 WHEN 'state' THEN 4 WHEN 'region' THEN 5 ELSE 6 END;
$$;
