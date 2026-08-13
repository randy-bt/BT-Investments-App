-- Fix: geocode_cache was created with RLS but no table-level GRANTs, so the
-- cache never worked at all (Randy 8/13).
--
-- The gotcha: the service role bypasses ROW LEVEL SECURITY, but it does not
-- bypass ordinary Postgres table privileges. 082 reasoned only about RLS, so
-- service_role ended up with REFERENCES/TRIGGER/TRUNCATE and nothing else.
-- Every cache read silently returned nothing and every write silently failed,
-- which meant each public listing page view fired a fresh billable geocode -
-- precisely the cost the cache exists to avoid. Caught because the table was
-- still empty after the page was verified live and geocoding correctly.
GRANT SELECT, INSERT, UPDATE ON geocode_cache TO service_role;

-- Matches the SELECT policy already created in 082, which was likewise
-- unusable without a grant behind it.
GRANT SELECT ON geocode_cache TO anon, authenticated;
