-- Call-lane pages: self-contained HTML call lists served on an unguessable
-- slug, with per-row persistence for the caller's checkboxes, phone
-- corrections and notes (Randy 8/24, for the Curlee assignment push).
--
-- The HTML lives here rather than in the repo so the analyst can update
-- the CONTENT (new skip-trace batches) without a deploy, and because
-- content updates must never disturb the saved state - the two are
-- separate tables joined only by a row key derived from the row's name.
CREATE TABLE IF NOT EXISTS call_lane_pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  html TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS call_lane_entries (
  page_slug TEXT NOT NULL REFERENCES call_lane_pages(slug) ON DELETE CASCADE,
  -- tab + slugified name from the row's first .nm cell: stable when rows
  -- are appended, reordered, or when other columns change.
  row_key TEXT NOT NULL,
  field TEXT NOT NULL CHECK (field IN ('done', 'phone', 'notes')),
  -- ALWAYS plain text, never markup: the page is public, and the client
  -- restores with textContent only, so stored values can never execute.
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (page_slug, row_key, field)
);

CREATE INDEX IF NOT EXISTS call_lane_entries_slug_idx ON call_lane_entries (page_slug);

-- RLS denies everyone. The page is public but the DATABASE is not: reads
-- and writes both go through server routes on the service role, which is
-- what lets the write path be rate-limited, length-capped, and restricted
-- to known slugs. An anon-writable table would have been a public,
-- unauthenticated write surface on the open internet.
ALTER TABLE call_lane_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_lane_entries ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON call_lane_pages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON call_lane_entries TO service_role;
