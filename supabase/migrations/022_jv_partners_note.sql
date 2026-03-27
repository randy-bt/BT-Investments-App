-- Add jv_partners as a valid dashboard_notes module
ALTER TABLE dashboard_notes DROP CONSTRAINT dashboard_notes_module_check;
ALTER TABLE dashboard_notes ADD CONSTRAINT dashboard_notes_module_check
  CHECK (module IN ('acquisitions', 'dispositions', 'investor_database', 'agent_outreach', 'investor_outreach', 'agent_outreach_notes', 'investor_outreach_notes', 'deals_marketing', 'jv_partners'));

INSERT INTO dashboard_notes (module) VALUES ('jv_partners');
