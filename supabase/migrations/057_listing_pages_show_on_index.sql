-- Per-page visibility toggle for the public deals index at
-- /deals-index-active. Defaults to true so existing rows are immediately
-- shown on the index without manual flipping. The marketing-page-creator
-- table gets a switch to flip it on/off without archiving the page.

ALTER TABLE listing_pages
  ADD COLUMN show_on_index BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX listing_pages_show_on_index_idx
  ON listing_pages(is_active, show_on_index, created_at DESC)
  WHERE is_active = true AND show_on_index = true;
