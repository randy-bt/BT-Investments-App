-- Shared state for /internal pages (Geoffrey/Randy, Sept 2026).
--
-- The Tacoma turnover page has checkboxes and typed decisions that Randy and
-- Mikaela both work through, on different devices. Until now that lived in
-- localStorage, so each device had its own private copy and they silently
-- disagreed. This is the one shared copy.
--
-- One JSON document per page slug, last write wins. Deliberately NOT a
-- normalised schema: the page owns the shape of its own state ({ticks,
-- decisions} today), and a new internal page must not require a migration.
-- That is the whole point of /internal existing as a file drop.
--
-- Written ONLY by the service-role client in /api/internal/state/[slug],
-- which gates on the same bt_internal cookie as the pages themselves. There
-- is no user record behind that cookie, so there is nothing for an RLS
-- policy to check against; RLS is on with no policies, which denies every
-- anon and authenticated request and leaves service_role (which bypasses
-- RLS) as the only way in. Defense in depth, not the primary control.
CREATE TABLE IF NOT EXISTS internal_page_state (
  slug TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE internal_page_state ENABLE ROW LEVEL SECURITY;

-- No policies on purpose. See the note above: anon and authenticated get
-- nothing, the route reaches it with the service-role key.

-- MCP-applied migrations don't get default grants (see migration 073), so
-- the grant is explicit or the route 401s from PostgREST at runtime.
GRANT ALL ON internal_page_state TO service_role;
