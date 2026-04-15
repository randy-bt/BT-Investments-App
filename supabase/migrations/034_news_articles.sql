CREATE TABLE news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  category TEXT NOT NULL CHECK (category IN ('local', 'national', 'macro', 'stocks', 'ai')),
  ai_subcategory TEXT CHECK (ai_subcategory IN ('ai_real_estate', 'ai_general')),
  relevance_score NUMERIC(4,2) NOT NULL DEFAULT 0,
  summary TEXT,
  summary_failed BOOLEAN NOT NULL DEFAULT false,
  last_shown_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX news_articles_category_score_idx ON news_articles(category, relevance_score DESC);
CREATE INDEX news_articles_fetched_at_idx ON news_articles(fetched_at DESC);
CREATE INDEX news_articles_source_url_idx ON news_articles(source_url);

ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read news articles"
  ON news_articles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage news articles"
  ON news_articles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Table grants
GRANT SELECT, INSERT, UPDATE, DELETE ON news_articles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON news_articles TO authenticated;
GRANT SELECT ON news_articles TO anon;
