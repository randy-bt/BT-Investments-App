-- Add follow-up date to leads
ALTER TABLE leads ADD COLUMN next_follow_up_date date;

-- Add follow_ups module to dashboard_notes constraint
ALTER TABLE dashboard_notes DROP CONSTRAINT dashboard_notes_module_check;
ALTER TABLE dashboard_notes ADD CONSTRAINT dashboard_notes_module_check
  CHECK (module IN (
    'acquisitions', 'acquisitions_b', 'dispositions', 'investor_database',
    'agent_outreach', 'investor_outreach', 'agent_outreach_notes',
    'investor_outreach_notes', 'deals_marketing', 'jv_partners',
    'agent_outreach_quick', 'investor_outreach_quick', 'acq_outreach',
    'follow_ups'
  ));

INSERT INTO dashboard_notes (module, content)
VALUES ('follow_ups', '')
ON CONFLICT (module) DO NOTHING;
