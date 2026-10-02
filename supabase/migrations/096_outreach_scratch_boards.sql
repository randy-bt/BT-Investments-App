-- Quick notes boards on the Agent Outreach tab (Acquisitions consolidation,
-- Randy's go Oct 2 2026): one empty free-space board to the RIGHT of each
-- outreach dashboard's main list, for Aldo. NEW modules on purpose - the
-- existing *_quick modules are the "Additional Notes" boards and must not be
-- reused.
ALTER TABLE dashboard_notes DROP CONSTRAINT dashboard_notes_module_check;
ALTER TABLE dashboard_notes ADD CONSTRAINT dashboard_notes_module_check
  CHECK (module IN (
    'acquisitions', 'acquisitions_b', 'dispositions', 'dispositions_b',
    'investor_database', 'agent_outreach', 'investor_outreach',
    'agent_outreach_notes', 'investor_outreach_notes', 'deals_marketing',
    'jv_partners', 'agent_outreach_quick', 'investor_outreach_quick',
    'acq_outreach', 'follow_ups',
    'agent_outreach_scratch', 'investor_outreach_scratch'
  ));

INSERT INTO dashboard_notes (module, content)
VALUES ('agent_outreach_scratch', ''), ('investor_outreach_scratch', '')
ON CONFLICT (module) DO NOTHING;
