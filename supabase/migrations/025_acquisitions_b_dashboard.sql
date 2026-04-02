ALTER TABLE dashboard_notes DROP CONSTRAINT dashboard_notes_module_check;
ALTER TABLE dashboard_notes ADD CONSTRAINT dashboard_notes_module_check
  CHECK (module IN ('acquisitions', 'acquisitions_b', 'dispositions', 'investor_database', 'agent_outreach', 'investor_outreach', 'agent_outreach_notes', 'investor_outreach_notes', 'deals_marketing', 'jv_partners', 'agent_outreach_quick', 'investor_outreach_quick'));

INSERT INTO dashboard_notes (module, content)
VALUES ('acquisitions_b', '')
ON CONFLICT (module) DO NOTHING;
