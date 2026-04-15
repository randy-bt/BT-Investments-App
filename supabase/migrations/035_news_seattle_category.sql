-- Add 'seattle' to the news_articles category CHECK constraint
ALTER TABLE news_articles DROP CONSTRAINT IF EXISTS news_articles_category_check;
ALTER TABLE news_articles ADD CONSTRAINT news_articles_category_check
  CHECK (category IN ('local', 'national', 'macro', 'stocks', 'ai', 'seattle'));
