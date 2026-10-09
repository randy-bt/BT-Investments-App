-- Migration 100 created jv_partner_sends without table grants. This
-- project's default privileges give new tables only TRUNCATE, REFERENCES
-- and TRIGGER to authenticated and service_role, so every read came back
-- "permission denied for table jv_partner_sends" (BT AGENT, Oct 9 2026).
-- Same grants deal_sends has.
GRANT SELECT, INSERT, UPDATE, DELETE ON jv_partner_sends TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON jv_partner_sends TO service_role;
