-- The legacy NOT NULL + unique index on location_name (from migration 016) block
-- the new FK-based insert path (addInvestorLocation inserts only investor_id + location_id).
-- The (investor_id, location_id) partial unique index from 059 is the real dedup guard now.
ALTER TABLE investor_locations ALTER COLUMN location_name DROP NOT NULL;
DROP INDEX IF EXISTS investor_locations_unique_idx;
