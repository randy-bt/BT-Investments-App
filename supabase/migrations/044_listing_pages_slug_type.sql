ALTER TABLE listing_pages
  ADD COLUMN slug text NOT NULL,
  ADD COLUMN city text NOT NULL,
  ADD COLUMN page_type text NOT NULL CHECK (page_type IN ('webpage', 'html')),
  ADD COLUMN style_id text NOT NULL DEFAULT 'listing-page-v1';

CREATE UNIQUE INDEX listing_pages_slug_type_idx
  ON listing_pages (page_type, slug);
