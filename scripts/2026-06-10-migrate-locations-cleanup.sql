-- One-time cleanup: map remaining free-text investor locations to the structured catalog.
-- Approved mapping table reviewed by Randy 2026-06-10.
-- Run in Supabase SQL Editor (project xgwmvdizqnvrswsdsljh) or via Claude Code.

-- 1. Add new catalog entries (cities, county, neighborhoods)
DO $$
DECLARE
  county_pierce UUID; county_king UUID; state_wa UUID;
  city_seattle UUID; city_renton UUID; city_fedway UUID;
BEGIN
  SELECT id INTO county_pierce FROM locations WHERE name = 'Pierce County' AND kind = 'county';
  SELECT id INTO county_king   FROM locations WHERE name = 'King County'   AND kind = 'county';
  SELECT id INTO state_wa      FROM locations WHERE name = 'Washington'    AND kind = 'state';
  SELECT id INTO city_seattle  FROM locations WHERE name = 'Seattle'       AND kind = 'city';
  SELECT id INTO city_renton   FROM locations WHERE name = 'Renton'        AND kind = 'city';
  SELECT id INTO city_fedway   FROM locations WHERE name = 'Federal Way'   AND kind = 'city';

  INSERT INTO locations (name, kind, parent_id, state_code) VALUES
    ('Bonney Lake', 'city', county_pierce, 'WA'),
    ('Buckley', 'city', county_pierce, 'WA'),
    ('Sumner', 'city', county_pierce, 'WA'),
    ('Shelton', 'city', state_wa, 'WA'),
    ('Thurston County', 'county', state_wa, 'WA'),
    ('North Seattle', 'neighborhood', city_seattle, 'WA'),
    ('West Seattle', 'neighborhood', city_seattle, 'WA'),
    ('Beacon Hill', 'neighborhood', city_seattle, 'WA'),
    ('Marine Hills', 'neighborhood', city_fedway, 'WA'),
    ('Renton Highlands', 'neighborhood', city_renton, 'WA'),
    ('Sunset', 'neighborhood', city_renton, 'WA')
  ON CONFLICT DO NOTHING;
END $$;

-- 2. Insert fresh chips per investor (idempotent)
WITH chip_map(investor_name, loc_name, loc_kind) AS (
  VALUES
    ('💰 Brixton Ward', 'North Seattle', 'neighborhood'),
    ('💰 Brixton Ward', 'Seattle', 'city'),
    ('💰 Bryan Rousseau', 'North Seattle', 'neighborhood'),
    ('💰 Bryan Rousseau', 'Seattle', 'city'),
    ('💰 Sindhu', 'North Seattle', 'neighborhood'),
    ('💰 Sindhu', 'West Seattle', 'neighborhood'),
    ('💰 Sindhu', 'Seattle', 'city'),
    ('💰 Sindhu', 'Snohomish County', 'county'),
    ('💰 Lien Nguyen', 'West Seattle', 'neighborhood'),
    ('💰 Lien Nguyen', 'Beacon Hill', 'neighborhood'),
    ('💰 Lien Nguyen', 'Seattle', 'city'),
    ('💰 Jay Nadan', 'Marine Hills', 'neighborhood'),
    ('💰 Jay Nadan', 'Federal Way', 'city'),
    ('💰 Kamaljit Tumber', 'Renton Highlands', 'neighborhood'),
    ('💰 Kamaljit Tumber', 'Sunset', 'neighborhood'),
    ('💰 Kamaljit Tumber', 'Renton', 'city'),
    ('💰 Nile Arkush', 'King County', 'county'),
    ('💰 Nile Arkush', 'Shelton', 'city'),
    ('💰 Bethanie Fritz', 'King County', 'county'),
    ('💰 Bethanie Fritz', 'Shoreline', 'city'),
    ('💰 Feras Rabi', 'King County', 'county'),
    ('💰 Feras Rabi', 'Pierce County', 'county'),
    ('💰 Gary Watts', 'King County', 'county'),
    ('💰 Rubie Nguyen', 'Pierce County', 'county'),
    ('💰 Steve Smith', 'Edmonds', 'city'),
    ('💰 Steve Smith', 'Snohomish County', 'county'),
    ('💰 Vihar Tammana', 'Snohomish County', 'county'),
    ('💰 Raymundo Olivas', 'Federal Way', 'city'),
    ('💰 Raymundo Olivas', 'Everett', 'city'),
    ('💰 Ryan Barker', 'Thurston County', 'county'),
    ('💰 Alex Kissling', 'Bonney Lake', 'city'),
    ('💰 Alex Kissling', 'Buckley', 'city'),
    ('💰 Alex Kissling', 'Sumner', 'city')
)
INSERT INTO investor_locations (investor_id, location_id, location_name)
SELECT i.id, l.id, l.name
FROM chip_map cm
JOIN investors i ON i.name = cm.investor_name
JOIN locations l ON l.name = cm.loc_name AND l.kind = cm.loc_kind
ON CONFLICT (investor_id, location_id) WHERE location_id IS NOT NULL DO NOTHING;

-- 3. Remove the old unlinked free-text rows (all now superseded or junk)
DELETE FROM investor_locations
WHERE location_id IS NULL
  AND location_name IN (
    'North Seattle', 'North & West Seattle', 'Seattle (W Seattle', 'Beacon Hill)',
    'Marine Hills', 'Renton (Highland', 'Sunset', 'downtown Renton) — North only',
    'North part of King County (nothing south of Northgate)', 'North King',
    'South King Co.', 'South King County', 'Pierce Co. (NOT Seattle)',
    'Pierce Co. (South Seattle to Lakewood)', 'Snohomish (asked for Edmonds specifically)',
    'Snohomish (future)', 'Snohomish Co. (bigger lots — 8000+ sqft)',
    'Thurston Co. (NOT Seattle proper)', 'Federal Way to Everett',
    'Bonney Lake', 'Buckley', 'Sumner', 'Shelton', 'Shoreline, WA',
    'None', 'nothing south'
  );

-- 4. Verify final state — expect unlinked = 0
SELECT
  COUNT(*) FILTER (WHERE location_id IS NOT NULL) AS linked,
  COUNT(*) FILTER (WHERE location_id IS NULL) AS unlinked,
  COUNT(*) AS total
FROM investor_locations;
