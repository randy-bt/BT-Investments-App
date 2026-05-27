-- Drop the NOT NULL on investors.locations_of_interest so bulk
-- migrations can omit it for records where the location info hasn't
-- been captured yet. The form (admin/new-investor) still requires it
-- via the Zod schema for UI-driven creates; bulk-import scripts can
-- pass null and backfill later.

ALTER TABLE investors ALTER COLUMN locations_of_interest DROP NOT NULL;
