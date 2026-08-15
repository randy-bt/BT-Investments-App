-- Per-city neighborhood blurbs for JV messages (Randy via analyst, 8/15).
--
-- The JV blurb no longer quotes a valuation (Randy: we do not price the
-- deal for the buyer). Its location line comes from THIS table so the copy
-- is deterministic and analyst-editable - never free-generated per send.
-- No row for a city = the line is simply omitted, and the analyst can fill
-- it during the preview step via updateQueueMessages.
CREATE TABLE IF NOT EXISTS dispo_area_blurbs (
  -- lowercased city name, e.g. 'seattle'
  city_key TEXT PRIMARY KEY,
  blurb TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);

ALTER TABLE dispo_area_blurbs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "area blurbs readable" ON dispo_area_blurbs FOR SELECT TO authenticated USING (true);
CREATE POLICY "area blurbs writable" ON dispo_area_blurbs FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON dispo_area_blurbs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON dispo_area_blurbs TO authenticated;
