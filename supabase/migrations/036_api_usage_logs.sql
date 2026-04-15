CREATE TABLE api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,        -- 'anthropic' | 'openai'
  model TEXT NOT NULL,           -- 'claude-sonnet-4-6', 'gpt-4o', etc.
  feature TEXT NOT NULL,         -- 'news_scoring', 'news_summary', 'news_headlines', 'call_summary', 'transcription', 'listing_page', 'property_scrape'
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(10,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX api_usage_logs_created_at_idx ON api_usage_logs(created_at);
CREATE INDEX api_usage_logs_provider_idx ON api_usage_logs(provider);

-- RLS
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage api_usage_logs"
  ON api_usage_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view api_usage_logs"
  ON api_usage_logs FOR SELECT TO authenticated USING (true);

-- GRANTs
GRANT SELECT, INSERT ON api_usage_logs TO service_role;
GRANT SELECT, INSERT ON api_usage_logs TO authenticated;
