-- Address -> coordinates, cached forever (Randy 8/13).
--
-- The interactive map is going on the PUBLIC listing pages so investors get
-- Street View. That moves map traffic from "Randy and Aldo" to "anyone who
-- opens a deal link", which is unbounded. Geocoding is the per-call metered
-- part, so it is cached here: an address is geocoded once, ever, and every
-- visitor after that is served from Postgres for free.
--
-- Keyed on the normalised address rather than a listing id so the internal app
-- and the public pages share one cache.
CREATE TABLE IF NOT EXISTS geocode_cache (
  address TEXT PRIMARY KEY,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  formatted_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE geocode_cache ENABLE ROW LEVEL SECURITY;

-- Writes are service-role only (which bypasses RLS), so no INSERT policy is
-- granted deliberately.
CREATE POLICY "geocode cache is readable"
  ON geocode_cache FOR SELECT TO anon, authenticated USING (true);
