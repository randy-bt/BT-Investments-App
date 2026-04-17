CREATE TABLE market_stats (
  stat_key TEXT PRIMARY KEY,
  value NUMERIC NOT NULL,
  period TEXT NOT NULL,            -- 'April 16, 2026' for daily, 'March 2026' for monthly
  source TEXT NOT NULL DEFAULT 'manual',  -- 'fred', 'redfin', 'manual'
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with keys so the UI always has rows to display
INSERT INTO market_stats (stat_key, value, period, source) VALUES
  ('mortgage_30yr', 0, '', 'manual'),
  ('treasury_10yr', 0, '', 'manual'),
  ('sp500', 0, '', 'manual'),
  ('median_seattle', 0, '', 'manual'),
  ('median_tacoma', 0, '', 'manual'),
  ('median_bellevue', 0, '', 'manual');

-- RLS
ALTER TABLE market_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view market_stats"
  ON market_stats FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage market_stats"
  ON market_stats FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON market_stats TO authenticated;
GRANT ALL ON market_stats TO service_role;
