-- Structured locations for investors (cities, counties, regions)
-- Replaces the free-text locations_of_interest field for queryable matching
CREATE TABLE investor_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX investor_locations_investor_id_idx ON investor_locations(investor_id);
CREATE INDEX investor_locations_name_idx ON investor_locations(location_name);

-- Prevent duplicate locations per investor
CREATE UNIQUE INDEX investor_locations_unique_idx
  ON investor_locations(investor_id, lower(location_name));

-- RLS
ALTER TABLE investor_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read investor locations"
  ON investor_locations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage investor locations"
  ON investor_locations FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
