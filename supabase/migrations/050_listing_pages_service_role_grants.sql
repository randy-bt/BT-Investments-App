-- 046_listing_pages_grants.sql only granted CRUD to `authenticated`,
-- leaving `service_role` (used by the admin client) without table-level
-- privileges. That made the public /deals/[slug] route — which fetches
-- via the admin client because the marketing site visitor is
-- unauthenticated — 404 even on valid slugs.

GRANT SELECT, INSERT, UPDATE, DELETE ON listing_pages TO service_role;
