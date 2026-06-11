-- New dispositions tables were created without table-level grants (same issue as 046).
-- RLS policies exist but are moot without the underlying GRANTs.
GRANT SELECT, INSERT, UPDATE, DELETE ON locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON listing_page_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON deal_sends TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON locations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON listing_page_locations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON deal_sends TO service_role;
