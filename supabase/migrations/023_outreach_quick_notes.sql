-- Add outreach quick notes modules
ALTER TABLE dashboard_notes DROP CONSTRAINT dashboard_notes_module_check;
ALTER TABLE dashboard_notes ADD CONSTRAINT dashboard_notes_module_check
  CHECK (module IN ('acquisitions', 'dispositions', 'investor_database', 'agent_outreach', 'investor_outreach', 'agent_outreach_notes', 'investor_outreach_notes', 'deals_marketing', 'jv_partners', 'agent_outreach_quick', 'investor_outreach_quick'));

INSERT INTO dashboard_notes (module) VALUES ('agent_outreach_quick');
INSERT INTO dashboard_notes (module) VALUES ('investor_outreach_quick');
