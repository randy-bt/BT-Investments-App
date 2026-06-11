-- Structured location catalog with parent/child hierarchy
-- Replaces free-text locations_of_interest matching with queryable joins
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('city', 'county', 'region', 'state', 'neighborhood')),
  parent_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  state_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX locations_parent_id_idx ON locations(parent_id);
CREATE INDEX locations_name_idx ON locations(lower(name));
CREATE UNIQUE INDEX locations_name_kind_state_idx
  ON locations(lower(name), kind, COALESCE(state_code, ''));

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read locations"
  ON locations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert locations"
  ON locations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins can update locations"
  ON locations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete locations"
  ON locations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Seed: region → state → county → cities
DO $$
DECLARE
  region_pnw UUID;
  state_wa UUID;
  state_or UUID;
  state_id_state UUID;
  county_king UUID;
  county_pierce UUID;
  county_snohomish UUID;
BEGIN
  INSERT INTO locations (name, kind, state_code) VALUES ('Pacific Northwest', 'region', NULL)
    RETURNING id INTO region_pnw;
  INSERT INTO locations (name, kind, parent_id, state_code) VALUES ('Washington', 'state', region_pnw, 'WA')
    RETURNING id INTO state_wa;
  INSERT INTO locations (name, kind, parent_id, state_code) VALUES ('Oregon', 'state', region_pnw, 'OR')
    RETURNING id INTO state_or;
  INSERT INTO locations (name, kind, parent_id, state_code) VALUES ('Idaho', 'state', region_pnw, 'ID')
    RETURNING id INTO state_id_state;

  INSERT INTO locations (name, kind, parent_id, state_code) VALUES ('King County', 'county', state_wa, 'WA')
    RETURNING id INTO county_king;
  INSERT INTO locations (name, kind, parent_id, state_code) VALUES ('Pierce County', 'county', state_wa, 'WA')
    RETURNING id INTO county_pierce;
  INSERT INTO locations (name, kind, parent_id, state_code) VALUES ('Snohomish County', 'county', state_wa, 'WA')
    RETURNING id INTO county_snohomish;

  -- King County cities
  INSERT INTO locations (name, kind, parent_id, state_code) VALUES
    ('Seattle', 'city', county_king, 'WA'),
    ('Bellevue', 'city', county_king, 'WA'),
    ('Renton', 'city', county_king, 'WA'),
    ('Kirkland', 'city', county_king, 'WA'),
    ('Sammamish', 'city', county_king, 'WA'),
    ('Issaquah', 'city', county_king, 'WA'),
    ('Redmond', 'city', county_king, 'WA'),
    ('Mercer Island', 'city', county_king, 'WA'),
    ('Burien', 'city', county_king, 'WA'),
    ('Tukwila', 'city', county_king, 'WA'),
    ('Des Moines', 'city', county_king, 'WA'),
    ('Kent', 'city', county_king, 'WA'),
    ('Auburn', 'city', county_king, 'WA'),
    ('Federal Way', 'city', county_king, 'WA'),
    ('SeaTac', 'city', county_king, 'WA'),
    ('Shoreline', 'city', county_king, 'WA');

  -- Pierce County cities
  INSERT INTO locations (name, kind, parent_id, state_code) VALUES
    ('Tacoma', 'city', county_pierce, 'WA'),
    ('Lakewood', 'city', county_pierce, 'WA'),
    ('Puyallup', 'city', county_pierce, 'WA'),
    ('University Place', 'city', county_pierce, 'WA');

  -- Snohomish County cities
  INSERT INTO locations (name, kind, parent_id, state_code) VALUES
    ('Everett', 'city', county_snohomish, 'WA'),
    ('Lynnwood', 'city', county_snohomish, 'WA'),
    ('Edmonds', 'city', county_snohomish, 'WA'),
    ('Bothell', 'city', county_snohomish, 'WA'),
    ('Mill Creek', 'city', county_snohomish, 'WA'),
    ('Mukilteo', 'city', county_snohomish, 'WA');
END $$;
