-- Tables created via MCP-applied migrations never received the standard
-- Supabase role grants (RLS policies existed, but the roles lacked table
-- privileges entirely). jv_deals/jv_deal_events/entity_views/lead_ai_briefs
-- were unusable by ANY role — the whole JV feature, unviewed badges, and
-- the deal-snapshot cache failed silently; the rest were missing
-- service_role only. Applied to prod 2026-07-08.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  jv_deals, jv_deal_events, entity_views, lead_ai_briefs,
  agreement_templates, call_transcripts, generated_agreements,
  indica_messages, saved_articles
TO authenticated, service_role;
