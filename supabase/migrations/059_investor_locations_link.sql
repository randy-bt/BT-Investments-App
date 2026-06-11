-- Reshape investor_locations to reference the new locations catalog
-- Existing location_name column is kept for one release as fallback;
-- it will be dropped in a follow-up migration once UI is stable.
ALTER TABLE investor_locations
  ADD COLUMN location_id UUID REFERENCES locations(id) ON DELETE CASCADE;

CREATE INDEX investor_locations_location_id_idx ON investor_locations(location_id);

-- Best-effort backfill: match existing location_name strings against locations.name
-- Case-insensitive, picks first match. Unmatched rows are left with location_id IS NULL
-- and will be cleaned up via the migration UI.
UPDATE investor_locations il
SET location_id = l.id
FROM locations l
WHERE l.id = (
  SELECT id FROM locations
  WHERE lower(name) = lower(trim(il.location_name))
  ORDER BY
    CASE kind
      WHEN 'city' THEN 1
      WHEN 'neighborhood' THEN 2
      WHEN 'county' THEN 3
      WHEN 'region' THEN 4
      WHEN 'state' THEN 5
    END
  LIMIT 1
);

-- Prevent duplicate (investor, location) pairs
CREATE UNIQUE INDEX investor_locations_investor_location_unique_idx
  ON investor_locations(investor_id, location_id)
  WHERE location_id IS NOT NULL;
